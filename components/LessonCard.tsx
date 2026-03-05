
import React, { useContext } from 'react';
import { Lesson, LessonStatus, BackendJobState } from '../types';
import { AppContext } from '../App';

const LessonCard: React.FC<{ 
    lesson: Lesson; 
    lessonNumber: number;
    onClick: () => void; 
}> = ({ lesson, lessonNumber, onClick }) => {
  const { processingState, uploadProgress } = useContext(AppContext);
  const isProcessing = !!processingState[lesson.id];
  const progress = uploadProgress[lesson.id];
  const isUploadingWithProgress = lesson.status === LessonStatus.Uploading && progress !== undefined && progress < 100;

  const getBackendStatusText = (status: BackendJobState | undefined) => {
    switch(status) {
        case BackendJobState.Pending: return 'In Coda';
        case BackendJobState.Running: return 'In Esecuzione';
        case BackendJobState.Cancelled: return 'Annullato';
        case BackendJobState.Expired: return 'Scaduto';
        case BackendJobState.Failed: return 'Fallito';
        default: return 'In elaborazione remota';
    }
  }

  const getStatusChip = (status: LessonStatus) => {
    switch(status) {
        case LessonStatus.Recorded: return <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">Pronta</span>;
        case LessonStatus.Uploading: return <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200 animate-pulse"><i className="fas fa-cloud-upload-alt mr-1"></i>Caricamento...</span>;
        case LessonStatus.Processing: return <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 animate-pulse"><i className="fas fa-cog fa-spin mr-1"></i>In elaborazione...</span>;
        case LessonStatus.ProcessingBackend: return <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200 animate-pulse"><i className="fas fa-cloud mr-1"></i>{getBackendStatusText(lesson.backendJobStatus)}</span>;
        case LessonStatus.PendingTopic: return <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">Da confermare</span>;
        case LessonStatus.Completed: return <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Completata</span>;
        case LessonStatus.Error:
            if (lesson.backendJobStatus === BackendJobState.Expired) {
                return <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">Scaduto</span>;
            }
            return <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">Errore</span>;
        case LessonStatus.Cancelled: return <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-200">Annullato</span>;
        default: return null;
    }
  };

  return (
    <div 
        className="bg-white dark:bg-slate-800 rounded-lg shadow-md overflow-hidden transition-all duration-300 ease-in-out hover:shadow-xl hover:-translate-y-1 cursor-pointer"
        onClick={onClick}
    >
        <div className="p-4">
            <div className="flex justify-between items-start gap-4">
                <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-1">
                        <p className="text-sm text-slate-500 dark:text-slate-400">{new Date(lesson.date).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                         {isProcessing ? 
                            <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 animate-pulse">In elaborazione...</span> : 
                            isUploadingWithProgress ?
                            <span className="text-xs font-medium text-cyan-800 dark:text-cyan-200">Caricamento {Math.round(progress)}%</span> :
                            getStatusChip(lesson.status)
                         }
                    </div>
                    
                    {lessonNumber > 0 && (
                        <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-300 bg-indigo-100 dark:bg-slate-700 px-2 py-0.5 rounded-md mt-1 inline-block">LEZIONE #{lessonNumber}</span>
                    )}
                    
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mt-2 break-words">{lesson.topic || lesson.suggestedTopic || 'Argomento non definito'}</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 truncate mt-1">{lesson.subject}{lesson.subfolder ? ` / ${lesson.subfolder}` : ''}</p>
                    
                    {isUploadingWithProgress && (
                        <div className="w-full bg-slate-200 dark:bg-slate-600 rounded-full h-1.5 mt-2">
                            <div className="bg-cyan-500 h-1.5 rounded-full transition-all duration-300 ease-linear" style={{ width: `${progress}%` }}></div>
                        </div>
                    )}
                </div>
                <div className="flex-shrink-0 self-center pl-2">
                     <i className="fas fa-chevron-right text-slate-400 dark:text-slate-500"></i>
                </div>
            </div>
        </div>
    </div>
  );
};

export default LessonCard;
