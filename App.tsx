

import React, { useState, useCallback, useMemo, useEffect, useContext, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { AppView, Lesson, CalendarEvent, StudyPlan, Quiz, LessonStatus, BackendJobState } from './types';
import Sidebar from './components/Sidebar';
import LessonsView from './components/LessonsView';
import CalendarView from './components/CalendarView';
import StudyPlanView from './components/StudyPlanView';
import QuizView from './components/QuizView';
import SettingsView from './components/SettingsView';
import { storageService } from './services/storageService';
import { SettingsProvider, useSettings } from './useSettings';
import BottomNavBar from './components/BottomNavBar';
import { checkBackendStatus, syncWithBackend, SyncResult, UploadControl } from './services/backendService';

type AppStatus = 'LOADING' | 'READY' | 'ERROR';
type BackendStatus = 'UNKNOWN' | 'ONLINE' | 'OFFLINE';

// Stato per tenere traccia dei processi in background
interface ProcessingState {
  [key: string]: boolean;
}

interface AppContextType {
  lessons: Lesson[];
  lessonsBySubject: Record<string, Lesson[]>;
  addLesson: (lesson: Lesson) => Promise<void>;
  updateLesson: (lesson: Lesson) => Promise<void>;
  updateLessonsOrder: (orderedLessons: {id: string; order: number}[]) => Promise<void>;
  deleteLesson: (lessonId: string) => Promise<void>;
  deleteSubject: (subject: string) => Promise<void>;
  deleteSubfolder: (subject: string, subfolder: string) => Promise<void>;
  events: CalendarEvent[];
  addEvent: (event: CalendarEvent) => Promise<void>;
  updateEvent: (event: CalendarEvent) => Promise<void>;
  deleteEvent: (eventId: string) => Promise<void>;
  quizzes: Quiz[];
  saveQuiz: (quiz: Quiz) => Promise<void>;
  studyPlans: StudyPlan[];
  setStudyPlans: React.Dispatch<React.SetStateAction<StudyPlan[]>>;
  setView: (view: AppView) => void;
  isSidebarOpen: boolean;
  setIsSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
  // Stato di elaborazione globale
  processingState: ProcessingState;
  setProcessingState: (key: string, isProcessing: boolean) => void;
  // Stato di upload
  uploadProgress: Record<string, number>;
  setUploadProgress: (lessonId: string, percent: number | null) => void;
  backendStatus: BackendStatus;
  // Gestione centralizzata degli upload
  addUploadControl: (lessonId: string, control: UploadControl) => void;
  removeUploadControl: (lessonId: string) => void;
  abortUpload: (lessonId: string) => void;
  // Stato per la navigazione interna di LessonsView
  lessonView: 'subjects' | 'lessons' | 'detail';
  selectedSubject: string | null;
  selectedLessonId: string | null;
  lessonViewAnimationClass: string;
  handleSelectSubject: (subject: string) => void;
  handleSelectLesson: (lessonId: string) => void;
  handleBackToSubjects: () => void;
  handleBackToLessons: () => void;
  reloadData: (silent?: boolean) => Promise<void>;
}

export const AppContext = React.createContext<AppContextType>({} as AppContextType);

const ApiKeyPrompt: React.FC = () => {
  const { setView } = useContext(AppContext);
  return (
    <div className="fixed inset-0 bg-slate-900 bg-opacity-70 flex justify-center items-center z-50 p-4 backdrop-blur-sm animate-fade-in">
        <div className="bg-white dark:bg-slate-800 p-8 rounded-lg shadow-2xl w-full max-w-md text-center animate-pop-in">
            <i className="fas fa-key text-4xl text-amber-500 mb-4"></i>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">Chiave API Mancante</h2>
            <p className="text-slate-600 dark:text-slate-300 mb-6">
                Per utilizzare le funzionalità di intelligenza artificiale, è necessario inserire una chiave API di Google Gemini.
            </p>
            <button
                onClick={() => setView(AppView.Settings)}
                className="w-full bg-indigo-600 text-white font-bold py-3 px-6 rounded-lg shadow-md hover:bg-indigo-700 transition-colors"
            >
                Vai alle Impostazioni
            </button>
        </div>
    </div>
  )
}

const AppContent: React.FC = () => {
  const [appStatus, setAppStatus] = useState<AppStatus>('LOADING');
  const [error, setError] = useState<string | null>(null);
  
  const [view, setView] = useState<AppView>(AppView.Lessons);
  const [animationClass, setAnimationClass] = useState('animate-fade-in'); // First load animation
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [studyPlans, setStudyPlans] = useState<StudyPlan[]>([]);
  const { settings } = useSettings();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [processingState, setProcessingStateInternal] = useState<ProcessingState>({});
  const [uploadProgress, setUploadProgressInternal] = useState<Record<string, number>>({});
  const [backendStatus, setBackendStatus] = useState<BackendStatus>('UNKNOWN');
  const [isSyncing, setIsSyncing] = useState(false);

  // State for LessonsView internal navigation (lifted up)
  const [lessonView, setLessonView] = useState<'subjects' | 'lessons' | 'detail'>('subjects');
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [lessonViewAnimationClass, setLessonViewAnimationClass] = useState('animate-fade-in');
  
  // --- Gestione centralizzata degli upload ---
  const uploadControlsRef = useRef<Record<string, UploadControl>>({});

  const addUploadControl = useCallback((lessonId: string, control: UploadControl) => {
    // Se c'è già un caricamento per questa lezione, annullalo prima di iniziarne uno nuovo.
    if (uploadControlsRef.current[lessonId]) {
        console.warn(`Annullamento di un upload esistente per la lezione ${lessonId} prima di iniziarne uno nuovo.`);
        uploadControlsRef.current[lessonId].abort();
    }
    uploadControlsRef.current[lessonId] = control;
  }, []);

  const removeUploadControl = useCallback((lessonId: string) => {
      delete uploadControlsRef.current[lessonId];
  }, []);

  const abortUpload = useCallback((lessonId: string) => {
      if (uploadControlsRef.current[lessonId]) {
          uploadControlsRef.current[lessonId].abort();
          // La pulizia del riferimento (removeUploadControl) ora è responsabilità esclusiva 
          // del blocco `finally` della funzione che ha avviato il caricamento.
          // Questo previene la "race condition" che causava il bug.
      }
  }, []);
  // --- Fine gestione upload ---

  const setProcessingState = useCallback((key: string, isProcessing: boolean) => {
    setProcessingStateInternal(prev => ({ ...prev, [key]: isProcessing }));
  }, []);

  const setUploadProgress = useCallback((lessonId: string, percent: number | null) => {
    setUploadProgressInternal(prev => {
        const newProgress = { ...prev };
        if (percent === null) {
            delete newProgress[lessonId];
        } else {
            newProgress[lessonId] = percent;
        }
        return newProgress;
    });
  }, []);


  // Apply theme class to HTML element
  useEffect(() => {
    const root = window.document.documentElement;
    if (settings.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [settings.theme]);

  const initializeApp = useCallback(async (silent = false) => {
    try {
      if (!silent) setAppStatus('LOADING');
      const [loadedLessons, loadedEvents, loadedQuizzes] = await Promise.all([
        storageService.getLessons(),
        storageService.getEvents(),
        storageService.getQuizzes(),
      ]);
      
      setLessons(loadedLessons);
      setEvents(loadedEvents);
      setQuizzes(loadedQuizzes);
      if (!silent) setAppStatus('READY');
    } catch (e) {
      console.error("Errore di inizializzazione:", e);
      setError(e instanceof Error ? e.message : String(e));
      setAppStatus('ERROR');
    }
  }, []);

  useEffect(() => {
    initializeApp();
  }, [initializeApp]);

  const viewOrder = useMemo(() => [AppView.Lessons, AppView.Calendar, AppView.StudyPlan, AppView.Quiz, AppView.Settings], []);

  const handleSetView = useCallback((newView: AppView) => {
    if (newView === view) return;

    const oldIndex = viewOrder.indexOf(view);
    const newIndex = viewOrder.indexOf(newView);
    
    let animClass = 'animate-fade-in'; 
    if (oldIndex !== -1 && newIndex !== -1) {
      animClass = newIndex > oldIndex ? 'animate-slide-in-from-right' : 'animate-slide-in-from-left';
    }
    
    setAnimationClass(animClass);
    setView(newView);

    const animationDuration = 300;
    setTimeout(() => {
        setAnimationClass('');
    }, animationDuration);

  }, [view, viewOrder]);
  
    // --- Handlers for LessonsView navigation ---
  const animationDuration = 450;
  const handleSelectSubject = useCallback((subject: string) => {
      setLessonViewAnimationClass('animate-slide-out-to-left-slow');
      setTimeout(() => {
          setSelectedSubject(subject);
          setLessonView('lessons');
          setLessonViewAnimationClass('animate-slide-in-from-right-slow');
      }, animationDuration);
  }, []);

  const handleSelectLesson = useCallback((lessonId: string) => {
      setLessonViewAnimationClass('animate-slide-out-to-left-slow');
      setTimeout(() => {
          setSelectedLessonId(lessonId);
          setLessonView('detail');
          setLessonViewAnimationClass('animate-slide-in-from-right-slow');
      }, animationDuration);
  }, []);

  const handleBackToSubjects = useCallback(() => {
      setLessonViewAnimationClass('animate-slide-out-to-right-slow');
      setTimeout(() => {
          setSelectedSubject(null);
          setLessonView('subjects');
          setLessonViewAnimationClass('animate-slide-in-from-left-slow');
      }, animationDuration);
  }, []);

  const handleBackToLessons = useCallback(() => {
      setLessonViewAnimationClass('animate-slide-out-to-right-slow');
      setTimeout(() => {
          setSelectedLessonId(null);
          setLessonView('lessons');
          setLessonViewAnimationClass('animate-slide-in-from-left-slow');
      }, animationDuration);
  }, []);
  
  // Ref to hold current navigation state for the back button listener
  const navStateRef = useRef({ view, lessonView });

  useEffect(() => {
    navStateRef.current = { view, lessonView };
  }, [view, lessonView]);

  // --- Android Back Button Listener ---
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    // CapacitorApp.addListener returns a promise that resolves to a handle.
    // We'll store the handle to remove it on cleanup.
    const listenerPromise = CapacitorApp.addListener('backButton', () => {
        const { view: currentView, lessonView: currentLessonView } = navStateRef.current;
        // Handle back navigation specifically within the nested views of the "Lessons" section.
        if (currentView === AppView.Lessons) {
            if (currentLessonView === 'detail') {
                handleBackToLessons();
            } else if (currentLessonView === 'lessons') {
                handleBackToSubjects();
            }
        }
        // When on a top-level view, we do nothing, which should prevent the default exit behavior.
    });

    return () => {
        // Clean up the listener when the component unmounts.
        listenerPromise.then(listener => listener.remove());
    };
    // The handlers are stable callbacks, so this effect runs only once on mount,
    // preventing listener re-registration issues.
  }, [handleBackToLessons, handleBackToSubjects]);


  const addLesson = useCallback(async (lesson: Lesson) => {
    try {
        // Calculate the next order number within the same subject/subfolder
        const lessonsInContext = lessons.filter(
            l => l.subject === lesson.subject && l.subfolder === lesson.subfolder
        );
        const maxOrder = Math.max(0, ...lessonsInContext.map(l => l.order || 0));
        const newLessonWithOrder = { ...lesson, order: maxOrder + 1 };

        await storageService.saveLesson(newLessonWithOrder);
        const { transcript, summary, audioBlob, ...meta } = newLessonWithOrder;
        setLessons(prev => [meta as Lesson, ...prev].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    } catch (e) {
        console.error("Errore nell'aggiungere la lezione:", e);
        alert(`Errore nell'aggiungere la lezione: ${e instanceof Error ? e.message : String(e)}`);
        throw e;
    }
  }, [lessons]);

  const updateLesson = useCallback(async (lesson: Lesson) => {
    try {
        await storageService.saveLesson(lesson);
        const { transcript, summary, audioBlob, ...meta } = lesson;
        setLessons(prev => prev.map(l => 
            l.id === lesson.id ? { ...l, ...meta } : l
        ));
    } catch (e) {
        console.error("Errore nell'aggiornare la lezione:", e);
        alert(`Errore nell'aggiornare la lezione: ${e instanceof Error ? e.message : String(e)}`);
        throw e;
    }
  }, []);
  
    const updateLessonsOrder = useCallback(async (orderedLessons: {id: string, order: number}[]) => {
    try {
        await storageService.updateLessonsOrder(orderedLessons);
        // Aggiorniamo lo stato locale per riflettere il nuovo ordine
        setLessons(prev => {
          const newLessons = prev.map(l => {
            const updateInfo = orderedLessons.find(ol => ol.id === l.id);
            if (updateInfo) {
              return { ...l, order: updateInfo.order };
            }
            return l;
          });
          return newLessons;
        });
    } catch (e) {
        console.error("Errore nell'aggiornare l'ordine delle lezioni:", e);
        alert(`Errore nell'aggiornare l'ordine: ${e instanceof Error ? e.message : String(e)}`);
        throw e;
    }
  }, []);
  
  // Migration effect for lessons without order property
  useEffect(() => {
    if (appStatus !== 'READY' || lessons.length === 0) return;

    const needsMigration = lessons.some(l => l.order === undefined);

    if (needsMigration) {
        console.log("Running migration to assign order to legacy lessons...");

        const lessonsByContext = new Map<string, Lesson[]>();
        
        lessons.forEach(lesson => {
            const contextKey = `${lesson.subject}::${lesson.subfolder || 'root'}`;
            if (!lessonsByContext.has(contextKey)) {
                lessonsByContext.set(contextKey, []);
            }
            lessonsByContext.get(contextKey)!.push(lesson);
        });

        const lessonsToUpdate: {id: string, order: number}[] = [];

        lessonsByContext.forEach((contextLessons) => {
            const lessonsWithOrder = contextLessons.filter(l => typeof l.order === 'number');
            const lessonsWithoutOrder = contextLessons.filter(l => typeof l.order !== 'number');
            
            if (lessonsWithoutOrder.length > 0) {
                const maxOrder = Math.max(0, ...lessonsWithOrder.map(l => l.order!));
                
                const sortedLegacyLessons = lessonsWithoutOrder.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

                sortedLegacyLessons.forEach((lesson, index) => {
                    lessonsToUpdate.push({
                        id: lesson.id,
                        order: maxOrder + 1 + index
                    });
                });
            }
        });

        if (lessonsToUpdate.length > 0) {
            updateLessonsOrder(lessonsToUpdate);
        }
    }
  }, [appStatus, lessons, updateLessonsOrder]);
  
  useEffect(() => {
    const verifyBackend = async () => {
      const status = await checkBackendStatus();
      setBackendStatus(status);
    };
    verifyBackend();
    const interval = window.setInterval(verifyBackend, 5 * 60 * 1000); // Check every 5 minutes
    return () => window.clearInterval(interval);
  }, []);

  const lessonsRef = useRef<Lesson[]>([]);
  useEffect(() => {
    lessonsRef.current = lessons;
  }, [lessons]);

  // Sync with backend
  const syncWithBackendCallback = useCallback(async () => {
      if (backendStatus !== 'ONLINE' || !settings.apiKey) {
          return;
      }

      const currentLessons = lessonsRef.current;
      const lessonsToPoll = currentLessons.filter(l => l.status === LessonStatus.ProcessingBackend && l.backendProcessingId);

      if (lessonsToPoll.length === 0) {
          return;
      }

      const knownIds = lessonsToPoll.map(l => l.backendProcessingId!);
      
      setIsSyncing(true);
      try {
          const results: SyncResult[] = await syncWithBackend(settings.apiKey, knownIds);

          for (const result of results) {
              const lessonToUpdate = lessonsToPoll.find(l => l.backendProcessingId === result.lesson_id);
              if (!lessonToUpdate) continue;
              
              let hasChanged = false;
              let updatedLesson = { ...lessonToUpdate };

              if (result.status === 'completed' && result.result) {
                  const { transcript, summary, suggestedTopic } = result.result;
                  updatedLesson = {
                      ...updatedLesson,
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
                      ...updatedLesson,
                      status: LessonStatus.Error,
                      error: result.message || 'Elaborazione scaduta dopo 48 ore.',
                      backendJobStatus: BackendJobState.Expired,
                  };
                  hasChanged = true;
              } else if (result.status === 'error') {
                  updatedLesson = { 
                      ...updatedLesson, 
                      status: LessonStatus.Error, 
                      error: `Backend Error: ${result.message || 'Unknown error'}`,
                      backendJobStatus: result.backend_job_status || BackendJobState.Failed
                  };
                  hasChanged = true;
              } else if (result.status === 'cancelled') {
                  updatedLesson = {
                      ...updatedLesson,
                      status: LessonStatus.Cancelled,
                      backendJobStatus: result.backend_job_status || BackendJobState.Cancelled,
                      error: 'Elaborazione annullata dall\'utente.',
                  };
                  hasChanged = true;
              } else if (result.status === 'processing' && result.backend_job_status) {
                  if (updatedLesson.backendJobStatus !== result.backend_job_status) {
                      updatedLesson.backendJobStatus = result.backend_job_status;
                      hasChanged = true;
                  }
              }
              
              if (hasChanged) {
                  await updateLesson(updatedLesson);
              }
          }
      } catch (e) {
          console.error('Errore durante la sincronizzazione con il backend:', e);
      } finally {
          setIsSyncing(false);
      }
  }, [backendStatus, settings.apiKey, updateLesson]);

  useEffect(() => {
      if (appStatus !== 'READY') return;
      syncWithBackendCallback();
      const intervalId = setInterval(syncWithBackendCallback, 60000); // Poll every 60 seconds
      return () => clearInterval(intervalId);
  }, [appStatus, syncWithBackendCallback]);


  const deleteLesson = useCallback(async (lessonId: string) => {
    try {
        await storageService.deleteLesson(lessonId);
        await storageService.deleteQuizzesByLessonId(lessonId);
        
        const updatedLessons = await storageService.getLessons();
        const updatedQuizzes = await storageService.getQuizzes();
        setLessons(updatedLessons);
        setQuizzes(updatedQuizzes);
    } catch (e) {
        console.error("Errore nell'eliminare la lezione e/o il quiz associato:", e);
        alert(`Errore nell'eliminare la lezione: ${e instanceof Error ? e.message : String(e)}`);
        throw e;
    }
  }, []);

  const deleteSubject = useCallback(async (subject: string) => {
    try {
        const subjectLessons = lessonsRef.current.filter(l => l.subject === subject);
        for (const lesson of subjectLessons) {
            await storageService.deleteLesson(lesson.id);
            await storageService.deleteQuizzesByLessonId(lesson.id);
        }
        
        const updatedLessons = await storageService.getLessons();
        const updatedQuizzes = await storageService.getQuizzes();
        setLessons(updatedLessons);
        setQuizzes(updatedQuizzes);
    } catch (e) {
        console.error("Errore nell'eliminare la materia:", e);
        alert(`Errore nell'eliminare la materia: ${e instanceof Error ? e.message : String(e)}`);
        throw e;
    }
  }, []);

  const deleteSubfolder = useCallback(async (subject: string, subfolder: string) => {
    try {
        const subfolderLessons = lessonsRef.current.filter(l => l.subject === subject && l.subfolder === subfolder);
        for (const lesson of subfolderLessons) {
            await storageService.deleteLesson(lesson.id);
            await storageService.deleteQuizzesByLessonId(lesson.id);
        }
        
        const updatedLessons = await storageService.getLessons();
        const updatedQuizzes = await storageService.getQuizzes();
        setLessons(updatedLessons);
        setQuizzes(updatedQuizzes);
    } catch (e) {
        console.error("Errore nell'eliminare la sottocartella:", e);
        alert(`Errore nell'eliminare la sottocartella: ${e instanceof Error ? e.message : String(e)}`);
        throw e;
    }
  }, []);

  const addEvent = useCallback(async (event: CalendarEvent) => {
    try {
        await storageService.saveEvent(event);
        setEvents(prev => [...prev, event]);
    } catch (e) {
        console.error("Errore nell'aggiungere l'evento:", e);
        alert(`Errore nell'aggiungere l'evento: ${e instanceof Error ? e.message : String(e)}`);
        throw e;
    }
  }, []);

  const updateEvent = useCallback(async (event: CalendarEvent) => {
    try {
        await storageService.saveEvent(event);
        setEvents(prev => prev.map(e => e.id === event.id ? event : e));
    } catch (e) {
        console.error("Errore nell'aggiornare l'evento:", e);
        alert(`Errore nell'aggiornare l'evento: ${e instanceof Error ? e.message : String(e)}`);
        throw e;
    }
  }, []);

  const deleteEvent = useCallback(async (eventId: string) => {
    try {
        await storageService.deleteEvent(eventId);
        
        const updatedEvents = await storageService.getEvents();
        setEvents(updatedEvents);
    } catch (e) {
        console.error("Errore nell'eliminare l'evento:", e);
        alert(`Errore nell'eliminare l'evento: ${e instanceof Error ? e.message : String(e)}`);
        throw e;
    }
  }, []);

  const saveQuiz = useCallback(async (quiz: Quiz) => {
    try {
        await storageService.saveQuiz(quiz);
        setQuizzes(prev => [...prev, quiz]);
    } catch (e) {
        console.error("Errore nel salvare il quiz:", e);
        alert(`Errore nel salvare il quiz: ${e instanceof Error ? e.message : String(e)}`);
        throw e;
    }
  }, []);
  
  const lessonsBySubject = useMemo(() => {
    const index: Record<string, Lesson[]> = {};
    for (const lesson of lessons) {
        const subject = lesson.subject || "Nessuna Materia";
        if (!index[subject]) {
            index[subject] = [];
        }
        index[subject].push(lesson);
    }
    return index;
  }, [lessons]);

  const contextValue = useMemo(() => ({
    lessons, lessonsBySubject, addLesson, updateLesson, updateLessonsOrder, deleteLesson, deleteSubject, deleteSubfolder,
    events, addEvent, updateEvent, deleteEvent,
    quizzes, saveQuiz,
    studyPlans, setStudyPlans,
    setView: handleSetView,
    isSidebarOpen, setIsSidebarOpen,
    processingState, setProcessingState,
    uploadProgress, setUploadProgress,
    backendStatus,
    addUploadControl, removeUploadControl, abortUpload,
    lessonView, selectedSubject, selectedLessonId, lessonViewAnimationClass,
    handleSelectSubject, handleSelectLesson, handleBackToSubjects, handleBackToLessons,
    reloadData: initializeApp,
  }), [
    lessons, lessonsBySubject, events, quizzes, studyPlans, addLesson, updateLesson, updateLessonsOrder, deleteLesson, deleteSubject, deleteSubfolder, 
    addEvent, updateEvent, deleteEvent, saveQuiz, isSidebarOpen, handleSetView, processingState, setProcessingState, 
    uploadProgress, setUploadProgress, backendStatus, addUploadControl, removeUploadControl, abortUpload,
    lessonView, selectedSubject, selectedLessonId, lessonViewAnimationClass, 
    handleSelectSubject, handleSelectLesson, handleBackToSubjects, handleBackToLessons, initializeApp
  ]);
  
  const renderView = useCallback(() => {
    switch (view) {
      case AppView.Lessons: return <LessonsView />;
      case AppView.Calendar: return <CalendarView />;
      case AppView.StudyPlan: return <StudyPlanView />;
      case AppView.Quiz: return <QuizView />;
      case AppView.Settings: return <SettingsView />;
      default: return <LessonsView />;
    }
  }, [view]);

  if (appStatus === 'LOADING') {
    return <div className="flex items-center justify-center h-screen text-slate-600 dark:text-slate-300">Caricamento dati...</div>;
  }
  
  if (appStatus === 'ERROR') {
      return (
        <div className="flex items-center justify-center h-screen">
            <div className="flex flex-col items-center justify-center text-center p-8 bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-lg">
                <i className="fas fa-exclamation-triangle text-5xl text-red-500 mb-4"></i>
                <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">Errore Critico</h2>
                <p className="text-slate-600 dark:text-slate-300">{error}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-4">Prova a ricaricare la pagina. Se il problema persiste, potresti dover cancellare i dati del sito nelle impostazioni del browser.</p>
            </div>
        </div>
      );
  }

  return (
    <AppContext.Provider value={contextValue}>
      <div className="h-dvh font-sans flex bg-slate-100 dark:bg-slate-900">
        {isSyncing && (
          <div className="sync-indicator" title="Sincronizzazione in corso...">
              <i className="fas fa-cloud text-indigo-500 dark:text-indigo-400 text-lg"></i>
          </div>
        )}
        {!settings.apiKey && view !== AppView.Settings && <ApiKeyPrompt />}
        <Sidebar currentView={view} setView={handleSetView} />
        <main className="flex-1 relative overflow-y-auto p-4 md:p-6 lg:p-8 pb-20 md:pb-6">
            <div key={view} className={animationClass}>
              {renderView()}
            </div>
        </main>
        <BottomNavBar currentView={view} setView={handleSetView} />
      </div>
    </AppContext.Provider>
  );
};

const App: React.FC = () => {
  return (
    <SettingsProvider>
      <AppContent />
    </SettingsProvider>
  );
};


export default App;