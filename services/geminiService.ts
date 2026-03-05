import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
import { Lesson, StudyPlan, CalendarEvent, QuizQuestion, LessonStatus, GeminiModel, expandRecurringEvents, Flashcard } from '../types';
import { getTranscriptPrompt, getSummaryPrompt, summarySchema, getStudyPlanPrompt, studyPlanSchema, getQuizPrompt, quizSchema, getFlashcardsPrompt, flashcardsSchema, getQuizExplanationsPrompt, explanationsSchema } from './prompts';

const RATE_LIMIT_ERROR_PREFIX = 'RATE_LIMIT_EXCEEDED::';

function showTemporaryMessage(message: string) {
    const containerId = 'global-notification-container';
    let container = document.getElementById(containerId);
    if (!container) {
        container = document.createElement('div');
        container.id = containerId;
        // Styles for container
        container.style.position = 'fixed';
        container.style.bottom = '80px'; // Above bottom nav on mobile
        container.style.left = '50%';
        container.style.transform = 'translateX(-50%)';
        container.style.zIndex = '1000';
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.gap = '10px';
        
        // Media query for desktop
        const styleSheet = document.createElement("style");
        styleSheet.innerText = `@media (min-width: 768px) { #${containerId} { bottom: 20px; left: auto; right: 20px; transform: none; } }`;
        document.head.appendChild(styleSheet);

        document.body.appendChild(container);
    }

    const notification = document.createElement('div');
    notification.innerHTML = `<i class="fas fa-sync-alt fa-spin" style="margin-right: 8px;"></i> ${message}`;
    
    // Styles for notification
    notification.style.backgroundColor = 'rgba(234, 179, 8, 0.95)'; // amber-500
    notification.style.color = '#1f2937'; // gray-800
    notification.style.padding = '12px 20px';
    notification.style.borderRadius = '8px';
    notification.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
    notification.style.opacity = '0';
    notification.style.transition = 'opacity 0.5s, transform 0.5s';
    notification.style.transform = 'translateY(20px)';
    notification.style.fontFamily = 'sans-serif';
    notification.style.fontSize = '14px';
    notification.style.fontWeight = '500';
    notification.style.display = 'flex';
    notification.style.alignItems = 'center';
    
    container.appendChild(notification);

    setTimeout(() => {
        notification.style.opacity = '1';
        notification.style.transform = 'translateY(0)';
    }, 10);

    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateY(20px)';
        notification.addEventListener('transitionend', () => {
            notification.remove();
            if (container && container.childElementCount === 0) {
                container.remove();
            }
        });
    }, 5000);
}


// Helper function to centralize API calls and handle rate limiting
async function geminiApiCall(
  params: {
    model: GeminiModel | string;
    contents: any;
    config?: any;
  },
  apiKey: string,
  isRetry: boolean = false
): Promise<GenerateContentResponse> {
  // The API key is now passed dynamically.
  if (!apiKey) {
    throw new Error('API Key non fornita. Vai nelle Impostazioni per aggiungerla.');
  }
  const ai = new GoogleGenAI({ apiKey });
  
  try {
    return await ai.models.generateContent(params);
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : String(e);

    // Handle XHR error (usually due to payload size or network timeout)
    if (errorMessage.includes('xhr error') || errorMessage.includes('error code: 6')) {
        throw new Error(`Errore di connessione con il server IA. Il file potrebbe essere troppo grande per l'elaborazione locale o la connessione è instabile. Riprova o usa il backend.`);
    }

    // Retry on 500 error, but only once
    if (!isRetry && (errorMessage.includes('"code":500') || errorMessage.includes('500 Internal Server Error'))) {
        console.warn("Internal Server Error (500) from Gemini detected. Retrying once with the default model.", e);
        
        showTemporaryMessage("Errore del server IA. Riprovo con il modello predefinito...");

        const retryParams = {
            ...params,
            model: GeminiModel.Flash, // Force default model on retry
        };
        try {
            const result = await geminiApiCall(retryParams, apiKey, true);
            console.log("Retry successful!");
            return result;
        } catch(retryError) {
            console.error("Retry failed:", retryError);
            throw new Error(`Si è verificato un errore interno del server. Un tentativo di riprovare con il modello predefinito è fallito. Riprova più tardi.`);
        }
    }

    // Handle rate limiting
    if (errorMessage.includes('429') || errorMessage.includes('RESOURCE_EXHAUSTED')) {
      throw new Error(`${RATE_LIMIT_ERROR_PREFIX}Hai superato la quota giornaliera di richieste all'IA.`);
    }
    
    // Re-throw other errors so they can be handled by the caller
    throw e;
  }
}

