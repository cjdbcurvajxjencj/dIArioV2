

import React, { useState, useContext, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AppContext } from '../App';
import { CalendarEvent, EventType, expandRecurringEvents, toYYYYMMDD } from '../types';
import ConfirmationModal from './ConfirmationModal';

const DeleteRecurrenceModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onDeleteThis: () => void;
    onDeleteFuture: () => void;
    onDeleteAll: () => void;
}> = ({ isOpen, onClose, onDeleteThis, onDeleteFuture, onDeleteAll }) => {
    if (!isOpen) return null;

    const modalRoot = document.getElementById('modal-root');
    if (!modalRoot) return null;

    return createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-60 dark:bg-opacity-80 flex justify-center items-center z-[300] p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-2xl w-full max-w-md p-6 animate-pop-in" onClick={(e) => e.stopPropagation()}>
                <h3 className="text-lg leading-6 font-bold text-slate-900 dark:text-slate-100 mb-2">Modifica evento ricorrente</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Come desideri eliminare questo evento ricorrente?</p>
                <div className="space-y-3">
                    <button onClick={onDeleteThis} className="w-full text-left p-3 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                        <strong className="text-slate-800 dark:text-slate-100">Elimina solo questa occorrenza</strong>
                        <span className="text-xs block text-slate-600 dark:text-slate-300">Rimuove l'evento solo per questo giorno.</span>
                    </button>
                    <button onClick={onDeleteFuture} className="w-full text-left p-3 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                        <strong className="text-slate-800 dark:text-slate-100">Elimina questa e le occorrenze future</strong>
                        <span className="text-xs block text-slate-600 dark:text-slate-300">Rimuove questo evento e tutti quelli successivi.</span>
                    </button>
                    <button onClick={onDeleteAll} className="w-full text-left p-3 rounded-lg border border-red-300 dark:border-red-600/50 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors">
                        <strong className="text-red-700 dark:text-red-300">Elimina tutte le occorrenze</strong>
                        <span className="text-xs block text-red-600 dark:text-red-400">Rimuove l'intera serie di eventi, passati e futuri.</span>
                    </button>
                </div>
                <div className="mt-6 text-right">
                    <button onClick={onClose} className="px-4 py-2 rounded-lg text-slate-600 dark:text-slate-200 bg-slate-100 dark:bg-slate-600 hover:bg-slate-200 dark:hover:bg-slate-500 transition-colors">Annulla</button>
                </div>
            </div>
        </div>,
        modalRoot
    );
};


