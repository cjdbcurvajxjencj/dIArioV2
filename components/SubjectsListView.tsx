

import React, { useContext, useMemo, useState } from 'react';
import { AppContext } from '../App';
import ConfirmationModal from './ConfirmationModal';

const SubjectsListView: React.FC<{ onSelectSubject: (subject: string) => void }> = ({ onSelectSubject }) => {
    const { lessonsBySubject, deleteSubject } = useContext(AppContext);
    const [subjectToDelete, setSubjectToDelete] = useState<string | null>(null);
    
    const subjectsWithCount = useMemo(() => {
        return Object.entries(lessonsBySubject)
            .map(([subject, lessonsInSubject]) => ([subject, (lessonsInSubject as any[]).length] as const))
            .sort((a, b) => a[0].localeCompare(b[0]));
    }, [lessonsBySubject]);

    const handleDeleteConfirm = async () => {
        if (subjectToDelete) {
            await deleteSubject(subjectToDelete);
            setSubjectToDelete(null);
        }
    };

    return (
        <div>
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-6">Materie</h2>
        {subjectsWithCount.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {subjectsWithCount.map(([subject, count], index) => (
                <div 
                key={subject} 
                className="relative bg-white dark:bg-slate-800 p-6 rounded-lg shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300 ease-in-out flex flex-col animate-fade-in group"
                style={{ animationDelay: `${index * 50}ms`, opacity: 0 }}
                >
                <button 
                    onClick={() => onSelectSubject(subject)}
                    className="flex-grow text-left"
                >
                    <i className="fas fa-book-open text-3xl text-indigo-500 mb-4"></i>
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 truncate pr-8">{subject}</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">{count} {count === 1 ? 'lezione' : 'lezioni'}</p>
                </button>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        setSubjectToDelete(subject);
                    }}
                    className="absolute top-4 right-4 text-slate-400 hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                    aria-label={`Elimina materia ${subject}`}
                >
                    <i className="fas fa-trash-alt"></i>
                </button>
                </div>
            ))}
            </div>
        ) : (
            <div className="text-center py-10 px-6 bg-white dark:bg-slate-800 rounded-lg shadow-md">
                <i className="fas fa-microphone-slash text-4xl text-slate-300 dark:text-slate-600 mb-4"></i>
                <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-200">Nessuna lezione trovata.</h3>
                <p className="text-slate-500 dark:text-slate-400 mt-1">Inizia registrando o caricando la tua prima lezione!</p>
            </div>
        )}
        <ConfirmationModal
            isOpen={!!subjectToDelete}
            title="Eliminare la materia?"
            message={
                <>
                    <p>Sei sicuro di voler eliminare la materia <strong>"{subjectToDelete}"</strong>?</p>
                    <p className="mt-2 text-red-600 dark:text-red-400 font-semibold">Attenzione: verranno eliminate anche tutte le lezioni e i quiz associati a questa materia. L'azione non può essere annullata.</p>
                </>
            }
            confirmText="Elimina Materia"
            onConfirm={handleDeleteConfirm}
            onCancel={() => setSubjectToDelete(null)}
        />
        </div>
    );
};

export default SubjectsListView;