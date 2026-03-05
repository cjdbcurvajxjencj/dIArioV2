
import React, { useState, useContext, useEffect } from 'react';
import { AppContext } from '../App';
import { Lesson, LessonStatus, GeminiModel, GeminiModelNames, BackendJobState } from '../types';
import { transcribeAndSummarize } from '../services/geminiService';
import { storageService } from '../services/storageService';
import ConfirmationModal from './ConfirmationModal';
import { useSettings } from '../useSettings';
import { uploadForProcessing, getBackendJobStatus, SyncResult, cancelBackendJob, UploadControl } from '../services/backendService';

// Sub-components
import LessonHeader from './lesson-detail/LessonHeader';
import LessonStatusPanel from './lesson-detail/LessonStatusPanel';
import LessonContentTabs from './lesson-detail/LessonContentTabs';
import LessonChat from './lesson-detail/LessonChat';
import LessonFlashcards from './lesson-detail/LessonFlashcards';
import LessonQuiz from './lesson-detail/LessonQuiz';
import LessonAudioPlayer from './lesson-detail/LessonAudioPlayer';

const LessonDetailView: React.FC<{
    lessonId: string;
    onBack: () => void;
}> = ({ lessonId, onBack }) => {
    const { 
        lessons, 
        updateLesson, 
        deleteLesson: contextDeleteLesson, 
        processingState, 
        setProcessingState, 
        backendStatus, 
        uploadProgress, 
        setUploadProgress,
        addUploadControl,
        removeUploadControl,
        abortUpload,
    } = useContext(AppContext);
    
    const { settings } = useSettings();
    const [lesson, setLesson] = useState<Lesson | null>(null);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [animationClass, setAnimationClass] = useState('animate-slide-in-from-right-slow');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);
    
    // States for topic editing
    const [topicInput, setTopicInput] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [editableTopic, setEditableTopic] = useState('');
    const [editableSubject, setEditableSubject] = useState('');
    const [editableSubfolder, setEditableSubfolder] = useState('');

    // State for rate limit error
    const [isRateLimited, setIsRateLimited] = useState<boolean>(false);
    const [retryModel, setRetryModel] = useState<GeminiModel>(settings.analysisModel);

    // Search visibility (passed to ContentTabs)
    const [isSearchVisible, setIsSearchVisible] = useState(false);
    
    // Study Tools Tab
    const [activeStudyTool, setActiveStudyTool] = useState<'chat' | 'quiz' | 'flashcards' | 'none'>('none');

    const isProcessing = !!processingState[lessonId];

    // Initial data load effect
    useEffect(() => {
        const loadLesson = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const fullLesson = await storageService.getLessonById(lessonId);
                if (!fullLesson) {
                    throw new Error("Lezione non trovata.");
                }
                setLesson(fullLesson);
                setTopicInput(fullLesson.topic || fullLesson.suggestedTopic || '');
                setEditableSubject(fullLesson.subject);
                setEditableTopic(fullLesson.topic);
                setEditableSubfolder(fullLesson.subfolder || '');
            } catch (e) {
                setError(e instanceof Error ? e.message : String(e));
            } finally {
                setIsLoading(false);
            }
        };
        loadLesson();
    }, [lessonId]);
    
    // Effect to sync local state with global state changes from background processing
    useEffect(() => {
        const globalLessonMeta = lessons.find(l => l.id === lessonId);

        if (globalLessonMeta && lesson && (globalLessonMeta.status !== lesson.status || globalLessonMeta.backendJobStatus !== lesson.backendJobStatus)) {
            // A background process has updated the lesson's status.
            // Reload the full lesson data from storage to reflect the changes.
            const reloadFullLesson = async () => {
                const fullLessonData = await storageService.getLessonById(lessonId);
                if (fullLessonData) {
                    setLesson(fullLessonData); // This will update the UI with summary, transcript, etc.
                     if (fullLessonData.status === LessonStatus.PendingTopic) {
                        setTopicInput(fullLessonData.topic || fullLessonData.suggestedTopic || '');
                    }
                }
            };
            reloadFullLesson();
        }
    }, [lessons, lessonId, lesson]);


    // Effect to parse lesson error on load and set rate limit state if applicable
    useEffect(() => {
        if (lesson?.status === LessonStatus.Error && lesson.error && (lesson.error.includes('429') || lesson.error.includes('RESOURCE_EXHAUSTED') || lesson.error.includes('RATE_LIMIT_EXCEEDED'))) {
            setIsRateLimited(true);
            setRetryModel(settings.analysisModel);
        } else {
            setIsRateLimited(false);
        }
    }, [lesson, settings.analysisModel]);
    
    const handleClose = () => {
        setAnimationClass('animate-slide-out-to-right-slow');
        setTimeout(onBack, 300);
    }

    const handleManualRefresh = async () => {
        if (!lesson?.backendProcessingId || !settings.apiKey) return;
        setIsRefreshing(true);
        setError(null);
        try {
            const result: SyncResult = await getBackendJobStatus(settings.apiKey, lesson.backendProcessingId);
    
            let hasChanged = false;
            let updatedLesson: Lesson = { ...lesson };
    
            if (result.status === 'completed' && result.result) {
                const { transcript, summary, suggestedTopic } = result.result;
                updatedLesson = {
                    ...lesson,
                    transcript,
                    summary,
                    suggestedTopic,
                    status: LessonStatus.PendingTopic,
                    backendJobStatus: BackendJobState.Succeeded,
                    error: undefined,
                    audioBlob: undefined,
                };
                hasChanged = true;
            } else if (result.backend_job_status === BackendJobState.Expired) {
                updatedLesson = {
                    ...lesson,
                    status: LessonStatus.Error,
                    error: result.message || 'Elaborazione scaduta dopo 48 ore.',
                    backendJobStatus: BackendJobState.Expired,
                };
                hasChanged = true;
            } else if (result.status === 'error' || result.status === 'not_found') {
                updatedLesson = { 
                    ...lesson, 
                    status: LessonStatus.Error, 
                    error: `Backend: ${result.message || 'Unknown error'}`,
                    backendJobStatus: result.backend_job_status || BackendJobState.Failed
                };
                hasChanged = true;
            } else if (result.status === 'cancelled') {
                updatedLesson = {
                    ...lesson,
                    status: LessonStatus.Cancelled,
                    backendJobStatus: result.backend_job_status || BackendJobState.Cancelled,
                    error: 'Elaborazione annullata dall\'utente.',
                };
                hasChanged = true;
            } else if (result.status === 'processing' && result.backend_job_status) {
                if (lesson.backendJobStatus !== result.backend_job_status) {
                    updatedLesson = { ...lesson, backendJobStatus: result.backend_job_status };
                    hasChanged = true;
                }
            }
            
            if (hasChanged) {
                await updateLesson(updatedLesson);
                setLesson(updatedLesson);
                if (updatedLesson.status === LessonStatus.PendingTopic) {
                    setTopicInput(updatedLesson.topic || updatedLesson.suggestedTopic || '');
                }
            }
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : String(e);
            setError(`Impossibile aggiornare lo stato: ${errorMessage}`);
            console.error("Failed to refresh status:", e);
        } finally {
            setIsRefreshing(false);
        }
    };
    
    const handleProcessLesson = async (modelOverride?: GeminiModel) => {
        if (!lesson) return;
        if (!settings.apiKey) {
            alert("API Key non trovata. Per favore, vai nelle impostazioni per aggiungerla.");
            return;
        }
    
        setProcessingState(lesson.id, true);
        setIsRateLimited(false);
    
        const fullLesson = await storageService.getLessonById(lesson.id);
        if (!fullLesson || !fullLesson.audioBlob) {
            alert('File audio non trovato. Impossibile avviare l\'elaborazione.');
            setProcessingState(lesson.id, false);
            return;
        }
    
        const transcriptionModel = modelOverride || settings.transcriptionModel;
        const analysisModel = modelOverride || settings.analysisModel;
        let uploadController: UploadControl | null = null;
    
        try {
            if (backendStatus === 'ONLINE') {
                const lessonUploadingState = { ...fullLesson, status: LessonStatus.Uploading, error: undefined };
                await updateLesson(lessonUploadingState);
                setLesson(lessonUploadingState); 
    
                uploadController = uploadForProcessing(
                    settings.apiKey,
                    fullLesson.audioBlob,
                    fullLesson.subject,
                    transcriptionModel,
                    analysisModel,
                    (percent) => setUploadProgress(lesson.id, percent)
                );
    
                addUploadControl(lesson.id, uploadController);
    
                const response = await uploadController.promise;
                const lessonProcessingBackendState = { ...fullLesson, status: LessonStatus.ProcessingBackend, backendProcessingId: response.lesson_id };
                await updateLesson(lessonProcessingBackendState);
                setLesson(lessonProcessingBackendState);
    
            } else {
                const lessonProcessingState = { ...fullLesson, status: LessonStatus.Processing, error: undefined };
                await updateLesson(lessonProcessingState);
                setLesson(lessonProcessingState);
    
                const { transcript, summary, suggestedTopic } = await transcribeAndSummarize(fullLesson.audioBlob, lesson.subject, transcriptionModel, analysisModel, settings.apiKey);
                const processedLesson: Lesson = { ...fullLesson, transcript, summary, suggestedTopic, status: LessonStatus.PendingTopic, audioBlob: undefined };
                await updateLesson(processedLesson);
                setLesson(processedLesson);
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            const wasCancelled = errorMessage.toLowerCase().includes('annullato') || (err instanceof DOMException && err.name === 'AbortError');
            
            // Se l'annullamento è stato gestito dall'utente, non aggiorniamo lo stato qui
            // per evitare di sovrascrivere l'eliminazione.
            if (wasCancelled) {
                console.log("Il caricamento del tentativo è stato annullato. Lo stato è gestito dalla funzione di annullamento.");
                return;
            }

            // Per tutti gli altri errori reali, impostiamo lo stato di errore.
            const lessonToUpdate = await storageService.getLessonById(lesson.id) || fullLesson;
            const finalState = { ...lessonToUpdate, status: LessonStatus.Error, error: `Tentativo fallito: ${errorMessage.replace('Error: ', '')}` };

            await updateLesson(finalState);
            setLesson(finalState);

        } finally {
            setProcessingState(lesson.id, false);
            setUploadProgress(lesson.id, null);
            removeUploadControl(lesson.id);
        }
    };
    
    const handleCancelUpload = async () => {
        if (!lesson) return;
        
        // 1. Interrompe la richiesta di rete
        abortUpload(lesson.id);

        // 2. Elimina la lezione immediatamente
        try {
            await contextDeleteLesson(lesson.id);
            console.log(`Caricamento annullato. Lezione ${lesson.id} eliminata.`);
            // 3. Torna alla vista precedente
            handleClose();
        } catch (e) {
            console.error("Errore durante l'eliminazione della lezione dopo l'annullamento:", e);
            alert("Errore durante l'eliminazione della lezione. Prova a eliminarla manualmente.");
            // Imposta uno stato di errore per uscire dalla vista di caricamento
            const errorLesson = { ...lesson, status: LessonStatus.Error, error: "Impossibile eliminare la lezione dopo l'annullamento." };
            await updateLesson(errorLesson);
            setLesson(errorLesson);
        }
    };

    const handleCancelBackendJob = async () => {
        if (!lesson?.backendProcessingId || !settings.apiKey) return;
        setProcessingState(lesson.id, true);
        try {
            await cancelBackendJob(settings.apiKey, lesson.backendProcessingId);
            const cancelledLesson: Lesson = {
                ...lesson,
                status: LessonStatus.Cancelled,
                backendJobStatus: BackendJobState.Cancelled,
                error: 'Annullamento richiesto dall\'utente.'
            };
            await updateLesson(cancelledLesson);
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : String(e);
            setError(`Impossibile annullare: ${errorMessage}`);
            console.error("Failed to cancel job:", e);
        } finally {
            setProcessingState(lesson.id, false);
        }
    };

    const handleConfirmTopic = async () => {
        if (!lesson) return;
        const finalLesson = { ...lesson, topic: topicInput, status: LessonStatus.Completed };
        await updateLesson(finalLesson);
        setLesson(finalLesson);
    };
    
    const handleEnterEditMode = () => {
        if (!lesson) return;
        setEditableSubject(lesson.subject);
        setEditableSubfolder(lesson.subfolder || '');
        setEditableTopic(lesson.topic);
        setIsEditing(true);
    };

    const handleSaveEdit = async () => {
        if (!editableSubject.trim() || !editableTopic.trim() || !lesson) {
            alert("Materia e argomento non possono essere vuoti.");
            return;
        }
        const editedLesson = { 
          ...lesson, 
          subject: editableSubject.trim(), 
          topic: editableTopic.trim(),
          subfolder: editableSubfolder.trim() || undefined
        };
        await updateLesson(editedLesson);
        setLesson(editedLesson);
        setIsEditing(false);
    };

    const handleDeleteLesson = async () => {
      if (!lesson) return;
      setIsDeleteConfirmOpen(false);
      await contextDeleteLesson(lesson.id);
      handleClose();
    };
    
    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-16 text-slate-500 dark:text-slate-400">
                <i className="fas fa-spinner fa-spin fa-2x"></i>
            </div>
        );
    }
    
    if (error || !lesson) {
        return (
            <div className={`bg-white dark:bg-slate-800 p-4 sm:p-6 rounded-lg shadow-xl ${animationClass}`}>
                <div className="p-4 bg-red-50 dark:bg-red-900/50 rounded-lg text-red-700 dark:text-red-200">
                    <p><strong>Errore:</strong> {error || "Lezione non trovata."}</p>
                    <button onClick={handleClose} className="text-sm text-blue-600 dark:text-blue-400 hover:underline mt-2">Torna indietro</button>
                </div>
            </div>
        );
    }

    return (
        <>
            <div className={`bg-white dark:bg-slate-800 p-4 sm:p-6 rounded-lg shadow-xl ${animationClass}`}>
                <LessonHeader 
                    lesson={lesson}
                    isEditing={isEditing}
                    editableSubject={editableSubject}
                    editableTopic={editableTopic}
                    editableSubfolder={editableSubfolder}
                    setEditableSubject={setEditableSubject}
                    setEditableTopic={setEditableTopic}
                    setEditableSubfolder={setEditableSubfolder}
                    onBack={handleClose}
                    onEnterEditMode={handleEnterEditMode}
                    onSaveEdit={handleSaveEdit}
                    onCancelEdit={() => setIsEditing(false)}
                    onDeleteClick={() => setIsDeleteConfirmOpen(true)}
                    onToggleSearch={() => setIsSearchVisible(prev => !prev)}
                />
                
                <LessonStatusPanel 
                    lesson={lesson}
                    isProcessing={isProcessing}
                    isRefreshing={isRefreshing}
                    uploadProgress={uploadProgress ? uploadProgress[lesson.id] : undefined}
                    backendStatus={backendStatus}
                    isRateLimited={isRateLimited}
                    retryModel={retryModel}
                    topicInput={topicInput}
                    setTopicInput={setTopicInput}
                    setRetryModel={setRetryModel}
                    onCancelUpload={handleCancelUpload}
                    onManualRefresh={handleManualRefresh}
                    onCancelBackendJob={handleCancelBackendJob}
                    onProcessLesson={handleProcessLesson}
                    onDeleteClick={() => setIsDeleteConfirmOpen(true)}
                    onConfirmTopic={handleConfirmTopic}
                />

                {!isEditing && (lesson.status === LessonStatus.Completed || lesson.status === LessonStatus.PendingTopic) && (
                    <div className="space-y-8">
                        <LessonAudioPlayer lesson={lesson} />

                        {/* Study Tools Tabs */}
                        <div className="bg-slate-50 dark:bg-slate-900/30 p-1 rounded-xl flex space-x-1 mb-6">
                            <button 
                                onClick={() => setActiveStudyTool(activeStudyTool === 'chat' ? 'none' : 'chat')}
                                className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center ${activeStudyTool === 'chat' ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                <i className="fas fa-comment-dots mr-2"></i>Tutor IA
                            </button>
                            <button 
                                onClick={() => setActiveStudyTool(activeStudyTool === 'quiz' ? 'none' : 'quiz')}
                                className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center ${activeStudyTool === 'quiz' ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                <i className="fas fa-bolt mr-2"></i>Quiz
                            </button>
                            <button 
                                onClick={() => setActiveStudyTool(activeStudyTool === 'flashcards' ? 'none' : 'flashcards')}
                                className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center ${activeStudyTool === 'flashcards' ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                <i className="fas fa-clone mr-2"></i>Flashcard
                            </button>
                        </div>

                        {/* Active Study Tool Content */}
                        {activeStudyTool !== 'none' && (
                            <div className="mb-10 animate-fade-in">
                                {activeStudyTool === 'chat' && <LessonChat lesson={lesson} analysisModel={settings.analysisModel} apiKey={settings.apiKey || ''} />}
                                {activeStudyTool === 'quiz' && <LessonQuiz lesson={lesson} analysisModel={settings.analysisModel} apiKey={settings.apiKey || ''} />}
                                {activeStudyTool === 'flashcards' && <LessonFlashcards lesson={lesson} analysisModel={settings.analysisModel} apiKey={settings.apiKey || ''} />}
                            </div>
                        )}

                        <LessonContentTabs 
                            lesson={lesson}
                            isSearchVisible={isSearchVisible}
                            setIsSearchVisible={setIsSearchVisible}
                        />
                    </div>
                )}
            </div>
            <ConfirmationModal
                isOpen={isDeleteConfirmOpen}
                title="Conferma Eliminazione"
                message={`Sei sicuro di voler eliminare la lezione di "${lesson.subject}" del ${new Date(lesson.date).toLocaleDateString()}? Verranno eliminati anche i quiz associati.`}
                confirmText="Elimina"
                onConfirm={handleDeleteLesson}
                onCancel={() => setIsDeleteConfirmOpen(false)}
            />
        </>
    )
};

export default LessonDetailView;