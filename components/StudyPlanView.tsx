import React, { useState, useContext } from 'react';
import { AppContext } from '../App';
import { StudyPlan, CalendarEvent, EventType } from '../types';
import { generateStudyPlan } from '../services/geminiService';
import RateLimitMessage from './RateLimitMessage';
import { useSettings } from '../useSettings';

const STUDY_PLAN_GENERATION_KEY = 'study-plan-generation';

const StudyPlanView: React.FC = () => {
    const { lessons, events, studyPlans, setStudyPlans, addEvent, processingState, setProcessingState } = useContext(AppContext);
    const { settings } = useSettings();
    const [error, setError] = useState<string | null>(null);
    const [isRateLimited, setIsRateLimited] = useState(false);
    const [isAddingToCalendar, setIsAddingToCalendar] = useState(false);
    const [addSuccessMessage, setAddSuccessMessage] = useState('');

    const isLoading = !!processingState[STUDY_PLAN_GENERATION_KEY];

    const handleGeneratePlan = async () => {
        if (!settings.apiKey) {
            alert("API Key non trovata. Per favore, vai nelle impostazioni per aggiungerla.");
            return;
        }
        setProcessingState(STUDY_PLAN_GENERATION_KEY, true);
        setError(null);
        setIsRateLimited(false);
        setAddSuccessMessage(''); // Reset on new generation
        try {
            const plan = await generateStudyPlan(lessons, events, settings.analysisModel, settings.apiKey);
            setStudyPlans(plan);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            if (errorMessage.startsWith('RATE_LIMIT_EXCEEDED::')) {
                setIsRateLimited(true);
            } else {
                setError(errorMessage);
            }
        } finally {
            setProcessingState(STUDY_PLAN_GENERATION_KEY, false);
        }
    };

    const handleAddPlanToCalendar = async () => {
        setIsAddingToCalendar(true);
        setError(null);

        const eventsToAdd: CalendarEvent[] = [];
        studyPlans.forEach((dayPlan) => {
            dayPlan.sessions.forEach((session, index) => {
                const timeParts = session.time.split(' - ');
                if (timeParts.length !== 2) return;

                const startTime = timeParts[0].trim();
                const endTime = timeParts[1].trim();

                const start = new Date(`1970-01-01T${startTime}:00`);
                const end = new Date(`1970-01-01T${endTime}:00`);
                
                if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) return;

                const duration = (end.getTime() - start.getTime()) / (1000 * 60);

                const newEvent: CalendarEvent = {
                    id: `study-${dayPlan.date}-${startTime.replace(':', '')}-${index}`,
                    title: session.activity,
                    date: dayPlan.date,
                    startTime,
                    duration,
                    type: EventType.Study,
                };
                eventsToAdd.push(newEvent);
            });
        });

        if (eventsToAdd.length === 0) {
            setError("Nessuna sessione di studio valida da aggiungere al calendario.");
            setIsAddingToCalendar(false);
            return;
        }

        try {
            await Promise.all(eventsToAdd.map(e => addEvent(e)));
            setAddSuccessMessage(`${eventsToAdd.length} sessioni di studio aggiunte al calendario!`);
        } catch (e) {
            setError(`Errore nell'aggiungere le sessioni al calendario: ${e instanceof Error ? e.message : String(e)}`);
        } finally {
            setIsAddingToCalendar(false);
        }
    };

    return (
        <div>
            <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-xl mb-8">
                <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="text-center md:text-left flex-1">
                        <h2 className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-slate-100">Piano di Studio AI</h2>
                        <p className="text-slate-500 dark:text-slate-400 mt-1">L'IA organizzerà il tuo studio in base alle lezioni e scadenze.</p>
                    </div>
                    <div className="flex flex-shrink-0 flex-col sm:flex-row gap-4 w-full sm:w-auto">
                        <button
                            onClick={handleGeneratePlan}
                            disabled={isLoading}
                            className="bg-indigo-600 text-white font-bold py-3 px-6 rounded-lg shadow-md hover:bg-indigo-700 transition-transform transform hover:scale-105 active:scale-95 disabled:bg-slate-400 disabled:dark:bg-slate-600 disabled:cursor-not-allowed flex items-center justify-center"
                        >
                            {isLoading ? (
                                <>
                                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    <span>Generazione...</span>
                                </>
                            ) : (
                                <>
                                    <i className="fas fa-magic mr-2"></i>
                                    <span>Genera Piano</span>
                                </>
                            )}
                        </button>
                        {studyPlans.length > 0 && (
                            <button
                                onClick={handleAddPlanToCalendar}
                                disabled={isAddingToCalendar || !!addSuccessMessage}
                                className="bg-teal-600 text-white font-bold py-3 px-6 rounded-lg shadow-md hover:bg-teal-700 transition-colors disabled:bg-slate-400 disabled:dark:bg-slate-600 disabled:cursor-not-allowed flex items-center justify-center"
                            >
                                {isAddingToCalendar 
                                    ? <><i className="fas fa-spinner fa-spin mr-2"></i><span>Aggiungo...</span></>
                                    : !!addSuccessMessage
                                    ? <><i className="fas fa-check-circle mr-2"></i><span>Aggiunto!</span></>
                                    : <><i className="fas fa-calendar-plus mr-2"></i><span>Aggiungi al Calendario</span></>
                                }
                            </button>
                        )}
                    </div>
                </div>
            </div>
            
            {isRateLimited && <div className="mb-6"><RateLimitMessage /></div>}
            {error && <div className="bg-red-100 dark:bg-red-900/50 border border-red-400 dark:border-red-500/30 text-red-700 dark:text-red-200 px-4 py-3 rounded relative mb-6" role="alert">{error}</div>}
            
            {studyPlans.length > 0 ? (
                <div className="space-y-6">
                    {studyPlans.map((dayPlan, index) => (
                        <div 
                            key={dayPlan.date} 
                            className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-lg animate-fade-in"
                            style={{ animationDelay: `${index * 100}ms`, opacity: 0 }}
                        >
                            <h3 className="text-xl font-bold text-indigo-700 dark:text-indigo-400 border-b dark:border-slate-700 pb-2 mb-4">
                                {new Date(dayPlan.date + 'T00:00:00').toLocaleDateString('it-IT', { weekday: 'long', day: '2-digit', month: 'long' })}
                            </h3>
                            <div className="space-y-4">
                                {dayPlan.sessions.map((session, index) => (
                                    <div key={index} className="flex items-center space-x-4 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                                        <div className="w-28 text-center bg-indigo-100 dark:bg-indigo-900/50 text-indigo-800 dark:text-indigo-200 font-bold py-2 px-1 rounded-md">{session.time}</div>
                                        <div className="flex-1">
                                            <p className="font-semibold text-slate-800 dark:text-slate-100">{session.subject} - <span className="font-normal">{session.topic}</span></p>
                                            <p className="text-sm text-slate-600 dark:text-slate-300"><i className="fas fa-tasks mr-2 text-slate-400 dark:text-slate-500"></i>{session.activity}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                 !isLoading && !isRateLimited && !error && (
                    <div className="text-center py-16 px-6 bg-white dark:bg-slate-800 rounded-lg shadow-md">
                        <i className="fas fa-calendar-check text-5xl text-slate-300 dark:text-slate-600 mb-4"></i>
                        <h3 className="text-xl font-semibold text-slate-700 dark:text-slate-200">Il tuo piano di studio apparirà qui.</h3>
                        <p className="text-slate-500 dark:text-slate-400 mt-2">Clicca su "Genera Piano" per iniziare.</p>
                    </div>
                )
            )}
        </div>
    );
};

export default StudyPlanView;