async function blobToGenerativePart(blob: Blob, mimeType: string) {
  return new Promise<{ inlineData: { data: string; mimeType: string } }>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve({
          inlineData: { data: reader.result.split(',')[1], mimeType },
        });
      } else {
        reject(new Error("Errore durante la conversione del file audio."));
      }
    };
    reader.onerror = () => reject(new Error("Errore durante la lettura del file audio."));
    reader.readAsDataURL(blob);
  });
}

export const transcribeAndSummarize = async (
    audioBlob: Blob, 
    lessonSubject: string, 
    transcriptionModel: GeminiModel,
    analysisModel: GeminiModel,
    apiKey: string
): Promise<{ transcript: string; summary: string; suggestedTopic: string }> => {
  const MAX_INLINE_DATA_SIZE = 200 * 1024 * 1024; // 200 MB limit
  if (audioBlob.size > MAX_INLINE_DATA_SIZE) {
    throw new Error(`Il file audio è troppo grande (${(audioBlob.size / 1024 / 1024).toFixed(2)} MB) per l'elaborazione locale. Il limite è di 200 MB. Usa il backend o registra lezioni più brevi.`);
  }

  const audioMimeType = audioBlob.type;
  if (!audioMimeType) {
    throw new Error("Il tipo MIME del file audio non è stato riconosciuto. Il file potrebbe essere corrotto o non supportato.");
  }
  
  const audioPart = await blobToGenerativePart(audioBlob, audioMimeType);

  // --- 1. TRASCRIZIONE ---
  console.log(`Inizio trascrizione con ${transcriptionModel} (${(audioBlob.size / 1024 / 1024).toFixed(2)} MB)...`);
  const transcriptPrompt = getTranscriptPrompt();

  const transcriptResponse = await geminiApiCall({
      model: transcriptionModel,
      contents: { parts: [transcriptPrompt, audioPart] },
  }, apiKey);
  const transcript = transcriptResponse.text;
  if (!transcript) throw new Error("La trascrizione ha prodotto un risultato vuoto.");
  console.log("Trascrizione completata.");

  // --- 2. RIASSUNTO E ARGOMENTO (UNIFICATI) ---
  console.log(`Inizio riassunto e generazione argomento con ${analysisModel}...`);
  const summaryPrompt = getSummaryPrompt(transcript, lessonSubject);
    
  const summaryResponse = await geminiApiCall({
      model: analysisModel,
      contents: summaryPrompt,
      config: {
          responseMimeType: "application/json",
          responseSchema: summarySchema,
      },
  }, apiKey);

  const jsonStr = (summaryResponse.text || '').trim();
  if (!jsonStr) {
    throw new Error("La generazione del riassunto ha prodotto un risultato vuoto.");
  }
  
  let summaryData: { summary: string, suggestedTopic: string };
  try {
      summaryData = JSON.parse(jsonStr);
  } catch(e) {
      console.error("Failed to parse JSON for summary/topic:", e, "JSON string:", jsonStr);
      throw new Error("Impossibile generare riassunto e argomento in formato JSON valido.");
  }
  
  const { summary, suggestedTopic } = summaryData;
  if (!summary || !suggestedTopic) throw new Error("Il riassunto o l'argomento generati sono vuoti.");

  console.log("Riassunto e argomento completati.");

  return { transcript, summary, suggestedTopic };
};


