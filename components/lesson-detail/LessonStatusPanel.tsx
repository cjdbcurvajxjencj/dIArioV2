import React from 'react';
import { Lesson, LessonStatus, BackendJobState, GeminiModel, GeminiModelNames } from '../../types';

interface LessonStatusPanelProps {
    lesson: Lesson;
    isProcessing: boolean;
    isRefreshing: boolean;
    uploadProgress: number | undefined;
    backendStatus: 'ONLINE' | 'OFFLINE' | 'CHECKING';
    isRateLimited: boolean;
    retryModel: GeminiModel;
    topicInput: string;
    setTopicInput: (val: string) => void;
    setRetryModel: (val: GeminiModel) => void;
    onCancelUpload: () => void;
    onManualRefresh: () => void;
    onCancelBackendJob: () => void;
    onProcessLesson: (modelOverride?: GeminiModel) => void;
    onDeleteClick: () => void;
    onConfirmTopic: () => void;
}

const LessonStatusPanel: React.FC<LessonStatusPanelProps> = ({
    lesson,
    isProcessing,
    isRefreshing,
    uploadProgress,
    backendStatus,
    isRateLimited,
    retryModel,
    topicInput,
    setTopicInput,
    setRetryModel,
    onCancelUpload,
    onManualRefresh,
    onCancelBackendJob,
    onProcessLesson,
    onDeleteClick,
    onConfirmTopic
}) => {
    const getBackendStatusText = (status: BackendJobState | undefined) => {
        switch (status) {
            case BackendJobState.Pending: return "In Coda...";
            case BackendJobState.Running: return "In Esecuzione...";
            case BackendJobState.Succeeded: return "Completato";
            case BackendJobState.Failed: return "Fallito";
            case BackendJobState.Cancelled: return "Annullato";
            case BackendJobState.Expired: return "Scaduto";
            default: return "Stato sconosciuto...";
        }
    };

    const commonClasses = "p-3 rounded-lg text-sm mb-4";

    switch (lesson.status) {
        case LessonStatus.Uploading:
             return (
                <div className={`${commonClasses} bg-cyan-50 dark:bg-cyan-900/50 text-cyan-800 dark:text-cyan-200 flex-col items-start`}>
                    <div className="flex justify-between items-center w-full">
                       <span className='flex items-center'><i className="fas fa-cloud-upload-alt animate-pulse mr-2"></i>In caricamento sul backend...</span>
                       {uploadProgress !== undefined && <span className='font-semibold'>{Math.round(uploadProgress)}%</span>}
                    </div>
                    {uploadProgress !== undefined && (
                        <div className="w-full bg-slate-200 dark:bg-slate-600 rounded-full h-1.5 mt-2">
                            <div className="bg-cyan-500 h-1.5 rounded-full transition-all duration-300 ease-linear" style={{ width: `${uploadProgress}%` }}></div>
                        </div>
                    )}
                    <p className='text-xs mt-2'>Il file è in fase di invio al server. <strong>Mantieni l'app aperta fino al completamento del caricamento.</strong></p>
                    <div className="flex justify-end mt-2 w-full">
                        <button onClick={onCancelUpload} className="px-3 py-1 text-xs font-semibold rounded-lg text-red-700 bg-red-100 hover:bg-red-200 dark:bg-red-900/50 dark:text-red-300 dark:hover:bg-red-900">
                            <i className="fas fa-times mr-1"></i> Annulla Caricamento
                        </button>
                    </div>
                </div>
            );
        case LessonStatus.ProcessingBackend:
            return (
                <div className={`${commonClasses} flex flex-col items-start bg-sky-50 dark:bg-sky-900/50 text-sky-800 dark:text-sky-200`}>
                    <div className="flex justify-between items-center w-full">
                        <span className='flex items-center font-semibold'>
                            <i className="fas fa-cloud animate-pulse mr-2"></i>
                            Stato Remoto: {getBackendStatusText(lesson.backendJobStatus)}
                        </span>
                        <button onClick={onManualRefresh} disabled={isRefreshing} className="p-2 rounded-full hover:bg-sky-100 dark:hover:bg-sky-900 transition-colors disabled:opacity-50 disabled:cursor-wait" aria-label="Aggiorna stato">
                            <i className={`fas fa-sync-alt ${isRefreshing ? 'fa-spin' : ''}`}></i>
                        </button>
                    </div>
                    <p className='text-xs mt-1'>Questo processo può richiedere molto tempo. <strong>Puoi chiudere l'app.</strong> Lo stato si aggiornerà al prossimo avvio o con l'aggiornamento manuale.</p>
                    <div className="flex justify-end mt-2 w-full">
                        <button onClick={onCancelBackendJob} disabled={isProcessing} className="px-3 py-1 text-xs font-semibold rounded-lg text-red-700 bg-red-100 hover:bg-red-200 dark:bg-red-900/50 dark:text-red-300 dark:hover:bg-red-900 disabled:opacity-50 disabled:cursor-wait">
                            {isProcessing ? <><i className="fas fa-spinner fa-spin mr-1"></i>Annullamento...</> : <><i className="fas fa-times mr-1"></i>Annulla Elaborazione</>}
                        </button>
                    </div>
                </div>
            );
        case LessonStatus.Processing:
            return <div className={`${commonClasses} flex items-center bg-purple-50 dark:bg-purple-900/50 text-purple-800 dark:text-purple-200`}><i className="fas fa-cog fa-spin mr-2"></i>Elaborazione in corso su questo dispositivo. Tieni l'app aperta.</div>;
        
        case LessonStatus.Recorded:
            return (
                <div className="text-center p-6 bg-slate-50 dark:bg-slate-700/50 rounded-lg mb-4">
                    <i className="fas fa-rocket text-4xl text-slate-400 dark:text-slate-500 mb-3"></i>
                    <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200">Pronta per l'elaborazione</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Scegli come trascrivere e riassumere questa lezione.</p>
                    {backendStatus === 'ONLINE' ? (
                        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                            <button
                                onClick={() => onProcessLesson()} disabled={isProcessing}
                                className="w-full sm:w-auto bg-indigo-600 text-white font-bold py-2 px-6 rounded-lg shadow-md hover:bg-indigo-700 disabled:bg-slate-400 disabled:cursor-not-allowed flex items-center justify-center">
                                {isProcessing ? 'In corso...' : <><i className="fas fa-cloud-upload-alt mr-2"></i><span>Elabora in Remoto (Veloce)</span></>}
                            </button>
                            <button
                                onClick={() => onProcessLesson()} disabled={isProcessing}
                                className="w-full sm:w-auto bg-transparent text-indigo-600 dark:text-indigo-400 font-semibold py-2 px-4 hover:bg-indigo-50 dark:hover:bg-indigo-900/40 rounded-lg disabled:text-slate-400 disabled:dark:text-slate-500 disabled:bg-transparent disabled:cursor-not-allowed">
                                {isProcessing ? 'Attendi...' : 'Elabora Localmente'}
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => onProcessLesson()} disabled={isProcessing}
                            className="bg-indigo-600 text-white font-bold py-2 px-6 rounded-lg shadow-md hover:bg-indigo-700 disabled:bg-slate-400 disabled:cursor-not-allowed">
                            {isProcessing ? 'In corso...' : 'Avvia Elaborazione Locale'}
                        </button>
                    )}
                </div>
            );

        case LessonStatus.Cancelled:
            return (
                <div className="p-4 bg-slate-100 dark:bg-slate-700/50 border border-slate-300 dark:border-slate-600 rounded-lg text-center animate-fade-in mb-4">
                    <i className="fas fa-ban text-4xl text-slate-400 dark:text-slate-500 mb-3"></i>
                    <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200">Elaborazione Annullata</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">L'elaborazione remota del file è stata interrotta.</p>
                    <div className="flex flex-col sm:flex-row justify-center items-center gap-3 pt-2">
                        <button 
                            onClick={onDeleteClick}
                            disabled={isProcessing}
                            className="w-full sm:w-auto px-4 py-2 rounded-lg text-red-700 dark:text-red-300 font-semibold bg-red-100 hover:bg-red-200 dark:bg-red-900/50 dark:hover:bg-red-900/80 flex items-center justify-center"
                        >
                            <i className="fas fa-trash-alt mr-2"></i>
                            Elimina Lezione
                        </button>
                    </div>
                </div>
            );

        case LessonStatus.Error:
            if (lesson.backendJobStatus === BackendJobState.Expired) {
                return (
                    <div className="p-4 bg-orange-50 dark:bg-orange-900/50 border border-orange-300 dark:border-orange-500/30 rounded-lg space-y-3 mb-4 animate-fade-in">
                        <h3 className="font-bold text-orange-800 dark:text-orange-200 flex items-center">
                            <i className="fas fa-clock mr-2"></i>
                            Elaborazione Scaduta
                        </h3>
                        <p className="text-sm text-orange-700 dark:text-orange-400 break-words">{lesson.error}</p>
                        <div className="flex flex-col sm:flex-row justify-end items-center gap-3 pt-2">
                            {lesson.audioBlob && (
                                <button 
                                    onClick={() => onProcessLesson()} 
                                    disabled={isProcessing}
                                    className="w-full sm:w-auto px-4 py-2 rounded-lg text-white font-semibold bg-orange-500 hover:bg-orange-600 disabled:bg-slate-400 disabled:cursor-not-allowed flex items-center justify-center"
                                >
                                    <i className="fas fa-sync-alt mr-2"></i>
                                    Riprova Elaborazione
                                </button>
                            )}
                            <button 
                                onClick={onDeleteClick}
                                disabled={isProcessing}
                                className="w-full sm:w-auto px-4 py-2 rounded-lg text-white font-semibold bg-red-600 hover:bg-red-700 disabled:bg-slate-400 disabled:cursor-not-allowed flex items-center justify-center"
                            >
                                <i className="fas fa-trash-alt mr-2"></i>
                                Elimina Lezione
                            </button>
                        </div>
                    </div>
                );
            }

            if (isRateLimited) {
                return (
                    <div className="p-4 bg-orange-50 dark:bg-orange-900/50 border border-orange-300 dark:border-orange-500/30 rounded-lg space-y-3 mb-4 animate-fade-in">
                        <h3 className="font-bold text-orange-800 dark:text-orange-200 flex items-center">
                            <i className="fas fa-hourglass-half mr-2"></i>
                            Quota Esaurita per il Modello Selezionato
                        </h3>
                        <p className="text-sm text-orange-700 dark:text-orange-400">
                            Il modello selezionato ha raggiunto il limite di richieste. Puoi attendere il reset della quota, oppure riprovare subito con un modello alternativo.
                        </p>
                        <div className="pt-2">
                            <div>
                                <label htmlFor="retry-model" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Modello di Riprova:
                                </label>
                                <select
                                    id="retry-model"
                                    value={retryModel}
                                    onChange={e => setRetryModel(e.target.value as GeminiModel)}
                                    className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500"
                                >
                                    {(Object.values(GeminiModel) as GeminiModel[]).map(m => (
                                        <option key={m} value={m}>{GeminiModelNames[m]}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="flex flex-col sm:flex-row justify-end items-center gap-3 pt-2">
                            <button
                                onClick={() => onProcessLesson(retryModel)}
                                disabled={isProcessing}
                                className="w-full sm:w-auto px-4 py-2 rounded-lg text-white font-semibold bg-orange-500 hover:bg-orange-600 disabled:bg-slate-400 disabled:cursor-not-allowed flex items-center justify-center"
                            >
                                <i className="fas fa-sync-alt mr-2"></i>
                                Riprova con nuovo modello
                            </button>
                            <button 
                                onClick={onDeleteClick}
                                disabled={isProcessing}
                                className="w-full sm:w-auto px-4 py-2 rounded-lg text-slate-700 dark:text-slate-200 font-semibold bg-slate-200 hover:bg-slate-300 dark:bg-slate-600 dark:hover:bg-slate-500 disabled:bg-slate-400 disabled:cursor-not-allowed flex items-center justify-center"
                            >
                                <i className="fas fa-trash-alt mr-2"></i>
                                Elimina
                            </button>
                        </div>
                    </div>
                );
            }

            return (
                <div className="p-4 bg-red-50 dark:bg-red-900/50 border border-red-300 dark:border-red-500/30 rounded-lg space-y-3 mb-4 animate-fade-in">
                    <h3 className="font-bold text-red-800 dark:text-red-200 flex items-center">
                        <i className="fas fa-exclamation-triangle mr-2"></i>
                        Si è verificato un errore
                    </h3>
                    <p className="text-sm text-red-700 dark:text-red-400 break-words">{lesson.error}</p>
                    <div className="flex flex-col sm:flex-row justify-end items-center gap-3 pt-2">
                        {lesson.audioBlob && (
                            <button 
                                onClick={() => onProcessLesson()} 
                                disabled={isProcessing}
                                className="w-full sm:w-auto px-4 py-2 rounded-lg text-white font-semibold bg-orange-500 hover:bg-orange-600 disabled:bg-slate-400 disabled:cursor-not-allowed flex items-center justify-center"
                            >
                                <i className="fas fa-sync-alt mr-2"></i>
                                Riprova Elaborazione
                            </button>
                        )}
                        <button 
                            onClick={onDeleteClick}
                            disabled={isProcessing}
                            className="w-full sm:w-auto px-4 py-2 rounded-lg text-white font-semibold bg-red-600 hover:bg-red-700 disabled:bg-slate-400 disabled:cursor-not-allowed flex items-center justify-center"
                        >
                            <i className="fas fa-trash-alt mr-2"></i>
                            Elimina Lezione
                        </button>
                    </div>
                </div>
            );

        case LessonStatus.PendingTopic:
            return (
                <div className="bg-yellow-50 dark:bg-yellow-900/50 border border-yellow-200 dark:border-yellow-500/30 p-4 rounded-lg space-y-3 mb-4">
                    <h3 className="font-bold text-yellow-800 dark:text-yellow-200">Conferma Argomento</h3>
                    <p className="text-sm text-yellow-700 dark:text-yellow-300">L'IA ha suggerito questo titolo. Puoi modificarlo prima di salvare.</p>
                    <input type="text" value={topicInput} onChange={e => setTopicInput(e.target.value)} className="w-full p-2 border border-yellow-300 dark:border-yellow-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100" />
                    <button onClick={onConfirmTopic} className="bg-yellow-500 text-white font-bold py-2 px-4 rounded-lg shadow-md hover:bg-yellow-600">
                        Conferma e Salva
                    </button>
                </div>
            );

        default:
            return null;
    }
};

export default LessonStatusPanel;
