import { Lesson, CalendarEvent, Quiz } from '../types';

const DB_NAME = 'SuperIntelligentDiaryDB';
const DB_VERSION = 2; // Versione incrementata per triggerare onupgradeneeded
const LESSONS_STORE = 'lessons';
const EVENTS_STORE = 'events';
const QUIZZES_STORE = 'quizzes';

class StorageService {
  private dbPromise: Promise<IDBDatabase>;

  constructor() {
    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('Errore nell\'apertura di IndexedDB:', request.error);
        reject(new Error(`Impossibile accedere al database. Assicurati di non essere in modalità di navigazione in incognito, poiché questa modalità potrebbe non supportare la memorizzazione dei dati a lungo termine.`));
      };

      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => {
          db.close();
          alert("Una nuova versione del database è pronta. L'applicazione verrà ricaricata per applicare le modifiche.");
          window.location.reload();
        };
        resolve(db);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(LESSONS_STORE)) {
          db.createObjectStore(LESSONS_STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(EVENTS_STORE)) {
          db.createObjectStore(EVENTS_STORE, { keyPath: 'id' });
        }
        // Migrazione dello store dei quiz
        if (db.objectStoreNames.contains(QUIZZES_STORE)) {
            db.deleteObjectStore(QUIZZES_STORE);
        }
        const quizStore = db.createObjectStore(QUIZZES_STORE, { keyPath: 'id' });
        quizStore.createIndex('lessonId_idx', 'lessonId', { unique: false });
      };
      
      request.onblocked = () => {
        console.warn("L'apertura del database è bloccata. Chiudi le altre schede con l'app aperta.");
        reject(new Error("La connessione al database è bloccata. Potrebbero esserci altre schede dell'applicazione aperte."));
      };
    });
  }
  
  private async getDb(): Promise<IDBDatabase> {
    return this.dbPromise;
  }

  private async performWriteTransaction(
    storeName: string,
    action: (store: IDBObjectStore) => IDBRequest
  ): Promise<void> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      
      const request = action(store);

      transaction.onerror = () => {
        console.error(`Errore nella transazione di scrittura per ${storeName}:`, transaction.error);
        if (transaction.error?.name === 'QuotaExceededError') {
          reject(new Error("Spazio di archiviazione esaurito. Non è possibile salvare nuovi dati. Prova a liberare spazio eliminando vecchie lezioni."));
        } else {
          reject(transaction.error || new Error(`Errore sconosciuto durante la transazione su ${storeName}.`));
        }
      };

      transaction.oncomplete = () => {
        resolve();
      };
      
      request.onerror = () => {
        console.error(`Errore specifico nella richiesta IDB per ${storeName}:`, request.error);
      };
    });
  }

  public async loadAllData<T>(storeName: string): Promise<T[]> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result as T[]);
        request.onerror = () => {
            console.error(`Errore nella lettura da ${storeName}:`, request.error);
            reject(request.error || new Error(`Errore sconosciuto durante la lettura da ${storeName}.`));
        };
    });
  }
  
  public async deleteDatabase(): Promise<void> {
    try {
      const db = await this.getDb();
      db.close();
    } catch (error) {
        console.warn("Connessione al DB non trovata da chiudere, si procede con l'eliminazione.", error);
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(DB_NAME);

      request.onerror = () => {
        console.error("Errore nell'eliminazione del database:", request.error);
        reject(new Error(`Errore nell'eliminazione del database: ${request.error?.message}`));
      };

      request.onsuccess = () => {
        console.log("Database eliminato con successo.");
        resolve();
      };
      
      request.onblocked = () => {
        console.warn("L'eliminazione del database è bloccata. Chiudi le altre schede con l'app aperta.");
        reject(new Error("L'eliminazione del database è bloccata. Potrebbero esserci altre connessioni aperte al database."));
      };
    });
  }

  public async deleteQuizzesByLessonId(lessonId: string): Promise<void> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(QUIZZES_STORE, 'readwrite');
        const store = transaction.objectStore(QUIZZES_STORE);
        const index = store.index('lessonId_idx');
        const cursorRequest = index.openCursor(IDBKeyRange.only(lessonId));

        cursorRequest.onsuccess = () => {
            const cursor = cursorRequest.result;
            if (cursor) {
                cursor.delete();
                cursor.continue();
            }
        };

        transaction.oncomplete = () => {
            resolve();
        };
        
        transaction.onerror = () => {
            console.error(`Errore nella transazione di eliminazione quiz per lessonId ${lessonId}:`, transaction.error);
            reject(transaction.error || new Error(`Errore sconosciuto durante l'eliminazione dei quiz.`));
        };
    });
  }

  public async exportAllData(): Promise<{ lessons: Lesson[], events: CalendarEvent[], quizzes: Quiz[] }> {
    const lessons = await this.loadAllData<Lesson>(LESSONS_STORE);
    const events = await this.getEvents();
    const quizzes = await this.getQuizzes();
    return { lessons, events, quizzes };
  }

  public async importData(data: { lessons: Lesson[], events: CalendarEvent[], quizzes: Quiz[] }): Promise<void> {
    if (!data || !Array.isArray(data.lessons) || !Array.isArray(data.events) || !Array.isArray(data.quizzes)) {
      throw new Error("Il file di backup non è valido o è corrotto. La struttura dei dati non è corretta.");
    }
  
    const db = await this.getDb();
    const storeNames = [LESSONS_STORE, EVENTS_STORE, QUIZZES_STORE];
  
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeNames, 'readwrite');
  
      transaction.onerror = () => {
        console.error("Errore durante la transazione di importazione:", transaction.error);
        reject(transaction.error || new Error("Si è verificato un errore sconosciuto durante l'importazione dei dati."));
      };
  
      transaction.oncomplete = () => {
        resolve();
      };
  
      storeNames.forEach(storeName => {
        transaction.objectStore(storeName).clear();
      });
  
      data.lessons.forEach(lesson => transaction.objectStore(LESSONS_STORE).put(lesson));
      data.events.forEach(event => transaction.objectStore(EVENTS_STORE).put(event));
      data.quizzes.forEach(quiz => transaction.objectStore(QUIZZES_STORE).put(quiz));
    });
  }

  public async getLessons(): Promise<Lesson[]> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(LESSONS_STORE, 'readonly');
        const store = transaction.objectStore(LESSONS_STORE);
        const request = store.openCursor();
        const lessons: Lesson[] = [];

        request.onerror = () => {
            console.error(`Errore nella lettura dei metadati da ${LESSONS_STORE}:`, request.error);
            reject(request.error || new Error(`Errore sconosciuto durante la lettura dei metadati da ${LESSONS_STORE}.`));
        };
        
        request.onsuccess = () => {
            const cursor = request.result;
            if (cursor) {
                const { transcript, summary, audioBlob, ...meta } = cursor.value;
                lessons.push(meta as Lesson);
                cursor.continue();
            } else {
                lessons.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                resolve(lessons);
            }
        };
    });
  }

  public async getLessonById(lessonId: string): Promise<Lesson | null> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(LESSONS_STORE, 'readonly');
        const store = transaction.objectStore(LESSONS_STORE);
        const request = store.get(lessonId);

        request.onerror = () => {
            console.error(`Errore nella lettura della lezione ${lessonId}:`, request.error);
            reject(request.error || new Error(`Errore sconosciuto durante la lettura della lezione ${lessonId}.`));
        };
        request.onsuccess = () => {
            resolve(request.result as Lesson || null);
        };
    });
  }

  public async getLessonContent(lessonId: string): Promise<{ transcript?: string; summary?: string }> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(LESSONS_STORE, 'readonly');
        const store = transaction.objectStore(LESSONS_STORE);
        const request = store.get(lessonId);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            if (request.result) {
                const { transcript, summary } = request.result;
                resolve({ transcript, summary });
            } else {
                resolve({});
            }
        };
    });
  }

  public async saveLesson(lesson: Lesson): Promise<void> {
    const db = await this.getDb();
    const transaction = db.transaction(LESSONS_STORE, 'readwrite');
    const store = transaction.objectStore(LESSONS_STORE);
    
    return new Promise((resolve, reject) => {
        const getRequest = store.get(lesson.id);

        getRequest.onerror = () => reject(getRequest.error);
        
        getRequest.onsuccess = () => {
            const existingLesson = getRequest.result;
            const finalLesson = { ...existingLesson, ...lesson };

            if ('audioBlob' in lesson && lesson.audioBlob === undefined) {
                 delete finalLesson.audioBlob;
            }

            const putRequest = store.put(finalLesson);
            putRequest.onerror = () => reject(putRequest.error);
        };

        transaction.oncomplete = () => {
            resolve();
        };

        transaction.onerror = () => {
            if (transaction.error?.name === 'QuotaExceededError') {
              reject(new Error("Spazio di archiviazione esaurito. Non è possibile salvare nuovi dati. Prova a liberare spazio eliminando vecchie lezioni."));
            } else {
              reject(transaction.error || new Error(`Errore sconosciuto durante la transazione su ${LESSONS_STORE}.`));
            }
        };
    });
  }
  
  public deleteLesson = (id: string) => this.performWriteTransaction(LESSONS_STORE, store => store.delete(id));
  
  public async updateLessonsOrder(orderedLessons: {id: string, order: number}[]): Promise<void> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(LESSONS_STORE, 'readwrite');
        const store = transaction.objectStore(LESSONS_STORE);

        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);

        orderedLessons.forEach(lessonInfo => {
            const request = store.get(lessonInfo.id);
            request.onsuccess = () => {
                const lesson = request.result;
                if (lesson) {
                    lesson.order = lessonInfo.order;
                    store.put(lesson);
                }
            };
            request.onerror = () => {
              // Non blocca la transazione, ma segnala l'errore
              console.error(`Impossibile trovare la lezione con ID ${lessonInfo.id} per l'aggiornamento dell'ordine.`);
            };
        });
    });
  }

  public getEvents = () => this.loadAllData<CalendarEvent>(EVENTS_STORE);
  public saveEvent = (event: CalendarEvent) => this.performWriteTransaction(EVENTS_STORE, store => store.put(event));
  public deleteEvent = (id:string) => this.performWriteTransaction(EVENTS_STORE, store => store.delete(id));

  public getQuizzes = () => this.loadAllData<Quiz>(QUIZZES_STORE);
  public saveQuiz = (quiz: Quiz) => this.performWriteTransaction(QUIZZES_STORE, store => store.put(quiz));
}

export const storageService = new StorageService();