export const generateStudyPlan = async (lessons: Lesson[], events: CalendarEvent[], analysisModel: GeminiModel | string, apiKey: string): Promise<StudyPlan[]> => {
    const today = new Date();
    const todayISO = today.toISOString().split('T')[0];
    const todayString = today.toLocaleDateString('it-IT', { year: 'numeric', month: 'long', day: 'numeric' });
    const nextSevenDays = new Date();
    nextSevenDays.setDate(today.getDate() + 7);

    // Get all future exams and midterms
    const exams = events.filter(e => e.type === 'esame' && e.date >= todayISO && e.cfu && e.title);
    const midterms = events.filter(e => e.type === 'compito' && e.date >= todayISO);

    // --- 1. ANALISI CARICO DI STUDIO COMPLESSIVO ---
    const studyLoadAnalysis = await Promise.all(exams.map(async exam => {
        const examDate = new Date(`${exam.date}T00:00:00`);
        const totalRequiredHours = (exam.cfu || 0) * 25;

        // Find all lesson events for this subject
        const subjectLessonsEvents = events.filter(e => e.type === 'lezione' && e.title === exam.title);
        
        // Expand recurring lessons from start of time until the exam date
        const allLessonOccurrences = expandRecurringEvents(subjectLessonsEvents, new Date(0), examDate);
        
        // Sum duration of all lesson occurrences for this subject
        const scheduledLessonHours = allLessonOccurrences.reduce((total, occ) => total + (occ.event.duration || 0), 0) / 60;

        const remainingStudyHours = Math.max(0, totalRequiredHours - scheduledLessonHours);

        return `**Materia: ${exam.title}**
- Esame il: ${examDate.toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}
- CFU: ${exam.cfu} (Ore totali stimate: ${totalRequiredHours.toFixed(0)})
- Ore di lezione in calendario: ${scheduledLessonHours.toFixed(1)}
- **Studio autonomo da pianificare: ${remainingStudyHours.toFixed(1)} ore**`;
    })).then(results => results.filter(Boolean).join('\n\n'));

    const studyLoadInfo = studyLoadAnalysis || 'Nessun esame futuro con CFU impostato. Impossibile analizzare il carico di studio.';

    // --- 2. PROVE INTERMEDIE ---
    const midtermInfo = midterms.length > 0 
        ? midterms.map(m => `- ${m.title} il ${new Date(m.date + 'T00:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}`).join('\n')
        : 'Nessuna prova intermedia in programma.';

    // --- 3. LEZIONI RECENTI DA RIPASSARE ---
    const recentLessons = lessons
        .filter(l => l.status === LessonStatus.Completed)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 15) // Limit for brevity
        .map(l => `- ${l.subject}: ${l.topic}`)
        .join('\n') || 'Nessuna lezione recente da ripassare.';
    
    // --- 4. IMPEGNI DELLA PROSSIMA SETTIMANA ---
    const weeklyOccurrences = expandRecurringEvents(events, today, nextSevenDays);
    const weeklySchedule = weeklyOccurrences
        .filter(occ => occ.event.type !== 'esame' && occ.event.type !== 'compito')
        .map(occ => {
            const day = new Date(occ.date + 'T00:00:00').toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric' });
            return `- ${day}, ${occ.event.startTime} (${occ.event.duration} min): ${occ.event.type.toUpperCase()} - ${occ.event.title}`;
        })
        .join('\n') || 'Nessun altro impegno programmato per la prossima settimana.';

    // Combine exams and midterms to determine the current "phase"
    const importantTests = [
        ...exams.map(e => ({ ...e, testType: 'Esame' })),
        ...midterms.map(m => ({ ...m, testType: 'Prova Intercorso' }))
    ].sort((a, b) => a.date.localeCompare(b.date));
    
    // --- 5. NUOVO PROMPT ---
    const prompt = getStudyPlanPrompt(todayString, studyLoadInfo, midtermInfo, recentLessons, weeklySchedule);
    
    const response = await geminiApiCall({
        model: analysisModel,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: studyPlanSchema,
        },
    }, apiKey);

    let jsonStr = (response.text || '').trim();
    
    if (!jsonStr) {
        throw new Error("Impossibile generare il piano di studio: la risposta dell'API era vuota.");
    }

    try {
        const parsedData = JSON.parse(jsonStr);
        return parsedData as StudyPlan[];
    } catch (e) {
        console.error("Failed to parse JSON for study plan:", e, "JSON string:", jsonStr);
        throw new Error("Impossibile generare il piano di studio in formato valido.");
    }
};

export const generateQuiz = async (summary: string, subject: string, topic: string, analysisModel: GeminiModel | string, apiKey: string): Promise<QuizQuestion[]> => {
    const prompt = getQuizPrompt(subject, topic, summary);

    const response = await geminiApiCall({
        model: analysisModel,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: quizSchema,
        },
    }, apiKey);
    
    let jsonStr = (response.text || '').trim();
    if (!jsonStr) {
        throw new Error("Impossibile generare il quiz: la risposta dell'API era vuota.");
    }
    
    try {
        const parsedData = JSON.parse(jsonStr);
        if (Array.isArray(parsedData) && parsedData.every(q => q.question && Array.isArray(q.options) && q.options.length === 4 && q.correctAnswer)) {
          return parsedData as QuizQuestion[];
        }
        console.error("Dati del quiz non validi ricevuti dall'API:", parsedData);
        throw new Error("Il formato del quiz generato non è valido, anche se è JSON.");
    } catch (e) {
        console.error("Failed to parse JSON for quiz:", e, "JSON string:", jsonStr);
        throw new Error("Impossibile generare il quiz in formato JSON valido.");
    }
};


