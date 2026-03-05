

import React, { useState, useContext, useMemo, useRef, useLayoutEffect, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AppContext } from '../App';
import { Lesson } from '../types';
import LessonCard from './LessonCard';
import ConfirmationModal from './ConfirmationModal';

const LessonsForSubjectView: React.FC<{ subject: string; onBack: () => void; onSelectLesson: (lessonId: string) => void }> = ({ subject, onBack, onSelectLesson }) => {
    const { lessonsBySubject, updateLessonsOrder, deleteSubfolder } = useContext(AppContext);
    
    const [selectedSubfolder, setSelectedSubfolder] = useState<string | null>(null);
    const [subfolderToDelete, setSubfolderToDelete] = useState<string | null>(null);

    // Reorder state
    const [isReorderMode, setIsReorderMode] = useState(false);
    const [lessonsInReorder, setLessonsInReorder] = useState<Lesson[]>([]);
    const [isSavingOrder, setIsSavingOrder] = useState(false);
    
    // Drag & Drop State
    const [draggedLessonId, setDraggedLessonId] = useState<string | null>(null);
    const [ghost, setGhost] = useState<{
        content: React.ReactElement;
        x: number;
        y: number;
        width: number;
        height: number;
    } | null>(null);

    // Refs for drag & drop animation
    const listRef = useRef<HTMLDivElement>(null);
    const prevRects = useRef<Map<string, DOMRect>>(new Map());
    const dragState = useRef<{
      index: number;
      pointerId: number;
      pointerOffset: { x: number; y: number };
    } | null>(null);


    const subjectLessons = useMemo(() => lessonsBySubject[subject] || [], [lessonsBySubject, subject]);

    const { subfolders, rootLessons } = useMemo(() => {
        const subfoldersMap = new Map<string, Lesson[]>();
        const rootLessons: Lesson[] = [];
        for (const lesson of subjectLessons) {
            if (lesson.subfolder) {
                if (!subfoldersMap.has(lesson.subfolder)) subfoldersMap.set(lesson.subfolder, []);
                subfoldersMap.get(lesson.subfolder)!.push(lesson);
            } else {
                rootLessons.push(lesson);
            }
        }
        const subfoldersArr = Array.from(subfoldersMap.entries())
            .map(([name, lessons]) => ({ name, lessons, count: lessons.length }))
            .sort((a, b) => a.name.localeCompare(b.name));
        return { subfolders: subfoldersArr, rootLessons };
    }, [subjectLessons]);
    
    const lessonsSource = useMemo(() => {
        return selectedSubfolder ? (subfolders.find(s => s.name === selectedSubfolder)?.lessons || []) : rootLessons;
    }, [selectedSubfolder, subfolders, rootLessons]);
    
    const [sortBy, setSortBy] = useState<'ascending' | 'descending'>('ascending');
    
    useEffect(() => {
        // Ogni volta che la sorgente delle lezioni cambia (es. cambiando sottocartella),
        // ripristina l'ordinamento ascendente come predefinito.
        setSortBy('ascending');
    }, [selectedSubfolder]);

    const sortedLessons = useMemo(() => {
      let lessons = [...lessonsSource];
      if (sortBy === 'descending') {
          // L'ordinamento decrescente si basa sulla proprietà 'order' persistente.
          lessons.sort((a, b) => (b.order ?? -Infinity) - (a.order ?? -Infinity));
      } else { // 'ascending'
          // L'ordinamento crescente si basa sulla proprietà 'order' persistente.
          lessons.sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));
      }
      return lessons;
    }, [lessonsSource, sortBy]);


    const headerTitle = selectedSubfolder ? `${subject} / ${selectedSubfolder}` : subject;
    
    const handleEnterReorderMode = () => {
        // Inizia sempre il riordino dalla vista canonica (ascendente per numero)
        // per fornire una base stabile e prevenire confusione.
        const lessonsInCanonicalOrder = [...lessonsSource].sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));
        setLessonsInReorder(lessonsInCanonicalOrder);
        setIsReorderMode(true);
    };

    const handleCancelReorder = () => {
        setIsReorderMode(false);
        setLessonsInReorder([]);
    };

    const handleSaveReorder = async () => {
        setIsSavingOrder(true);
        // I numeri sono basati su 1
        const lessonsToUpdate = lessonsInReorder.map((lesson, index) => ({
            id: lesson.id,
            order: index + 1
        }));
        try {
            await updateLessonsOrder(lessonsToUpdate);
            setSortBy('ascending'); // Torna alla visualizzazione ascendente dopo aver salvato
        } catch (e) {
            console.error(e);
        } finally {
            setIsReorderMode(false);
            setIsSavingOrder(false);
        }
    };
    
    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>, lesson: Lesson, index: number) => {
        if (e.button !== 0) return; 
        const element = e.currentTarget;
        element.setPointerCapture(e.pointerId);
        const rect = element.getBoundingClientRect();

        prevRects.current.clear();
        const children = Array.from(listRef.current!.children) as HTMLElement[];
        children.forEach(child => {
            const lessonId = child.dataset.lessonid;
            if (lessonId) prevRects.current.set(lessonId, child.getBoundingClientRect());
        });

        dragState.current = {
            index,
            pointerId: e.pointerId,
            pointerOffset: { x: e.clientX - rect.left, y: e.clientY - rect.top },
        };
        
        setGhost({
            content: (
                <div className="flex items-center bg-white dark:bg-slate-800 p-4 rounded-lg shadow-md border-l-4 border-indigo-500">
                    <i className="fas fa-grip-vertical text-slate-400 dark:text-slate-500 mr-3"></i>
                    <span className="font-mono font-bold text-slate-500 dark:text-slate-400 text-lg w-8 text-center">{index + 1}.</span>
                    <div className="flex-1 min-w-0 ml-3">
                        <h4 className="font-bold text-slate-800 dark:text-slate-100 truncate">{lesson.topic || lesson.suggestedTopic || 'Argomento non definito'}</h4>
                        <p className="text-sm text-slate-500 dark:text-slate-400">{new Date(lesson.date).toLocaleDateString()}</p>
                    </div>
                </div>
            ),
            x: e.clientX - dragState.current.pointerOffset.x,
            y: e.clientY - dragState.current.pointerOffset.y,
            width: rect.width,
            height: rect.height,
        });
        
        setDraggedLessonId(lesson.id);
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!dragState.current || !listRef.current || !ghost) return;

        const { pointerOffset, index: dragIndex } = dragState.current;
        
        // Update ghost visual position
        setGhost(g => g ? ({ ...g, x: e.clientX - pointerOffset.x, y: e.clientY - pointerOffset.y }) : null);

        // Find what's under the pointer. The ghost has `pointer-events: none`, so this will see through it.
        const elementUnderPointer = document.elementFromPoint(e.clientX, e.clientY);
        if (!elementUnderPointer) return;

        // Find the closest list item that is a valid drop target
        const dropTargetElement = elementUnderPointer.closest('.reorder-item[data-lessonid]');
        
        // If we are not over a valid target, do nothing.
        if (!dropTargetElement) {
            return;
        }

        const dropTargetId = (dropTargetElement as HTMLElement).dataset.lessonid;
        
        const children = Array.from(listRef.current.children);
        const targetIndex = children.findIndex(child => (child as HTMLElement).dataset.lessonid === dropTargetId);
        
        // If the target is valid and different from the current drag index, update the order
        if (targetIndex !== -1 && targetIndex !== dragIndex) {
            setLessonsInReorder(currentLessons => {
                const newOrder = [...currentLessons];
                const [removed] = newOrder.splice(dragIndex, 1);
                newOrder.splice(targetIndex, 0, removed);

                if (dragState.current) dragState.current.index = targetIndex;
                
                return newOrder;
            });
        }
    };


    const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!dragState.current) return;
        try { e.currentTarget.releasePointerCapture(dragState.current.pointerId); } catch (error) { console.warn("Could not release pointer capture:", error); }
        dragState.current = null;
        setGhost(null);
        setDraggedLessonId(null);
    };

    useLayoutEffect(() => {
        if (!listRef.current || prevRects.current.size === 0 || !draggedLessonId) return;
        
        const children = Array.from(listRef.current.children) as HTMLElement[];
        
        children.forEach(child => {
            const lessonId = child.dataset.lessonid;
            if (!lessonId) return;
            
            const prevRect = prevRects.current.get(lessonId);
            if (!prevRect) return;
            
            const newRect = child.getBoundingClientRect();
            const deltaY = prevRect.top - newRect.top;

            if (deltaY !== 0) {
                requestAnimationFrame(() => {
                    child.style.transform = `translateY(${deltaY}px)`;
                    child.style.transition = 'transform 0s';

                    requestAnimationFrame(() => {
                        child.style.transform = '';
                        child.style.transition = 'transform 0.3s cubic-bezier(0.2, 0, 0, 1)';
                    });
                });
            }
        });
        prevRects.current.clear();
    }, [lessonsInReorder, draggedLessonId]);


    const handleDeleteSubfolderConfirm = async () => {
        if (subfolderToDelete) {
            await deleteSubfolder(subject, subfolderToDelete);
            setSubfolderToDelete(null);
        }
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-4 flex-wrap gap-4">
                <button onClick={onBack} disabled={isReorderMode} className="text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" aria-label="Torna alle materie">
                    <i className="fas fa-arrow-left fa-lg"></i>
                </button>
                {isReorderMode ? (
                    <div className="flex items-center space-x-2">
                        <button onClick={handleCancelReorder} className="px-4 py-2 text-sm font-semibold rounded-lg text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-600 hover:bg-slate-200 dark:hover:bg-slate-500 transition-colors">Annulla</button>
                        <button onClick={handleSaveReorder} disabled={isSavingOrder} className="px-4 py-2 text-sm font-semibold rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 transition-colors disabled:bg-slate-400 dark:disabled:bg-slate-500 disabled:cursor-wait flex items-center">
                          {isSavingOrder && <i className="fas fa-spinner fa-spin mr-2"></i>}
                          Salva Ordine
                        </button>
                    </div>
                ) : (
                    <div className="flex items-center flex-wrap gap-x-4 gap-y-2">
                        <button onClick={handleEnterReorderMode} className="px-3 py-2 text-sm font-medium rounded-lg text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors">
                            <i className="fas fa-sort mr-2"></i>Riordina
                        </button>
                        <div className="flex items-center space-x-2">
                            <label htmlFor="sort-by" className="text-sm font-medium text-slate-600 dark:text-slate-300">Ordina per:</label>
                            <select id="sort-by" value={sortBy} onChange={e => setSortBy(e.target.value as any)} className="p-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-indigo-500">
                                <option value="ascending">Meno recente</option>
                                <option value="descending">Più recente</option>
                            </select>
                        </div>
                    </div>
                )}
            </div>
            
            <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-100 break-words mb-6">{headerTitle}</h2>

            {selectedSubfolder && (
              <button onClick={() => setSelectedSubfolder(null)} disabled={isReorderMode} className="mb-6 flex items-center text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-50 disabled:cursor-not-allowed">
                  <i className="fas fa-arrow-left mr-2"></i> Torna a "{subject}"
              </button>
            )}

            {!selectedSubfolder && subfolders.length > 0 && (
              <>
                <h3 className="text-xl font-semibold text-slate-700 dark:text-slate-200 mb-4">Sottocartelle</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 mb-8">
                  {subfolders.map(sf => (
                    <div key={sf.name} className="relative bg-white dark:bg-slate-800 p-4 rounded-lg shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300 ease-in-out flex flex-col group">
                      <button 
                        onClick={() => setSelectedSubfolder(sf.name)} 
                        disabled={isReorderMode} 
                        className="flex-grow text-left flex items-center gap-4 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        <i className="fas fa-folder text-3xl text-amber-500"></i>
                        <div className="flex-1">
                          <h4 className="font-bold text-slate-800 dark:text-slate-100 truncate pr-8">{sf.name}</h4>
                          <p className="text-sm text-slate-500 dark:text-slate-400">{sf.count} {sf.count === 1 ? 'lezione' : 'lezioni'}</p>
                        </div>
                      </button>
                      <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setSubfolderToDelete(sf.name);
                        }}
                        disabled={isReorderMode}
                        className="absolute top-4 right-4 text-slate-400 hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 disabled:opacity-0"
                        aria-label={`Elimina sottocartella ${sf.name}`}
                      >
                        <i className="fas fa-trash-alt"></i>
                      </button>
                    </div>
                  ))}
                </div>
                {(rootLessons.length > 0) && <hr className="my-8 border-slate-200 dark:border-slate-700"/>}
              </>
            )}
            
            {isReorderMode ? (
                <>
                    <div
                        ref={listRef}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onPointerCancel={handlePointerUp}
                        className="space-y-3 animate-fade-in"
                    >
                        {lessonsInReorder.map((lesson, index) => {
                            const isDragged = draggedLessonId === lesson.id;
                            return (
                                <div
                                    key={lesson.id}
                                    data-lessonid={lesson.id}
                                    onPointerDown={(e) => handlePointerDown(e, lesson, index)}
                                    className={`flex items-center bg-white dark:bg-slate-800 p-4 rounded-lg shadow-md cursor-grab active:cursor-grabbing border-l-4 border-indigo-500 reorder-item ${isDragged ? 'reorder-placeholder' : ''}`}
                                    style={{ height: ghost && isDragged ? `${ghost.height}px` : undefined }}
                                >
                                    <i className="fas fa-grip-vertical text-slate-400 dark:text-slate-500 mr-3"></i>
                                    <span className="font-mono font-bold text-slate-500 dark:text-slate-400 text-lg w-8 text-center">{index + 1}.</span>
                                    <div className="flex-1 min-w-0 ml-3">
                                        <h4 className="font-bold text-slate-800 dark:text-slate-100 truncate">{lesson.topic || lesson.suggestedTopic || 'Argomento non definito'}</h4>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">{new Date(lesson.date).toLocaleDateString()}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    {ghost && createPortal(
                        <div
                            className="dragging-item"
                            style={{
                                position: 'fixed',
                                top: 0,
                                left: 0,
                                width: ghost.width,
                                height: ghost.height,
                                transform: `translate(${ghost.x}px, ${ghost.y}px)`,
                            }}
                        >
                            {ghost.content}
                        </div>,
                        document.body
                    )}
                </>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {sortedLessons.map((lesson) => (
                      <LessonCard
                        key={lesson.id}
                        lesson={lesson}
                        lessonNumber={lesson.order || 0}
                        onClick={() => onSelectLesson(lesson.id)}
                      />
                    ))}
                </div>
            )}
            <ConfirmationModal
                isOpen={!!subfolderToDelete}
                title="Eliminare la sottocartella?"
                message={
                    <>
                        <p>Sei sicuro di voler eliminare la sottocartella <strong>"{subfolderToDelete}"</strong>?</p>
                        <p className="mt-2 text-red-600 dark:text-red-400 font-semibold">Attenzione: verranno eliminate anche tutte le lezioni e i quiz associati a questa sottocartella. L'azione non può essere annullata.</p>
                    </>
                }
                confirmText="Elimina Sottocartella"
                onConfirm={handleDeleteSubfolderConfirm}
                onCancel={() => setSubfolderToDelete(null)}
            />
        </div>
    );
};

export default LessonsForSubjectView;