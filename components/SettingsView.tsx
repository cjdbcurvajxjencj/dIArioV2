import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { storageService } from '../services/storageService';
import ConfirmationModal from './ConfirmationModal';
import { useSettings } from '../useSettings';
import { AppContext } from '../App';
import { GeminiModel, GeminiModelNames, Lesson, CalendarEvent, Quiz } from '../types';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { gzip, ungzip } from 'pako';

type BackupData = {
  lessons: Lesson[];
  events: CalendarEvent[];
  quizzes: Quiz[];
}

type BackupType = 'full' | 'text-only';

// --- COMPONENTE TIMER QUOTA ---
const QuotaResetTimer: React.FC = () => {
    const calculateTimeRemaining = () => {
        const now = new Date();
        // Quota reset is at midnight Pacific Time, which is 08:00 UTC (during PST) or 07:00 UTC (during PDT).
        // Using 08:00 UTC is a safe and simple approximation.
        const resetTime = new Date();
        resetTime.setUTCHours(8, 0, 0, 0); 

        if (now.getTime() > resetTime.getTime()) {
            resetTime.setUTCDate(resetTime.getUTCDate() + 1);
        }

        const diff = resetTime.getTime() - now.getTime();

        if (diff <= 0) return { hours: '00', minutes: '00', seconds: '00' };

        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        return {
            hours: String(hours).padStart(2, '0'),
            minutes: String(minutes).padStart(2, '0'),
            seconds: String(seconds).padStart(2, '0'),
        };
    };

    const [time, setTime] = useState(calculateTimeRemaining());

    useEffect(() => {
        const timer = setInterval(() => setTime(calculateTimeRemaining()), 1000);
        return () => clearInterval(timer);
    }, []);

    return (
        <div className="text-center">
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">Tempo rimanente al reset della quota giornaliera (RPD):</p>
            <div className="text-2xl font-mono font-bold text-slate-800 dark:text-slate-100 bg-slate-200 dark:bg-slate-700 p-2 rounded-lg inline-block shadow-inner">
                {time.hours}:{time.minutes}:{time.seconds}
            </div>
        </div>
    );
};


// --- MODAL PER LA SCELTA DEL TIPO DI EXPORT ---
const ExportModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onExport: (type: BackupType) => void;
  isExporting: boolean;
}> = ({ isOpen, onClose, onExport, isExporting }) => {
  if (!isOpen) return null;

  const modalRoot = document.getElementById('modal-root');
  if (!modalRoot) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-60 dark:bg-opacity-80 flex justify-center items-center z-[250] p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-2xl w-full max-w-lg p-6 animate-pop-in" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg leading-6 font-bold text-slate-900 dark:text-slate-100 mb-2">Scegli il Tipo di Backup</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
          Il backup compresso (.gz) riduce le dimensioni del file, rendendo salvataggio e caricamento più veloci.
        </p>
        <div className="space-y-3">
          <button
            onClick={() => onExport('full')}
            disabled={isExporting}
            className="w-full text-left p-4 rounded-lg border-2 border-indigo-500 bg-indigo-50 dark:bg-indigo-900/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/80 transition-colors disabled:opacity-50 disabled:cursor-wait"
          >
            <div className="flex items-center">
              <i className="fas fa-file-archive text-indigo-600 dark:text-indigo-400 text-xl mr-4"></i>
              <div>
                <strong className="text-slate-800 dark:text-slate-100">Backup Completo (Compresso)</strong>
                <span className="text-xs block text-slate-600 dark:text-slate-300">Salva tutto: lezioni (inclusa l'organizzazione in sottocartelle), audio, riassunti, eventi e quiz.</span>
              </div>
            </div>
          </button>
          <button
            onClick={() => onExport('text-only')}
            disabled={isExporting}
            className="w-full text-left p-4 rounded-lg border-2 border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-wait"
          >
            <div className="flex items-center">
              <i className="fas fa-file-alt text-slate-600 dark:text-slate-400 text-xl mr-4"></i>
              <div>
                <strong className="text-slate-800 dark:text-slate-100">Backup solo Testo (Compresso)</strong>
                <span className="text-xs block text-slate-600 dark:text-slate-300">Salva i dati testuali (lezioni, sottocartelle, riassunti, ecc.), escludendo i file audio.</span>
              </div>
            </div>
          </button>
        </div>
        <div className="mt-5 sm:mt-4 text-right">
          <button
            type="button"
            className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 dark:border-slate-600 shadow-sm px-4 py-2 bg-white dark:bg-slate-700 text-base font-medium text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:w-auto sm:text-sm"
            onClick={onClose}
          >
            Annulla
          </button>
        </div>
      </div>
    </div>,
    modalRoot
  );
}


