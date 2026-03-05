

export enum AppView {
  Lessons = 'Lezioni',
  Calendar = 'Calendario',
  StudyPlan = 'Piano di Studio',
  Quiz = 'Quiz',
  Settings = 'Impostazioni'
}

export enum LessonStatus {
  Recorded = 'Registrata',
  Uploading = 'In caricamento',
  Processing = 'In elaborazione',
  ProcessingBackend = 'In elaborazione remota',
  PendingTopic = 'Argomento da confermare',
  Completed = 'Completata',
  Error = 'Errore',
  Cancelled = 'Annullato',
}

export enum BackendJobState {
  Pending = 'JOB_STATE_PENDING',
  Running = 'JOB_STATE_RUNNING',
  Succeeded = 'JOB_STATE_SUCCEEDED',
  Failed = 'JOB_STATE_FAILED',
  Cancelled = 'JOB_STATE_CANCELLED',
  Expired = 'JOB_STATE_EXPIRED',
}

export interface Lesson {
  id: string;
  subject: string;
  subfolder?: string;
  topic: string;
  suggestedTopic?: string;
  date: string;
  status: LessonStatus;
  order?: number; // Ordine manuale della lezione
  backendProcessingId?: string;
  backendJobStatus?: BackendJobState;
  
  // I dati sono ora salvati localmente
  audioBlob?: Blob;
  transcript?: string;
  summary?: string;
  error?: string; // Per messaggi di errore specifici
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: string;
}

export interface Quiz {
  id: string; // ID univoco per ogni quiz
  lessonId: string;
  createdAt: string; // Timestamp di creazione
  questions: QuizQuestion[];
}

export interface Flashcard {
  front: string;
  back: string;
}

export enum EventType {
  Lesson = 'lezione',
  Exam = 'esame',
  Task = 'compito',
  Personal = 'personale',
  Study = 'studio',
}

export interface RecurrenceRule {
  frequency: 'daily' | 'weekly' | 'monthly';
  interval: number;
  endDate: string; // YYYY-MM-DD
}

export interface CalendarEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD (start date for recurring events)
  startTime: string; // HH:mm
  duration: number; // in minutes
  type: EventType;
  cfu?: number;
  recurrence?: RecurrenceRule;
  exceptionDates?: string[]; // Date in formato YYYY-DD da escludere dalla ricorrenza
}

export interface StudySession {
  id:string;
  lessonId: string;
  date: string;
  topic: string;
  subject: string;
  actualTime?: number; // in minutes
  difficulty?: 'easy' | 'medium' | 'hard';
}

export interface StudyPlan {
  date: string; // YYYY-MM-DD
  sessions: {
    time: string; // e.g., "09:00 - 10:00"
    subject: string;
    topic: string;
    activity: string; // e.g., "Review summary", "Take a quiz"
  }[];
}

export interface GoogleUser {
  name: string;
  email: string;
  picture: string;
}

export enum GeminiModel {
  Pro = 'gemini-2.5-pro',
  Flash = 'gemini-2.5-flash',
  FlashLite = 'gemini-2.5-flash-lite',
  Gemini31Pro = 'gemini-3.1-pro-preview',
}

export const GeminiModelNames: Record<GeminiModel, string> = {
  [GeminiModel.Pro]: 'Gemini 2.5 Pro',
  [GeminiModel.Flash]: 'Gemini 2.5 Flash',
  [GeminiModel.FlashLite]: 'Gemini 2.5 Flash Lite',
  [GeminiModel.Gemini31Pro]: 'Gemini 3.1 Pro Preview',
};


export interface AppSettings {
  transcriptionModel: GeminiModel;
  analysisModel: GeminiModel;
  apiKey: string | null;
  theme: 'light' | 'dark';
}


// --- UTILITY FUNCTIONS ---

// Funzione helper per formattare una data in 'YYYY-MM-DD' indipendentemente dal fuso orario.
export const toYYYYMMDD = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

// Funzione per espandere gli eventi ricorrenti in un intervallo di date
export const expandRecurringEvents = (
  events: CalendarEvent[], 
  startDate: Date, 
  endDate: Date
): { date: string; event: CalendarEvent }[] => {
  const expanded: { date: string; event: CalendarEvent }[] = [];
  const startStr = toYYYYMMDD(startDate);
  const endStr = toYYYYMMDD(endDate);

  events.forEach(event => {
    if (!event.recurrence) {
      // Evento non ricorrente
      if (event.date >= startStr && event.date <= endStr) {
        expanded.push({ date: event.date, event });
      }
    } else {
      // Evento ricorrente
      const recurrence = event.recurrence;
      let currentDate = new Date(`${event.date}T00:00:00`);
      
      while (toYYYYMMDD(currentDate) <= recurrence.endDate) {
        const currentDateStr = toYYYYMMDD(currentDate);
        const isException = event.exceptionDates?.includes(currentDateStr);

        if (!isException && currentDateStr >= startStr && currentDateStr <= endStr) {
          expanded.push({ date: currentDateStr, event });
        }
        
        // Calcola la prossima occorrenza
        switch (recurrence.frequency) {
          case 'daily':
            currentDate.setDate(currentDate.getDate() + recurrence.interval);
            break;
          case 'weekly':
            currentDate.setDate(currentDate.getDate() + 7 * recurrence.interval);
            break;
          case 'monthly':
            currentDate.setMonth(currentDate.getMonth() + recurrence.interval);
            break;
        }
      }
    }
  });

  return expanded;
};
