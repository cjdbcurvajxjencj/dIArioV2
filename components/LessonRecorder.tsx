import React, { useState, useContext, useRef } from 'react';
import { AppContext } from '../App';
import { Lesson, LessonStatus } from '../types';
import { useSettings } from '../useSettings';
import { VoiceRecorder } from 'capacitor-voice-recorder';
import { uploadForProcessing } from '../services/backendService';
import { base64ToBlob } from '../utils/helpers';

const LessonRecorder: React.FC = () => {
  const { addLesson, updateLesson, backendStatus, setUploadProgress, addUploadControl, removeUploadControl } = useContext(AppContext);
  const { settings } = useSettings();
  const [activeTab, setActiveTab] = useState<'record' | 'upload'>('record');

  // Shared state
  const [subject, setSubject] = useState('');
  const [subfolder, setSubfolder] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  
  // Upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supportedAudioTypes = ['audio/wav', 'audio/mp3', 'audio/mpeg', 'audio/aiff', 'audio/aac', 'audio/ogg', 'audio/flac', 'audio/mp4', 'audio/x-m4a', 'audio/m4a'];
  const supportedExtensions = "WAV, MP3, M4A, AIFF, AAC, OGG, FLAC";

  const startProcessing = async (lesson: Lesson) => {
    await addLesson(lesson);

    if (backendStatus !== 'ONLINE' || !lesson.audioBlob || !settings.apiKey) {
        return;
    }
    
    // --- Flusso di Elaborazione Remota ---
    await updateLesson({ ...lesson, status: LessonStatus.Uploading });

    const uploadControl = uploadForProcessing(
        settings.apiKey, 
        lesson.audioBlob, 
        lesson.subject, 
        settings.transcriptionModel,
        settings.analysisModel,
        (percent) => {
            setUploadProgress(lesson.id, percent);
        }
    );
    addUploadControl(lesson.id, uploadControl);

    try {
        const response = await uploadControl.promise;
        await updateLesson({ 
            ...lesson, 
            status: LessonStatus.ProcessingBackend, 
            backendProcessingId: response.lesson_id, 
        });
    } catch (e) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        const wasCancelled = errorMessage.toLowerCase().includes('annullato') || (e instanceof DOMException && e.name === 'AbortError');
        
        // Se il caricamento è stato annullato, viene gestito dalla vista dei dettagli (che elimina la lezione).
        // Non facciamo nulla qui per evitare conflitti di stato.
        if (wasCancelled) {
            console.log("Caricamento iniziale annullato. Gestione delegata al componente di dettaglio.");
            return; // Esce senza aggiornare lo stato
        }
        
        // Per tutti gli altri errori, imposta lo stato di Errore.
        let alertMessage = `Impossibile avviare l'elaborazione: ${errorMessage}`;
        if (errorMessage.toLowerCase().includes('failed to fetch')) {
            alertMessage += "\n\nQuesto errore può essere causato da un problema di rete o da una configurazione errata del backend (CORS).";
        }
        alert(alertMessage);
        await updateLesson({ ...lesson, status: LessonStatus.Error, error: errorMessage });
    } finally {
        // Questo blocco viene eseguito sempre, garantendo la pulizia.
        removeUploadControl(lesson.id);
        setUploadProgress(lesson.id, null);
    }
  };

  const handleStartRecording = async () => {
    if (!subject) {
      alert('Per favore, inserisci la materia.');
      return;
    }
    try {
      const permission = await VoiceRecorder.requestAudioRecordingPermission();
      if (!permission.value) {
        alert('Permesso di registrazione non concesso. Abilita l\'accesso al microfono dalle impostazioni del dispositivo o del browser.');
        return;
      }
      
      await VoiceRecorder.startRecording();
      setIsRecording(true);

    } catch (err) {
      console.error('Error starting capacitor recording:', err);
      alert('Impossibile avviare la registrazione. Assicurati che l\'app sia in esecuzione su un dispositivo compatibile (iOS, Android, Web con PWA).');
    }
  };

  const handleStopRecording = async () => {
     if (!isRecording) return;
     
     setIsLoading(true);
     setIsRecording(false); // UI feedback immediato

     try {
        const result = await VoiceRecorder.stopRecording();
        const { value: recordedData } = result;

        if (recordedData && recordedData.recordDataBase64) {
            const audioBlob = await base64ToBlob(recordedData.recordDataBase64, recordedData.mimeType);

            const newLesson: Lesson = {
              id: `lesson-${Date.now()}`,
              subject,
              subfolder: subfolder.trim() || undefined,
              topic: '',
              date: new Date().toISOString(),
              status: LessonStatus.Recorded,
              audioBlob: audioBlob,
            };
            // Avvia l'elaborazione in background senza bloccare l'interfaccia
            startProcessing(newLesson);
        } else {
             throw new Error("La registrazione non ha prodotto dati validi.");
        }
     } catch (e) {
        console.error('Error stopping capacitor recording:', e);
        alert(`Errore nel salvataggio della registrazione: ${e instanceof Error ? e.message : String(e)}`);
        setIsRecording(false);
     } finally {
        // Resetta l'interfaccia immediatamente
        setSubject('');
        setSubfolder('');
        setIsLoading(false);
     }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
        const file = event.target.files[0];

        if (!supportedAudioTypes.includes(file.type)) {
            alert(`Formato file non supportato. Trovato: "${file.type}".\nPer favore, carica uno dei seguenti formati: ${supportedExtensions}.`);
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
            setSelectedFile(null);
            return;
        }

        const MAX_FILE_SIZE_MB = 200;
        if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) { // 200MB limit
             alert(`Il file è troppo grande. Limite massimo: ${MAX_FILE_SIZE_MB}MB.`);
             if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
            setSelectedFile(null);
             return;
        }
        setSelectedFile(file);
    }
  };

  const handleUpload = () => {
    if (!subject || !selectedFile) {
      alert('Per favore, inserisci la materia e seleziona un file audio.');
      return;
    }
    setIsLoading(true);
    try {
        const newLesson: Lesson = {
          id: `lesson-${Date.now()}`,
          subject,
          subfolder: subfolder.trim() || undefined,
          topic: '',
          date: new Date().toISOString(),
          status: LessonStatus.Recorded,
          audioBlob: selectedFile,
        };
        // Avvia l'elaborazione in background senza bloccare l'interfaccia
        startProcessing(newLesson);
    } catch(e) {
        console.error(e);
        alert(`Errore nel salvataggio del file caricato: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
        // Resetta l'interfaccia immediatamente
        setSubject('');
        setSubfolder('');
        setSelectedFile(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
        setIsLoading(false);
    }
  };

  const handleTabChange = (tab: 'record' | 'upload') => {
    if (isRecording || isLoading) return;
    setSubject('');
    setSubfolder('');
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setActiveTab(tab);
  };
  
  const isBusy = isRecording || isLoading;

  return (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-lg mb-8">
        <div className="flex flex-wrap justify-between items-center gap-y-2 mb-2">
            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Aggiungi Lezione</h2>
            <div className="text-xs font-semibold flex items-center gap-2 p-2 rounded-lg bg-slate-100 dark:bg-slate-700">
                {backendStatus === 'ONLINE' ? 
                    <span className="text-green-600 dark:text-green-400"><i className="fas fa-cloud"></i> Backend Online</span> :
                 backendStatus === 'OFFLINE' ? 
                    <span className="text-amber-600 dark:text-amber-400"><i className="fas fa-desktop"></i> Elaborazione Locale</span> :
                    <span className="text-slate-500"><i className="fas fa-question-circle"></i> Backend Sconosciuto</span>
                }
            </div>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
            {backendStatus === 'ONLINE' 
                ? "L'elaborazione avverrà in remoto. Potrai chiudere l'app dopo il caricamento." 
                : "Il backend non è attivo. L'elaborazione avverrà sul tuo dispositivo, dovrai tenerla aperta."
            }
        </p>
        <div className="border-b border-slate-200 dark:border-slate-700">
            <nav className="-mb-px flex space-x-4 sm:space-x-6" aria-label="Tabs">
                <button
                    onClick={() => handleTabChange('record')}
                    disabled={isBusy}
                    className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm disabled:cursor-not-allowed ${activeTab === 'record' ? 'border-violet-500 text-violet-600 dark:text-violet-400' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-500'}`}
                >
                    <i className="fas fa-microphone-alt mr-2"></i>Registra Lezione
                </button>
                <button
                    onClick={() => handleTabChange('upload')}
                    disabled={isBusy}
                    className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm disabled:cursor-not-allowed ${activeTab === 'upload' ? 'border-violet-500 text-violet-600 dark:text-violet-400' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-500'}`}
                >
                    <i className="fas fa-upload mr-2"></i>Carica Audio
                </button>
            </nav>
        </div>

      <div className="pt-6">
        {activeTab === 'record' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Materia (es. Storia)"
                className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-slate-100 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 disabled:dark:bg-slate-600"
                disabled={isBusy}
              />
              <input
                type="text"
                value={subfolder}
                onChange={(e) => setSubfolder(e.target.value)}
                placeholder="Sottocartella (Opzionale)"
                className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-slate-100 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 disabled:dark:bg-slate-600"
                disabled={isBusy}
              />
            </div>
            <button
              onClick={isRecording ? handleStopRecording : handleStartRecording}
              disabled={isLoading}
              className={`w-full p-3 text-white font-bold rounded-lg shadow-md transition-all transform hover:scale-105 active:scale-95 flex items-center justify-center disabled:cursor-not-allowed ${
                isRecording ? 'bg-red-500 hover:bg-red-600' : 
                isLoading ? 'bg-slate-400 dark:bg-slate-500' : 'bg-indigo-600 hover:bg-indigo-700'
              }`}
            >
              {isRecording ? (<><i className="fas fa-stop-circle mr-2 animate-pulse"></i><span>Ferma Registrazione</span></>) : 
               isLoading ? (<><i className="fas fa-spinner fa-spin mr-2"></i><span>Salvataggio...</span></>) :
               (<><i className="fas fa-microphone-alt mr-2"></i><span>Inizia a Registrare</span></>)
              }
            </button>
          </div>
        )}
        
        {activeTab === 'upload' && (
          <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Materia (es. Storia)"
                    className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-slate-100 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 disabled:dark:bg-slate-600"
                    disabled={isLoading}
                />
                <input
                  type="text"
                  value={subfolder}
                  onChange={(e) => setSubfolder(e.target.value)}
                  placeholder="Sottocartella (Opzionale)"
                  className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-slate-100 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 disabled:dark:bg-slate-600"
                  disabled={isLoading}
                />
              </div>
              
              <div className="p-6 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg text-center bg-slate-50 dark:bg-slate-700/50">
                  <i className="fas fa-cloud-upload-alt text-4xl text-slate-400 dark:text-slate-500 mb-3"></i>
                  <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept={supportedAudioTypes.join(',')}
                      className="hidden"
                      id="audio-upload"
                      disabled={isLoading}
                  />
                  <div>
                    <label
                        htmlFor="audio-upload"
                        className={`font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 ${isLoading ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                    >
                      <span>Carica un file</span>
                    </label>
                    <span className="text-sm text-slate-600 dark:text-slate-400"> o trascinalo qui</span>
                  </div>

                  {selectedFile ? (
                    <p className="text-slate-600 dark:text-slate-300 text-sm mt-3 truncate">File selezionato: <span className="font-medium">{selectedFile.name}</span></p>
                  ) : (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">Max 200MB. Formati supportati: {supportedExtensions}.</p>
                  )}
              </div>

              <button
                  onClick={handleUpload}
                  disabled={isLoading || !subject || !selectedFile}
                  className={`w-full p-3 text-white font-bold rounded-lg shadow-md transition-all transform hover:scale-105 active:scale-95 flex items-center justify-center disabled:cursor-not-allowed disabled:bg-slate-400 dark:disabled:bg-slate-600 bg-indigo-600 hover:bg-indigo-700`}
              >
                  {isLoading ? (<><i className="fas fa-spinner fa-spin mr-2"></i><span>Aggiunta in corso...</span></>) :
                               (<><i className="fas fa-plus-circle mr-2"></i><span>Aggiungi Lezione da File</span></>)
                  }
              </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default LessonRecorder;