const SettingsView: React.FC = () => {
  const { settings, setSettings } = useSettings();
  const { reloadData } = React.useContext(AppContext);
  const [storageUsage, setStorageUsage] = useState<string | null>(null);
  
  const [isConfirmDeleteAllOpen, setIsConfirmDeleteAllOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deletionMessage, setDeletionMessage] = useState('');
  
  const [isExporting, setIsExporting] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isConfirmImportOpen, setIsConfirmImportOpen] = useState(false);
  const [dataToImport, setDataToImport] = useState<BackupData | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showApiKey, setShowApiKey] = useState(false);

  useEffect(() => {
    const getStorageUsage = async () => {
      if (navigator.storage && navigator.storage.estimate) {
        try {
          const estimate = await navigator.storage.estimate();
          if (estimate.usage !== undefined) {
            const usageInMB = (estimate.usage / 1024 / 1024).toFixed(2);
            setStorageUsage(`${usageInMB} MB`);
          } else {
             setStorageUsage("N/D");
          }
        } catch (error) {
          console.error("Impossibile stimare lo spazio di archiviazione:", error);
          setStorageUsage("Errore");
        }
      } else {
        setStorageUsage("API non supportata");
      }
    };

    getStorageUsage();
  }, []);
  
  const handleExportData = async (backupType: BackupType) => {
    setIsExportModalOpen(false);
    setIsExporting(true);
    try {
      const data = await storageService.exportAllData();
      
      const serializableLessons = await Promise.all(data.lessons.map(async lesson => {
        if (backupType === 'text-only') {
          const { audioBlob, ...rest } = lesson;
          return rest; 
        }

        if (lesson.audioBlob) {
          const base64 = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.readAsDataURL(lesson.audioBlob!);
              reader.onloadend = () => resolve(reader.result as string);
              reader.onerror = error => reject(error);
          });
          const { audioBlob, ...rest } = lesson;
          return { ...rest, audioBase64: base64, audioMimeType: audioBlob.type };
        }
        return lesson;
      }));
      
      const serializableData = { ...data, lessons: serializableLessons };
      const jsonString = JSON.stringify(serializableData, null, 2);
      
      let blob: Blob;
      const date = new Date().toISOString().split('T')[0];
      const fileName = `diario_ai_backup_${date}.json.gz`;

      // Approccio ibrido: usa 'pako' su mobile per evitare bug, altrimenti usa l'API nativa più veloce.
      if (Capacitor.isNativePlatform()) {
        console.log("Piattaforma nativa: compressione con pako.js");
        const compressedData = gzip(new TextEncoder().encode(jsonString));
        blob = new Blob([compressedData], { type: 'application/gzip' });
      } else {
        console.log("Piattaforma web: compressione con CompressionStream API");
        const stream = new Blob([jsonString]).stream();
        const compressedStream = stream.pipeThrough(new CompressionStream('gzip'));
        const compressedResponse = new Response(compressedStream);
        blob = await compressedResponse.blob();
      }

      if (Capacitor.isNativePlatform()) {
        const base64data = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = (error) => reject(error);
            reader.readAsDataURL(blob);
        });

        await Filesystem.writeFile({
          path: fileName,
          data: base64data,
          directory: Directory.Documents,
        });
        
        alert(`Backup salvato con successo nella cartella Documenti del dispositivo.\n\nNome file: ${fileName}`);
      } else {
        const href = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = href;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(href);
      }

    } catch (error) {
      console.error("Errore durante l'esportazione dei dati:", error);
      alert(`Si è verificato un errore durante l'esportazione: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsExporting(false);
    }
  };
  
  const handleFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportError(null);
    setIsImporting(true);

    const processFile = async (fileToProcess: File) => {
        try {
            console.log(`Inizio elaborazione file di backup: ${fileToProcess.name} (${fileToProcess.size} bytes)`);
            let jsonText: string;
            
            if (fileToProcess.name.endsWith('.gz') || fileToProcess.type === 'application/gzip' || fileToProcess.type === 'application/x-gzip') {
                if (Capacitor.isNativePlatform()) {
                    console.log("Piattaforma nativa: decompressione con pako.js");
                    const arrayBuffer = await fileToProcess.arrayBuffer();
                    const decompressedData = ungzip(new Uint8Array(arrayBuffer));
                    jsonText = new TextDecoder().decode(decompressedData);
                } else {
                    console.log("Piattaforma web: decompressione con DecompressionStream API");
                    const decompressedStream = fileToProcess.stream().pipeThrough(new DecompressionStream('gzip'));
                    jsonText = await new Response(decompressedStream).text();
                }
            } else {
                console.log("File non compresso, lettura come testo");
                jsonText = await fileToProcess.text();
            }

            console.log("Parsing JSON...");
            const parsedData = JSON.parse(jsonText);
            
            if (!parsedData || !Array.isArray(parsedData.lessons)) {
              throw new Error("Il file di backup non contiene dati validi.");
            }

            console.log(`Trovate ${parsedData.lessons.length} lezioni nel backup. Ripristino audio blobs...`);
            const restoredLessons = await Promise.all(parsedData.lessons.map(async (lesson: any) => {
                if(lesson.audioBase64 && lesson.audioMimeType) {
                    try {
                        const base64Data = lesson.audioBase64.includes(',') ? lesson.audioBase64.split(',')[1] : lesson.audioBase64;
                        const response = await fetch(`data:${lesson.audioMimeType};base64,${base64Data}`);
                        const blob = await response.blob();
                        const { audioBase64, audioMimeType, ...rest } = lesson;
                        return {...rest, audioBlob: blob};
                    } catch (e) {
                        console.error("Failed to restore audio blob for lesson", lesson.id, e);
                        const { audioBase64, audioMimeType, ...rest } = lesson;
                        return rest;
                    }
                }
                return lesson;
            }));

            const restoredData = {
              ...parsedData,
              events: parsedData.events || [],
              quizzes: parsedData.quizzes || [],
              lessons: restoredLessons
            };
            
            console.log("Dati di backup pronti per l'importazione.");
            setDataToImport(restoredData);
            setIsConfirmImportOpen(true);
        } catch (error) {
            console.error("Errore durante la lettura del file di backup:", error);
            setImportError(`File non valido. Assicurati che sia un backup corretto. Dettagli: ${error instanceof Error ? error.message : String(error)}`);
            setIsImporting(false);
        }
    };

    processFile(file);
    event.target.value = '';
  };

  const handleConfirmImport = async () => {
    if (!dataToImport) return;
    setIsConfirmImportOpen(false);
    
    try {
      console.log("Inizio importazione dati nel database...");
      await storageService.importData(dataToImport);
      console.log("Importazione completata con successo nel database.");
      alert("Dati importati con successo!");
      await reloadData(true);
      console.log("Dati ricaricati nell'applicazione.");
    } catch (error) {
      console.error("Errore durante l'importazione dei dati:", error);
      setImportError(`Si è verificato un errore durante l'importazione: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsImporting(false);
    }
  };

  const handleDeleteAllData = async () => {
    setIsDeleting(true);
    setDeletionMessage('Eliminazione di tutti i dati in corso...');
    try {
      await storageService.deleteDatabase();
      localStorage.clear();
      setDeletionMessage("Dati eliminati con successo. L'applicazione si ricaricherà a breve.");
      window.location.reload();
    } catch (error) {
      console.error("Errore durante l'eliminazione dei dati:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      setDeletionMessage(`Si è verificato un errore: ${errorMessage}. Per favore, ricarica la pagina manualmente.`);
      setIsDeleting(false);
    }
  };
  
  const handleConfirmDeleteAll = () => {
    setIsConfirmDeleteAllOpen(false);
    handleDeleteAllData();
  };

  return (
    <div className="p-4">
      <ExportModal 
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        onExport={handleExportData}
        isExporting={isExporting}
      />
      {isDeleting && (
        <div className="fixed inset-0 bg-white bg-opacity-95 dark:bg-slate-900 dark:bg-opacity-95 flex flex-col justify-center items-center z-[200] text-center p-4">
          <i className="fas fa-spinner fa-spin text-4xl text-indigo-600 mb-4"></i>
          <p className="text-slate-800 dark:text-slate-100 font-bold text-xl">{deletionMessage}</p>
        </div>
      )}
      <div className="bg-white dark:bg-slate-800 p-8 rounded-lg shadow-xl max-w-2xl mx-auto">
        <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-100 mb-6">Impostazioni</h2>

        <div className="space-y-8">
            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">Configurazione API</h3>
                <label htmlFor="api-key-input" className="block text-sm font-semibold text-slate-700 dark:text-slate-200">Chiave API Gemini</label>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">La tua chiave API viene salvata solo sul tuo dispositivo e non viene mai condivisa.</p>
                <div className="relative">
                    <input 
                        id="api-key-input"
                        type={showApiKey ? "text" : "password"}
                        value={settings.apiKey || ''}
                        onChange={e => setSettings({ apiKey: e.target.value })}
                        placeholder="Inserisci la tua chiave API di Gemini"
                        className="w-full p-3 pr-10 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500"
                    />
                    <button
                        type="button"
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute inset-y-0 right-0 px-3 flex items-center text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400"
                        aria-label={showApiKey ? "Nascondi chiave API" : "Mostra chiave API"}
                    >
                        <i className={`fas ${showApiKey ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                    </button>
                </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">Stato Servizi AI</h3>
                <QuotaResetTimer />
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
              <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">Aspetto</h3>
              <div className="flex items-center justify-between">
                  <label htmlFor="theme-toggle" className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                      Modalità Notte
                  </label>
                  <button
                      id="theme-toggle"
                      onClick={() => setSettings({ theme: settings.theme === 'light' ? 'dark' : 'light' })}
                      className={`relative inline-flex items-center h-7 w-12 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 focus:ring-offset-slate-50 dark:focus:ring-offset-slate-800 ${settings.theme === 'dark' ? 'bg-indigo-600' : 'bg-slate-300'}`}
                  >
                      <span className="sr-only">Attiva modalità notte</span>
                      <span className={`inline-flex items-center justify-center h-5 w-5 transform bg-white rounded-full transition-transform text-yellow-400 ${settings.theme === 'dark' ? 'translate-x-6 text-indigo-200' : 'translate-x-1'}`}>
                          <i className={`fas ${settings.theme === 'dark' ? 'fa-moon' : 'fa-sun'}`}></i>
                      </span>
                  </button>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">Modelli IA</h3>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="transcription-model-select" className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Modello per Trascrizione</label>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">Modello per convertire l'audio in testo. Flash è veloce e raccomandato per la maggior parte dei casi.</p>
                    <select 
                        id="transcription-model-select"
                        value={settings.transcriptionModel}
                        onChange={e => setSettings({ transcriptionModel: e.target.value as GeminiModel })}
                        className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500"
                    >
                        {(Object.keys(GeminiModelNames) as Array<keyof typeof GeminiModelNames>).map((key) => (
                            <option key={key} value={key}>{GeminiModelNames[key]}</option>
                        ))}
                    </select>
                  </div>
                   <div>
                    <label htmlFor="analysis-model-select" className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Modello per Analisi</label>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">Modello per riassunti, quiz e piani di studio. Pro è più potente, ma più lento e costoso.</p>
                    <select 
                        id="analysis-model-select"
                        value={settings.analysisModel}
                        onChange={e => setSettings({ analysisModel: e.target.value as GeminiModel })}
                        className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500"
                    >
                        {(Object.keys(GeminiModelNames) as Array<keyof typeof GeminiModelNames>).map((key) => (
                            <option key={key} value={key}>{GeminiModelNames[key]}</option>
                        ))}
                    </select>
                  </div>
                </div>
            </div>
            
            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
              <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">Backup e Ripristino Dati</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Esporta i dati in un file compresso per il backup o per trasferirli. Importa un file per ripristinare.</p>
              <div className="flex flex-col sm:flex-row gap-4">
                  <button
                      onClick={() => setIsExportModalOpen(true)}
                      disabled={isExporting}
                      className="w-full sm:w-auto flex-1 inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                  >
                      {isExporting ? <i className="fas fa-spinner fa-spin mr-2"></i> : <i className="fas fa-file-export mr-2"></i>}
                      Esporta Dati...
                  </button>
                  <input type="file" accept=".json,.json.gz,.gz,application/json,application/gzip,application/x-gzip,application/octet-stream" ref={fileInputRef} onChange={handleFileSelected} className="hidden" />
                  <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isImporting}
                      className="w-full sm:w-auto flex-1 inline-flex justify-center items-center px-4 py-2 border border-gray-300 dark:border-slate-600 text-sm font-medium rounded-md text-gray-700 dark:text-slate-200 bg-white dark:bg-slate-700 hover:bg-gray-50 dark:hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                  >
                      {isImporting ? <i className="fas fa-spinner fa-spin mr-2"></i> : <i className="fas fa-file-import mr-2"></i>}
                      Importa da File...
                  </button>
              </div>
              {importError && <p className="text-red-500 dark:text-red-400 text-sm mt-3">{importError}</p>}
            </div>

            <div>
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-4">Gestione Dati</h3>
                <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
                    <div className="text-sm">
                        <p className="font-semibold text-slate-700 dark:text-slate-200">Spazio Occupato</p>
                        <p className="text-slate-500 dark:text-slate-400">Spazio utilizzato dai dati locali (lezioni, audio, ecc.).</p>
                    </div>
                    <div className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                        {storageUsage === null ? 'Calcolo...' : storageUsage}
                    </div>
                </div>
                <div className="mt-6 p-4 border border-red-300 bg-red-50 dark:border-red-500/30 dark:bg-red-900/20 rounded-lg">
                    <h4 className="font-bold text-red-800 dark:text-red-300 flex items-center"><i className="fas fa-exclamation-triangle mr-2"></i>Zona Pericolosa</h4>
                    <p className="text-sm text-red-700 dark:text-red-400 mt-1 mb-3">L'eliminazione di tutti i dati è un'azione permanente e non può essere annullata. Verranno cancellate tutte le lezioni, gli eventi e i quiz.</p>
                    <button 
                    onClick={() => setIsConfirmDeleteAllOpen(true)}
                    className="w-full bg-red-600 text-white font-bold py-2 px-4 rounded-lg shadow-md hover:bg-red-700 transition-colors flex items-center justify-center"
                    >
                    <i className="fas fa-trash-alt mr-2"></i>
                    Elimina Tutti i Dati dell'App
                    </button>
                </div>
            </div>
        </div>
      </div>
       <ConfirmationModal
        isOpen={isConfirmDeleteAllOpen}
        title="Eliminare tutti i dati?"
        message={
          <>
            <p className="font-semibold">Sei assolutamente sicuro?</p>
            <p className="mt-2">Questa azione è <strong>IRREVERSIBILE</strong> e cancellerà tutte le lezioni, gli eventi, i quiz e le impostazioni salvate.</p>
          </>
        }
        confirmText="Sì, elimina tutto"
        onConfirm={handleConfirmDeleteAll}
        onCancel={() => setIsConfirmDeleteAllOpen(false)}
      />
      <ConfirmationModal
        isOpen={isConfirmImportOpen}
        title="Importare i dati dal backup?"
        message={
            <>
                <p className="font-semibold">Sei sicuro di voler procedere?</p>
                <p className="mt-2">Questa azione <strong>SOVRASCRIVERÀ</strong> tutti i dati attualmente presenti nell'applicazione con quelli del file di backup.</p>
                <p className="mt-2 text-sm text-orange-600 dark:text-orange-400">Si consiglia di effettuare un backup dei dati correnti prima di importare.</p>
            </>
        }
        confirmText="Sì, importa e sovrascrivi"
        onConfirm={handleConfirmImport}
        onCancel={() => {
          setIsConfirmImportOpen(false);
          setIsImporting(false);
        }}
       />
    </div>
  );
};

export default SettingsView;