const EventModal: React.FC<{
    event: CalendarEvent | null;
    day: Date;
    onClose: () => void;
}> = ({ event, day, onClose }) => {
    const { addEvent, updateEvent, deleteEvent } = useContext(AppContext);
    
    const [title, setTitle] = useState(event?.title || '');
    const [date, setDate] = useState(event?.date || toYYYYMMDD(day));
    const [startTime, setStartTime] = useState(event?.startTime || '09:00');
    const [duration, setDuration] = useState(event?.duration || 60);
    const [type, setType] = useState<EventType>(event?.type || EventType.Lesson);
    const [cfu, setCfu] = useState(event?.cfu);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [isDeleteRecurrenceOpen, setIsDeleteRecurrenceOpen] = useState(false);
    
    // State for recurrence
    const [isRecurring, setIsRecurring] = useState(!!event?.recurrence);
    const [frequency, setFrequency] = useState(event?.recurrence?.frequency || 'weekly');
    const [interval, setIntervalValue] = useState(event?.recurrence?.interval || 1);
    const [endDate, setEndDate] = useState(event?.recurrence?.endDate || '');

    const isEditing = event !== null;
    
    useEffect(() => {
        if (type !== EventType.Exam) {
            setCfu(undefined);
        }
    }, [type]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if(!title || !date || !startTime) {
            alert("Per favore, compila tutti i campi obbligatori.");
            return;
        }
        if(isRecurring && !endDate) {
            alert("Per un evento ricorrente, è necessario specificare una data di fine.");
            return;
        }

        const recurrenceRule = isRecurring && endDate ? { frequency, interval: Math.max(1, interval), endDate } : undefined;
        
        const eventData = { 
            title, 
            date, 
            startTime, 
            duration, 
            type,
            cfu: type === EventType.Exam ? (cfu || undefined) : undefined,
            recurrence: recurrenceRule
        };

        if(isEditing && event) {
            // Se si sta modificando un evento ricorrente e si toglie la ricorrenza, le eccezioni non hanno più senso
            const finalEventData = !recurrenceRule ? {...eventData, exceptionDates: [] } : eventData;
            await updateEvent({ ...event, ...finalEventData });
        } else {
            await addEvent({ id: `event-${Date.now()}`, ...eventData });
        }
        onClose();
    };
    
    const handleDeleteButtonClick = () => {
        if (event?.recurrence) {
            setIsDeleteRecurrenceOpen(true);
        } else {
            setIsDeleteConfirmOpen(true);
        }
    };

    const handleDeleteThis = async () => {
        if (!event) return;
        setIsDeleteRecurrenceOpen(false);
        try {
            const dateStr = toYYYYMMDD(day);
            const updatedEvent: CalendarEvent = {
                ...event,
                exceptionDates: [...(event.exceptionDates || []), dateStr]
            };
            await updateEvent(updatedEvent);
            onClose();
        } catch (error) {
            console.error("Errore durante l'aggiornamento dell'evento:", error);
            alert("Si è verificato un errore durante la modifica dell'evento. Riprova.");
        }
    };

    const handleDeleteFuture = async () => {
        if (!event || !event.recurrence) return;
        setIsDeleteRecurrenceOpen(false);
        try {
            const prevDay = new Date(day);
            prevDay.setDate(day.getDate() - 1);
            const newEndDate = toYYYYMMDD(prevDay);

            if (newEndDate < event.date) {
                await deleteEvent(event.id);
            } else {
                const updatedEvent: CalendarEvent = {
                    ...event,
                    recurrence: {
                        ...event.recurrence,
                        endDate: newEndDate,
                    }
                };
                await updateEvent(updatedEvent);
            }
            onClose();
        } catch (error) {
            console.error("Errore durante la modifica/eliminazione dell'evento:", error);
            alert("Si è verificato un errore durante l'operazione. Riprova.");
        }
    };

    const handleDeleteAll = async () => {
        if (!event) return;
        setIsDeleteConfirmOpen(false);
        setIsDeleteRecurrenceOpen(false);
        try {
            await deleteEvent(event.id);
            onClose();
        } catch (error) {
            console.error("Errore durante l'eliminazione dell'evento:", error);
            alert("Si è verificato un errore durante l'eliminazione dell'evento. Riprova.");
        }
    };

    const inputStyles = "w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100";
    
    const modalRoot = document.getElementById('modal-root');
    if (!modalRoot) return null;

    return createPortal(
        <>
            <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-[250] p-4 animate-fade-in">
                <div className="bg-white dark:bg-slate-800 p-8 rounded-lg shadow-2xl w-full max-w-lg animate-pop-in max-h-[90vh] overflow-y-auto">
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-6">{isEditing ? 'Modifica Evento' : 'Aggiungi Evento'}</h2>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Titolo evento" className={inputStyles} />
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm font-medium text-slate-600 dark:text-slate-300">Data {isRecurring ? 'di inizio' : ''}</label>
                                <input type="date" value={date} onChange={e => setDate(e.target.value)} className={`${inputStyles} [color-scheme:dark] mt-1`} />
                            </div>
                            <div>
                               <label className="text-sm font-medium text-slate-600 dark:text-slate-300">Ora di inizio</label>
                                <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className={`${inputStyles} [color-scheme:dark] mt-1`} />
                            </div>
                        </div>
                         <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm font-medium text-slate-600 dark:text-slate-300">Durata (min)</label>
                                <input type="number" value={duration} onChange={e => setDuration(Number(e.target.value))} placeholder="Durata (min)" min="1" className={`${inputStyles} mt-1`} />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-slate-600 dark:text-slate-300">Tipo</label>
                                <select value={type} onChange={e => setType(e.target.value as EventType)} className={`${inputStyles} mt-1`}>
                                    <option value={EventType.Lesson}>Lezione</option>
                                    <option value={EventType.Study}>Sessione di Studio</option>
                                    <option value={EventType.Task}>Compito</option>
                                    <option value={EventType.Exam}>Esame</option>
                                    <option value={EventType.Personal}>Personale</option>
                                </select>
                            </div>
                        </div>
                         {type === EventType.Exam && (
                            <div className="pt-1">
                                <label htmlFor="cfu-input" className="block text-sm font-medium text-slate-700 dark:text-slate-300">CFU (Crediti Formativi)</label>
                                <input id="cfu-input" type="number" value={cfu || ''} onChange={e => setCfu(e.target.valueAsNumber > 0 ? e.target.valueAsNumber : undefined)} placeholder="Es. 9" min="1" className={`${inputStyles} mt-1`} />
                            </div>
                        )}
                        
                        {/* Recurrence Section */}
                        <div className="space-y-4 rounded-lg p-4 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600">
                            <div className="flex items-center">
                                <input type="checkbox" id="is-recurring" checked={isRecurring} onChange={e => setIsRecurring(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"/>
                                <label htmlFor="is-recurring" className="ml-3 block text-sm font-medium text-slate-700 dark:text-slate-200">Evento ricorrente</label>
                            </div>
                            {isRecurring && (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-fade-in">
                                    <div>
                                        <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Frequenza</label>
                                        <select value={frequency} onChange={e => setFrequency(e.target.value as any)} className={`${inputStyles} mt-1 text-sm p-2`}>
                                            <option value="daily">Giornaliero</option>
                                            <option value="weekly">Settimanale</option>
                                            <option value="monthly">Mensile</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Ogni</label>
                                        <input type="number" value={interval} onChange={e => setIntervalValue(Number(e.target.value))} min="1" className={`${inputStyles} mt-1 text-sm p-2`} />
                                    </div>
                                     <div>
                                        <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Fino al</label>
                                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={`${inputStyles} mt-1 text-sm p-2 [color-scheme:dark]`} />
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex justify-between items-center pt-4">
                            {isEditing && <button type="button" onClick={handleDeleteButtonClick} className="px-6 py-2 rounded-lg text-white bg-red-600 hover:bg-red-700 shadow-md transition-colors">Elimina</button>}
                            <div className="flex-grow flex justify-end space-x-4">
                                <button type="button" onClick={onClose} className="px-6 py-2 rounded-lg text-slate-600 dark:text-slate-200 bg-slate-100 dark:bg-slate-600 hover:bg-slate-200 dark:hover:bg-slate-500 transition-colors">Annulla</button>
                                <button type="submit" className="px-6 py-2 rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 shadow-md transition-colors">{isEditing ? 'Salva' : 'Aggiungi'}</button>
                            </div>
                        </div>
                    </form>
                </div>
            </div>
            
            <ConfirmationModal
                isOpen={isDeleteConfirmOpen}
                title="Conferma Eliminazione Evento"
                message={`Sei sicuro di voler eliminare l'evento "${event?.title}"?`}
                confirmText="Elimina"
                onConfirm={handleDeleteAll}
                onCancel={() => setIsDeleteConfirmOpen(false)}
            />
            <DeleteRecurrenceModal
                isOpen={isDeleteRecurrenceOpen}
                onClose={() => setIsDeleteRecurrenceOpen(false)}
                onDeleteThis={handleDeleteThis}
                onDeleteFuture={handleDeleteFuture}
                onDeleteAll={handleDeleteAll}
            />
        </>,
        modalRoot
    );
};

const getEventTypeClasses = (type: EventType) => {
    switch(type) {
        case EventType.Exam: return { dot: 'bg-red-500', border: 'border-l-red-500', text: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/20' };
        case EventType.Task: return { dot: 'bg-amber-500', border: 'border-l-amber-500', text: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20' };
        case EventType.Lesson: return { dot: 'bg-blue-500', border: 'border-l-blue-500', text: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' };
        case EventType.Study: return { dot: 'bg-teal-500', border: 'border-l-teal-500', text: 'text-teal-600', bg: 'bg-teal-50 dark:bg-teal-900/20' };
        case EventType.Personal: return { dot: 'bg-green-500', border: 'border-l-green-500', text: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/20' };
        default: return { dot: 'bg-slate-400', border: 'border-l-slate-400', text: 'text-slate-600', bg: 'bg-slate-50 dark:bg-slate-700/50' };
    }
}

const CalendarView: React.FC = () => {
    const { events } = useContext(AppContext);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [modalState, setModalState] = useState<{isOpen: boolean; event: CalendarEvent | null, day: Date}>({isOpen: false, event: null, day: new Date()});
    const [animationClass, setAnimationClass] = useState('');

    // Refs for swipe gesture
    const touchStartX = useRef<number | null>(null);
    const touchEndX = useRef<number | null>(null);
    const minSwipeDistance = 50;

    const changeMonth = (direction: 'prev' | 'next') => {
        const outClass = direction === 'next' ? 'animate-slide-out-to-left' : 'animate-slide-out-to-right';
        setAnimationClass(outClass);

        setTimeout(() => {
            setCurrentDate(d => {
                const newMonth = direction === 'next' ? d.getMonth() + 1 : d.getMonth() - 1;
                return new Date(d.getFullYear(), newMonth, 1);
            });
            
            const inClass = direction === 'next' ? 'animate-slide-in-from-right' : 'animate-slide-in-from-left';
            setAnimationClass(inClass);
        }, 280); // Corresponds to 0.3s animation
    }

    const onTouchStart = (e: React.TouchEvent) => {
        touchEndX.current = null;
        touchStartX.current = e.targetTouches[0].clientX;
    };

    const onTouchMove = (e: React.TouchEvent) => {
        touchEndX.current = e.targetTouches[0].clientX;
    };

    const onTouchEnd = () => {
        if (touchStartX.current === null || touchEndX.current === null) return;
        const distance = touchStartX.current - touchEndX.current;
        const isLeftSwipe = distance > minSwipeDistance;
        const isRightSwipe = distance < -minSwipeDistance;

        if (isLeftSwipe) {
            changeMonth('next');
        } else if (isRightSwipe) {
            changeMonth('prev');
        }

        touchStartX.current = null;
        touchEndX.current = null;
    };


    const {days, firstDay, lastDay} = useMemo(() => {
        const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        const startDate = new Date(startOfMonth);
        const dayOfWeek = startOfMonth.getDay(); 
        const offset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        startDate.setDate(startDate.getDate() - offset);
        const dayArray = [];
        for (let i = 0; i < 35; i++) {
            dayArray.push(new Date(startDate));
            startDate.setDate(startDate.getDate() + 1);
        }
        return { days: dayArray, firstDay: dayArray[0], lastDay: dayArray[34] };
    }, [currentDate]);

    const expandedEvents = useMemo(() => {
        return expandRecurringEvents(events, firstDay, lastDay);
    }, [events, firstDay, lastDay]);

    const eventsByDate = useMemo(() => {
        const map = new Map<string, { event: CalendarEvent }[]>();
        expandedEvents.forEach(item => {
            const list = map.get(item.date) || [];
            list.push(item);
            map.set(item.date, list);
        });
        return map;
    }, [expandedEvents]);

    const eventsForSelectedDay = useMemo(() => {
        return eventsByDate.get(toYYYYMMDD(selectedDate))
            ?.map(e => e.event)
            .sort((a,b) => a.startTime.localeCompare(b.startTime)) || [];
    }, [selectedDate, eventsByDate]);

    return (
        <div 
            className="bg-white dark:bg-slate-800 rounded-lg shadow-xl flex flex-col h-full"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
        >
            {modalState.isOpen && <EventModal event={modalState.event} day={modalState.day} onClose={() => setModalState({isOpen: false, event: null, day: new Date()})} />}
            
            <header className="flex-shrink-0 p-4 sm:p-6 border-b border-slate-200 dark:border-slate-700">
                <div className="flex justify-between items-center gap-4">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-x-3 flex-wrap">
                            <h2 className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-slate-100 capitalize">
                                {currentDate.toLocaleString('it-IT', { month: 'long' })}
                            </h2>
                            <span className="text-2xl md:text-3xl font-bold text-slate-500 dark:text-slate-400">
                                {currentDate.getFullYear()}
                            </span>
                        </div>
                    </div>
                    
                    <div className="flex-shrink-0 flex items-center gap-2">
                        <button 
                            onClick={() => {
                                const today = new Date();
                                setCurrentDate(today);
                                setSelectedDate(today);
                            }} 
                            className="px-3 py-2 text-xs sm:text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                            title="Vai a oggi"
                        >
                            Oggi
                        </button>
                        <div className="flex items-center">
                             <button onClick={() => changeMonth('prev')} className="p-2 rounded-l-lg text-slate-600 dark:text-slate-300 border border-r-0 border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors" title="Mese precedente"><i className="fas fa-chevron-left"></i></button>
                             <button onClick={() => changeMonth('next')} className="p-2 rounded-r-lg text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors" title="Mese successivo"><i className="fas fa-chevron-right"></i></button>
                        </div>
                         <button onClick={() => setModalState({isOpen: true, event: null, day: selectedDate})} className="w-10 h-10 bg-indigo-600 text-white rounded-full shadow-md hover:bg-indigo-700 transition-colors flex items-center justify-center">
                            <i className="fas fa-plus"></i>
                         </button>
                    </div>
                </div>
            </header>
            
            <div className="flex-shrink-0 p-4 sm:p-6 overflow-hidden">
                <div className={`grid grid-cols-7 text-center text-sm ${animationClass}`}>
                    {['LUN', 'MAR', 'MER', 'GIO', 'VEN', 'SAB', 'DOM'].map(day => (
                        <div key={day} className="font-semibold text-slate-600 dark:text-slate-300 py-2">{day}</div>
                    ))}
                    {days.map(day => {
                        const dayKey = toYYYYMMDD(day);
                        const eventsForDay = eventsByDate.get(dayKey) || [];
                        const isCurrentMonth = day.getMonth() === currentDate.getMonth();
                        const isToday = dayKey === toYYYYMMDD(new Date());
                        const isSelected = dayKey === toYYYYMMDD(selectedDate);
                        
                        return (
                            <div 
                                key={dayKey} 
                                onClick={() => setSelectedDate(day)} 
                                className="flex flex-col items-center justify-start gap-1 py-2 cursor-pointer border-t border-slate-100 dark:border-slate-700/50 h-14"
                            >
                                <div className={`flex items-center justify-center w-7 h-7 rounded-lg transition-colors ${
                                    isSelected ? 'bg-indigo-600' : ''
                                }`}>
                                    <span className={`${
                                        isSelected ? 'text-white' :
                                        isToday ? 'text-indigo-600 dark:text-indigo-400 font-bold' :
                                        isCurrentMonth ? 'text-slate-700 dark:text-slate-200' :
                                        'text-slate-400 dark:text-slate-500'
                                    }`}>
                                        {day.getDate()}
                                    </span>
                                </div>
                                <div className="flex justify-center items-center space-x-1 h-2">
                                    {eventsForDay.slice(0, 3).map(({event}, i) => (
                                        <span key={i} className={`block w-1.5 h-1.5 rounded-full ${getEventTypeClasses(event.type).dot}`}></span>
                                    ))}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            <div className="px-4 sm:px-6 pt-4 pb-2 border-t border-slate-200 dark:border-slate-700 flex-shrink-0">
                <h3 className="font-semibold text-slate-800 dark:text-slate-200 capitalize">
                    {selectedDate.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}
                </h3>
            </div>

            <div className="flex-1 overflow-y-auto px-4 sm:px-6 pb-4 space-y-3">
                {eventsForSelectedDay.length > 0 ? (
                    eventsForSelectedDay.map(event => {
                        const typeClasses = getEventTypeClasses(event.type);
                        return (
                            <div 
                                key={`${event.id}-${toYYYYMMDD(selectedDate)}`}
                                onClick={() => setModalState({isOpen: true, event, day: selectedDate})}
                                className={`flex items-center gap-4 p-3 rounded-lg cursor-pointer transition-colors border-l-4 hover:bg-slate-100 dark:hover:bg-slate-700 ${typeClasses.border} ${typeClasses.bg}`}
                            >
                                <div className="text-sm font-semibold text-slate-700 dark:text-slate-300 w-20 text-center">
                                    {event.startTime}
                                    <div className="text-xs text-slate-500">({event.duration} min)</div>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold truncate text-slate-800 dark:text-slate-100">{event.recurrence && <i className="fas fa-sync-alt fa-xs mr-2 text-slate-500"></i>}{event.title}</p>
                                    <p className={`text-sm font-medium ${typeClasses.text}`}>{event.type}</p>
                                </div>
                            </div>
                        )
                    })
                ) : (
                    <div className="text-center py-10">
                        <i className="fas fa-calendar-check text-4xl text-slate-300 dark:text-slate-600 mb-3"></i>
                        <p className="text-slate-500 dark:text-slate-400">Nessun evento per questo giorno.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CalendarView;