export const generateQuizExplanations = async (
    summary: string,
    subject: string,
    topic: string,
    incorrectAnswers: { question: QuizQuestion; userAnswer: string | null }[],
    analysisModel: GeminiModel | string,
    apiKey: string
): Promise<Record<string, string>> => {

    const questionsToExplain = incorrectAnswers.map(item => ({
        question: item.question.question,
        correctAnswer: item.question.correctAnswer,
        wrongAnswer: item.userAnswer
    }));

    const prompt = getQuizExplanationsPrompt(subject, topic, summary, questionsToExplain);

    const response = await geminiApiCall({
        model: analysisModel,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: explanationsSchema,
        },
    }, apiKey);
    
    let jsonStr = (response.text || '').trim();

    if (!jsonStr) {
        throw new Error("Impossibile generare le spiegazioni: la risposta dell'API era vuota.");
    }

    try {
        const parsedData = JSON.parse(jsonStr);
        return parsedData as Record<string, string>;
    } catch (e) {
        console.error("Failed to parse JSON for explanations:", e, "JSON string:", jsonStr);
        throw new Error("Impossibile generare le spiegazioni in formato JSON valido.");
    }
};

export const chatWithLesson = async (
    message: string,
    history: { role: 'user' | 'model', parts: { text: string }[] }[],
    summary: string,
    subject: string,
    topic: string,
    analysisModel: GeminiModel | string,
    apiKey: string
): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey });
    
    const systemInstruction = `Sei un tutor IA esperto in ${subject}.
Il tuo compito è rispondere alle domande dello studente basandoti sul seguente riassunto della lezione sull'argomento "${topic}".
Sii chiaro, conciso e didattico. Se la risposta non è nel riassunto, usa le tue conoscenze generali ma specifica che l'informazione non era nella lezione.

Riassunto della lezione:
---
${summary}
---`;

    try {
        const chat = ai.chats.create({
            model: analysisModel,
            config: {
                systemInstruction: systemInstruction,
            },
        });

        // We need to replay the history to the chat instance if there is any
        // The current @google/genai SDK doesn't have a direct way to initialize history
        // in the create() method like the old SDK did.
        // For a simple implementation, we can just prepend the history to the current message
        // if we can't set it directly.
        
        let fullMessage = message;
        if (history.length > 0) {
            const historyText = history.map(h => `${h.role === 'user' ? 'Studente' : 'Tutor'}: ${h.parts[0].text}`).join('\n\n');
            fullMessage = `Contesto della conversazione precedente:\n${historyText}\n\nNuova domanda dello studente: ${message}`;
        }

        const response = await chat.sendMessage({ message: fullMessage });
        return response.text || "Nessuna risposta generata.";
    } catch (e) {
        console.error("Errore durante la chat:", e);
        throw new Error("Impossibile generare una risposta. Riprova.");
    }
};
export const generateFlashcards = async (summary: string, subject: string, topic: string, analysisModel: GeminiModel | string, apiKey: string): Promise<Flashcard[]> => {
    const prompt = getFlashcardsPrompt(subject, topic, summary);

    const response = await geminiApiCall({
        model: analysisModel,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: flashcardsSchema,
        },
    }, apiKey);
    
    let jsonStr = (response.text || '').trim();
    if (!jsonStr) {
        throw new Error("Impossibile generare le flashcard: la risposta dell'API era vuota.");
    }
    
    try {
        const parsedData = JSON.parse(jsonStr);
        if (Array.isArray(parsedData) && parsedData.every(f => f.front && f.back)) {
          return parsedData as Flashcard[];
        } else {
            throw new Error("Formato JSON non valido per le flashcard.");
        }
    } catch (e) {
        console.error("Failed to parse JSON for flashcards:", e, "JSON string:", jsonStr);
        throw new Error("Impossibile generare le flashcard in formato valido.");
    }
};