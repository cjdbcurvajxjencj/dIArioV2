import React, { useRef, useEffect, useState } from 'react';
import { Lesson, LessonStatus } from '../../types';
import { stripFormatting } from '../../utils/helpers';

interface LessonHeaderProps {
    lesson: Lesson;
    isEditing: boolean;
    editableSubject: string;
    editableTopic: string;
    editableSubfolder: string;
    setEditableSubject: (val: string) => void;
    setEditableTopic: (val: string) => void;
    setEditableSubfolder: (val: string) => void;
    onBack: () => void;
    onEnterEditMode: () => void;
    onSaveEdit: () => void;
    onCancelEdit: () => void;
    onDeleteClick: () => void;
    onToggleSearch: () => void;
}

const LessonHeader: React.FC<LessonHeaderProps> = ({
    lesson,
    isEditing,
    editableSubject,
    editableTopic,
    editableSubfolder,
    setEditableSubject,
    setEditableTopic,
    setEditableSubfolder,
    onBack,
    onEnterEditMode,
    onSaveEdit,
    onCancelEdit,
    onDeleteClick,
    onToggleSearch
}) => {
    const [isCopyMenuOpen, setIsCopyMenuOpen] = useState(false);
    const [copySuccessMessage, setCopySuccessMessage] = useState('');
    const copyMenuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (copyMenuRef.current && !copyMenuRef.current.contains(event.target as Node)) {
                setIsCopyMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleCopy = (type: 'summary' | 'transcript', format: 'formatted' | 'raw') => {
        const textToCopySource = type === 'summary' ? lesson.summary : lesson.transcript;
        const textToCopy = format === 'raw' ? stripFormatting(textToCopySource || '') : textToCopySource;
        
        const successMsg = `${type === 'summary' ? 'Riassunto copiato' : 'Trascrizione copiata'}${format === 'raw' ? ' (testo semplice)' : ''}!`;
        
        if (!textToCopy) {
            alert("Contenuto non disponibile per la copia."); return;
        }
        navigator.clipboard.writeText(textToCopy).then(() => {
            setCopySuccessMessage(successMsg);
            setIsCopyMenuOpen(false);
            setTimeout(() => setCopySuccessMessage(''), 2500);
        }, (err) => {
            console.error('Could not copy text: ', err);
            alert("Impossibile copiare il testo.");
        });
    };

    return (
        <>
            <div className="flex justify-between items-center mb-4">
                <button onClick={onBack} className="flex items-center text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                    <i className="fas fa-chevron-left mr-2"></i>
                    Tutte le lezioni
                </button>
            </div>

            <div className="border-b border-slate-200 dark:border-slate-700 pb-4 mb-4">
                <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">{lesson.subject}{lesson.subfolder ? ` / ${lesson.subfolder}` : ''}</p>
                <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100 break-words">{lesson.topic || 'Dettagli Lezione'}</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{new Date(lesson.date).toLocaleString('it-IT')}</p>
            </div>
            
            {/* Action Bar for Completed Lesson */}
            {!isEditing && lesson.status === LessonStatus.Completed && (
                 <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-4">
                     <button onClick={onEnterEditMode} className="flex items-center text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors" aria-label="Modifica">
                         <i className="fas fa-pencil-alt mr-1.5"></i>Modifica
                     </button>
                      <button onClick={onToggleSearch} className="flex items-center text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors" aria-label="Cerca nel testo">
                        <i className="fas fa-search mr-1.5"></i>Cerca
                    </button>
                     <div className="relative" ref={copyMenuRef}>
                         <button onClick={() => setIsCopyMenuOpen(prev => !prev)} className="flex items-center text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors" aria-label="Copia contenuto">
                             <i className={`fas ${copySuccessMessage ? 'fa-check text-green-500' : 'fa-copy'} w-4 text-center transition-all`}></i>
                             <span className="ml-1.5">{copySuccessMessage || 'Copia'}</span>
                         </button>
                         {isCopyMenuOpen && (
                             <div className="absolute left-0 mt-2 w-56 bg-white dark:bg-slate-700 rounded-md shadow-lg z-20 border border-slate-200 dark:border-slate-600 py-1 animate-pop-in">
                                 <div className="px-4 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400">Copia Riassunto</div>
                                 <button onClick={() => handleCopy('summary', 'formatted')} className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600">Formattato</button>
                                 <button onClick={() => handleCopy('summary', 'raw')} className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600">Testo semplice</button>
                                 <div className="border-t border-slate-200 dark:border-slate-600 my-1"></div>
                                 <div className="px-4 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400">Copia Trascrizione</div>
                                 <button onClick={() => handleCopy('transcript', 'formatted')} className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600">Formattato</button>
                                 <button onClick={() => handleCopy('transcript', 'raw')} className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600">Testo semplice</button>
                             </div>
                         )}
                     </div>
                     <div className="flex-grow"></div>
                     <button onClick={onDeleteClick} className="flex items-center text-sm font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors" aria-label="Elimina">
                        <i className="fas fa-trash-alt mr-1.5"></i>Elimina
                    </button>
                </div>
            )}

            {isEditing && (
                <div className="animate-fade-in mb-4">
                    <div className="space-y-4 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                        <div>
                          <label className="text-sm font-medium text-slate-600 dark:text-slate-300">Materia</label>
                          <input type="text" value={editableSubject} onChange={e => setEditableSubject(e.target.value)} className="w-full mt-1 p-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100" />
                        </div>
                        <div>
                          <label className="text-sm font-medium text-slate-600 dark:text-slate-300">Sottocartella (Opzionale)</label>
                          <input type="text" value={editableSubfolder} onChange={e => setEditableSubfolder(e.target.value)} className="w-full mt-1 p-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100" />
                        </div>
                        <div>
                          <label className="text-sm font-medium text-slate-600 dark:text-slate-300">Argomento</label>
                          <input type="text" value={editableTopic} onChange={e => setEditableTopic(e.target.value)} className="w-full mt-1 p-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100" />
                        </div>
                        <div className="flex justify-end space-x-2 pt-2">
                          <button onClick={onCancelEdit} className="px-4 py-2 rounded-lg text-slate-600 dark:text-slate-200 bg-slate-100 dark:bg-slate-600 hover:bg-slate-200 dark:hover:bg-slate-500">Annulla</button>
                          <button onClick={onSaveEdit} className="px-4 py-2 rounded-lg text-white bg-indigo-600 hover:bg-indigo-700">Salva Modifiche</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default LessonHeader;
