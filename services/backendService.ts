import { GeminiModel, Lesson, BackendJobState } from '../types';

// --- CONFIGURAZIONE CENTRALE DEL BACKEND ---
// URL statico del backend.
const BACKEND_URL = 'https://jakiproton-backend.hf.spac';

// Timeout aumentato a 30 minuti (1,800,000 ms) per upload di file audio di grandi dimensioni, prevenendo timeout su connessioni lente.
const UPLOAD_TIMEOUT = 1800000; 
// Timeout standard di 60 secondi per chiamate API generiche, per gestire i 'cold start' del server.
const API_TIMEOUT = 60000;
// Timeout aumentato a 3 minuti (180,000 ms) per le chiamate di sincronizzazione che possono richiedere più tempo su un backend carico.
const SYNC_TIMEOUT = 180000;
// Timeout di 30 secondi per le chiamate di stato che dovrebbero essere veloci.
const API_TIMEOUT_STATUS = 30000;

// Helper per fetch con timeout per chiamate API JSON
async function fetchWithTimeout(resource: string, options: RequestInit = {}, timeout: number = API_TIMEOUT): Promise<Response> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(resource, {
            ...options,
            signal: controller.signal  
        });
        clearTimeout(id);
        return response;
    } catch (e) {
        clearTimeout(id);
        if (e instanceof DOMException && e.name === 'AbortError') {
            throw new Error(`La richiesta al backend ha superato il limite di tempo di ${timeout / 1000} secondi.`);
        }
        throw e;
    }
}

export const checkBackendStatus = async (): Promise<'ONLINE' | 'OFFLINE'> => {
    if (!BACKEND_URL) return 'OFFLINE';
    try {
        const response = await fetchWithTimeout(`${BACKEND_URL}/status`, { 
            method: 'GET', 
            mode: 'cors',
            headers: {
                'ngrok-skip-browser-warning': 'true'
            }
        });
        if (response.ok) {
            const data = await response.json();
            if (data.status === 'ok') {
                return 'ONLINE';
            }
        }
        return 'OFFLINE';
    } catch (error) {
        console.warn('Controllo dello stato del backend fallito:', error);
        return 'OFFLINE';
    }
};

export interface UploadResponse {
    lesson_id: string;
}

export interface UploadControl {
    promise: Promise<UploadResponse>;
    abort: () => void;
}

export const uploadForProcessing = (
    apiKey: string,
    audioBlob: Blob,
    subject: string,
    transcriptionModel: GeminiModel,
    analysisModel: GeminiModel,
    onProgress: (percent: number) => void
): UploadControl => {
    const xhr = new XMLHttpRequest();

    const promise = new Promise<UploadResponse>((resolve, reject) => {
        const formData = new FormData();
        formData.append('file', audioBlob, `lesson-recording.${audioBlob.type.split('/')[1] || 'bin'}`);
        formData.append('subject', subject);
        formData.append('transcriptionModel', transcriptionModel);
        formData.append('analysisModel', analysisModel);

        xhr.open('POST', `${BACKEND_URL}/upload`, true);
        xhr.setRequestHeader('X-API-Key', apiKey);
        xhr.setRequestHeader('ngrok-skip-browser-warning', 'true');
        
        xhr.timeout = UPLOAD_TIMEOUT;

        xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
                const percentComplete = (event.loaded / event.total) * 100;
                onProgress(percentComplete);
            }
        };

        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    const jsonResponse = JSON.parse(xhr.responseText);
                    onProgress(100);
                    resolve(jsonResponse);
                } catch (e) {
                    reject(new Error('Impossibile analizzare la risposta del backend.'));
                }
            } else {
                reject(new Error(`Errore durante il caricamento sul backend: ${xhr.statusText} - ${xhr.responseText}`));
            }
        };

        xhr.onerror = () => {
             if (xhr.status === 0) { // Molti browser impostano lo stato a 0 per le richieste annullate.
                reject(new Error('Caricamento annullato dall\'utente.'));
            } else {
                reject(new Error('Errore di rete durante il caricamento.'));
            }
        };

        xhr.ontimeout = () => {
            reject(new Error(`La richiesta di caricamento ha superato il limite di tempo di ${UPLOAD_TIMEOUT / 1000} secondi.`));
        };

        xhr.send(formData);
    });

    return {
        promise,
        abort: () => xhr.abort()
    };
};

// --- FUNZIONE DI SINCRONIZZAZIONE E STATO ---

export interface SyncResult {
    lesson_id: string;
    status: 'processing' | 'completed' | 'error' | 'not_found' | 'cancelled';
    backend_job_status?: BackendJobState;
    result?: {
        transcript: string;
        summary: string;
        suggestedTopic: string;
    };
    message?: string;
}

export const getBackendJobStatus = async (apiKey: string, lessonId: string): Promise<SyncResult> => {
    const response = await fetchWithTimeout(`${BACKEND_URL}/status/${lessonId}`, {
        method: 'GET',
        headers: {
            'X-API-Key': apiKey,
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true'
        },
        mode: 'cors'
    }, API_TIMEOUT_STATUS);

    if (!response.ok) {
        if (response.status === 404) {
             return { lesson_id: lessonId, status: 'not_found', message: 'Job non trovato sul backend.' };
        }
        const errorText = await response.text();
        throw new Error(`Errore nel recupero dello stato del job: ${response.statusText} - ${errorText}`);
    }
    return response.json();
};

export const syncWithBackend = async (apiKey: string, knownIds: string[]): Promise<SyncResult[]> => {
    const response = await fetchWithTimeout(`${BACKEND_URL}/sync`, {
        method: 'POST',
        headers: {
            'X-API-Key': apiKey,
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify({ known_ids: knownIds }),
        mode: 'cors'
    }, SYNC_TIMEOUT);

    if (!response.ok) {
        throw new Error(`Errore durante la sincronizzazione con il backend: ${response.statusText}`);
    }
    return response.json();
};

export const cancelBackendJob = async (apiKey: string, lessonId: string): Promise<{ status: string }> => {
    const response = await fetchWithTimeout(`${BACKEND_URL}/cancel/${lessonId}`, {
        method: 'POST',
        headers: {
            'X-API-Key': apiKey,
            'ngrok-skip-browser-warning': 'true',
        },
        mode: 'cors',
    }, API_TIMEOUT_STATUS);

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Errore durante l'annullamento del job: ${response.statusText} - ${errorText}`);
    }
    return response.json();
};