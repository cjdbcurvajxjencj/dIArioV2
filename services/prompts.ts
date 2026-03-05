import { Type } from "@google/genai";

export const getTranscriptPrompt = () => ({
  text: `Sei un assistente IA specializzato nella trascrizione di lezioni accademiche. Il tuo compito è produrre una trascrizione di alta qualità, fedele e leggibile, gestendo autonomamente audio di qualità variabile senza richiedere supervisione umana.

**Principi Fondamentali (da seguire in ordine di importanza):**

1.  **Priorità Assoluta: Evitare i Loop di Ripetizione.**
    *   Un errore comune nella trascrizione di audio di bassa qualità è rimanere bloccati, ripetendo la stessa frase o concetto più volte. La tua direttiva principale è evitare questo a tutti i costi.
    *   Se rilevi che stai trascrivendo la stessa sequenza di parole in modo innaturale e ripetitivo, interpretalo come un segnale di audio incomprensibile.
    *   In questo caso, interrompi immediatamente la ripetizione, inserisci un unico segnaposto \`[incomprensibile]\` per contrassegnare la sezione problematica, e procedi forzatamente con la trascrizione della parte successiva dell'audio. È molto meglio avere una lacuna segnalata che una trascrizione bloccata e inutilizzabile.

2.  **Monitoraggio del Flusso Logico (Contesto Dinamico):**
    *   Poiché l'argomento non è fornito, analizza i primi minuti per dedurre il tema. Presta attenzione alla progressione logica della lezione (es. da una definizione a un esempio, poi a un nuovo teorema). Questo ti aiuterà a riconoscere quando un nuovo argomento viene introdotto, anche se l'audio è debole, rendendoti meno incline a rimanere "ancorato" a un concetto precedente.

3.  **Regole Specifiche di Trascrizione e Formattazione:**
    *   **Fedeltà al Parlato:** Trascrivi ogni parola. Le ripetizioni di concetti o intere frasi usate dal docente per enfasi devono essere mantenute. Non è un riassunto.
    *   **Pulizia Minima e Conservativa:**
        *   Rimuovi solo: suoni di esitazione (es. 'ehm', 'uhm') e balbettii sulla stessa parola (es. "la la funzione" diventa "la funzione").
        *   Modera con cautela: gli intercalari riempitivi (es. "quindi", "cioè", "diciamo"). Mantienili solo se funzionali al discorso.
    *   **Focus Esclusivo sul Docente:** Ignora rumori di fondo, brusii e domande degli studenti.
    *   **Formattazione:**
        *   Usa punteggiatura accurata e suddividi il testo in paragrafi logici.
        *   Formatta tutte le formule matematiche e i simboli con la sintassi LaTeX (es. \`$A \\subseteq B$\`).

4.  **Output Finale:**
    *   Restituisci esclusivamente il testo della trascrizione, senza introduzioni, commenti o note.`
});

export const getSummaryPrompt = (transcript: string, lessonSubject: string) => `Dato il seguente testo di una trascrizione di una lezione di ${lessonSubject}, esegui due compiti e restituisci il risultato in un singolo oggetto JSON.

**COMPITO 1: RIELABORARE LA TRASCRIZIONE IN UN TESTO ACCADEMICO COMPLETO**
L'obiettivo non è la brevità, ma la **trasformazione del testo parlato in un documento scritto, completo, chiaro e ben strutturato, ideale per lo studio**.

**Principi Guida:**

1.  **Stile e Formalità:** Riformula il linguaggio colloquiale in uno stile accademico e formale. Elimina interiezioni, false partenze e ripetizioni non necessarie, mantenendo però intatto il contenuto informativo. Il risultato deve essere un testo scorrevole e professionale.

2.  **Completezza dell'Informazione:** Mantieni tutti i concetti, le definizioni, gli esempi e le argomentazioni presenti nella trascrizione. L'obiettivo è la riorganizzazione e la chiarificazione, non l'omissione di dettagli.

3.  **Flusso Logico:** Crea un flusso narrativo logico, anche se la lezione originale saltava tra gli argomenti. Raggruppa i concetti correlati sotto titoli appropriati per costruire una struttura didattica coerente.

4.  **Adattamento alla Materia:**
    *   **Materie Scientifiche/Tecniche (Matematica, Fisica, Informatica):** Dai priorità a definizioni formali, teoremi, passaggi logici delle dimostrazioni, algoritmi ed esempi pratici.
    *   **Materie Umanistiche (Storia, Letteratura, Filosofia):** Concentrati su tesi centrali, argomentazioni a supporto, contestualizzazione storica, analisi critiche e cronologie.
    *   **Materie Giuridiche/Economiche:** Focalizzati su principi, normative, articoli, casi di studio e modelli teorici.

5.  **Struttura Chiara e Organizzata:**
    *   Organizza il contenuto in modo gerarchico usando titoli (\`## Titolo\`), sottotitoli (\`### Sottotitolo\`) ed elenchi puntati per massimizzare la leggibilità e facilitare lo studio.

**COMPITO 2: SUGGERIRE UN TITOLO PER LA LEZIONE**
- Il titolo deve essere conciso (5-7 parole), descrittivo e accademico.

**ISTRUZIONI DI FORMATTAZIONE (MOLTO IMPORTANTI):**
1.  **Formule Matematiche (se presenti):**
    - **Formule inline:** Usa singoli simboli di dollaro (\`\$...\$\`).
    - **Formule su riga singola:** Usa doppi simboli di dollaro (\`\$\$...\$\$\`).
    - **Formule o derivazioni su più righe:** Usa l'ambiente \`aligned\` all'interno dei doppi simboli di dollaro. Allinea le equazioni su un operatore (es. \`=\`) usando \`& \` e vai a capo con \`\\\\\`. Esempio: \`$$\\begin{aligned} a &= b+c \\\\ &= d+e \\end{aligned}$$\`.
    - **Simboli comuni:** Usa comandi LaTeX standard (es. \`\\implies\`, \`\\in\`, \`\\frac{m}{n}\`).

**TESTO DA ANALIZZARE:**
---
${transcript}
---
`;

export const summarySchema = {
  type: Type.OBJECT,
  properties: {
    summary: {
      type: Type.STRING,
      description: "Il testo rielaborato della lezione, formattato in Markdown con formule LaTeX."
    },
    suggestedTopic: {
      type: Type.STRING,
      description: "Un titolo conciso e descrittivo di 5-7 parole per la lezione."
    }
  },
  required: ["summary", "suggestedTopic"]
};

export const getStudyPlanPrompt = (todayString: string, studyLoadInfo: string, midtermInfo: string, recentLessons: string, weeklySchedule: string) => `
Sei un tutor IA esperto, specializzato nella creazione di piani di studio universitari ottimizzati, realistici e personalizzati. Il tuo compito è generare un piano di studio dettagliato per i prossimi 7 giorni.

Il tuo metodo si basa su tre fasi strategiche:
1.  **Fase "Durante il Semestre" (Studio Bilanciato):** L'obiettivo è seguire le lezioni consolidando le conoscenze e distribuendo il carico di studio in modo proporzionale agli obiettivi a lungo termine (esami).
2.  **Fase "Preparazione Prova Intercorso":** Nelle due settimane (14 giorni) prima di una prova intercorso, il piano diventa mirato per quella prova, senza abbandonare le altre materie.
3.  **Fase "Full Immersion Pre-Esame":** Nell'ultimo mese (30 giorni) prima di un esame, il piano si concentra quasi esclusivamente sulla materia d'esame.

**DATI DELLO STUDENTE E CONTESTO ATTUALE:**
- Data odierna: ${todayString}

**ANALISI CARICO DI STUDIO COMPLESSIVO (basato su 1 CFU = 25 ore totali)**
Questa sezione mostra il lavoro da fare per ogni materia fino al giorno dell'esame.
${studyLoadInfo}

**PROVE INTERMEDIE IN PROGRAMMA**
Queste prove non hanno CFU ma richiedono preparazione dedicata.
${midtermInfo}

**ARGOMENTI DA STUDIARE QUESTA SETTIMANA (dalle lezioni recenti)**
${recentLessons}

**IMPEGNI GIÀ FISSATI PER I PROSSIMI 7 GIORNI**
Questi sono gli slot di tempo già occupati.
${weeklySchedule}

**ISTRUZIONI DETTAGLIATE PER LA GENERAZIONE DEL PIANO SETTIMANALE:**

1.  **Analizza il contesto e scegli la fase corretta:**
    - Controlla le scadenze. La scadenza più imminente tra esami e prove intermedie ha la priorità.
    - Se il prossimo evento è un **esame** e mancano **30 giorni o meno**, attiva la **"Full Immersion Pre-Esame"**.
    - Se il prossimo evento è una **prova intercorso** e mancano **14 giorni o meno**, attiva la **"Preparazione Prova Intercorso"**.
    - Altrimenti, applica la **"Durante il Semestre"**.

2.  **Genera il piano di studio per i prossimi 7 giorni in formato JSON, seguendo queste priorità:**
    - **Obiettivo primario:** Crea un piano **sostenibile e bilanciato** per aiutare lo studente a progredire.
    - **VINCOLO CRITICO:** Il piano deve includere **SOLO ed ESCLUSIVAMENTE sessioni di studio autonomo** (es: ripasso, esercizi, approfondimenti, schematizzazione). **NON** includere la partecipazione alle lezioni o ad altri eventi già elencati nella sezione "IMPEGNI GIÀ FISSATI". Il tuo compito è riempire gli slot di tempo libero, non duplicare l'agenda esistente.
    - **Usa l'Analisi del Carico di Studio:** La sezione "Studio autonomo da pianificare" è l'indicatore più importante. Distribuisci le ore di studio settimanali in modo **proporzionale** a questo valore. Le materie con più ore da recuperare necessitano di più attenzione.
    - **Integra le Lezioni Recenti:** Le attività di studio ("activity") devono essere specifiche e basate sugli argomenti elencati nelle "Lezioni recenti". Associa gli argomenti corretti alle materie nel piano.
    - **Rispetta gli Impegni:** Non programmare MAI sessioni di studio durante gli orari già occupati in agenda. Prevedi sessioni di 1-2 ore con pause.

3.  **Regole per le Fasi:**
    - **"Full Immersion":** Dedica ~90% del tempo alla materia d'esame (ripasso, esercizi, simulazioni). Usa il restante 10% per un ripasso veloce delle altre materie più importanti.
    - **"Preparazione Prova Intercorso":** Dedica ~75% del tempo alla materia della prova. Il restante 25% va distribuito sulle altre materie in base al loro "carico di studio" pendente.
    - **"Durante il Semestre":** Applica rigorosamente la distribuzione proporzionale basata sul "carico di studio", creando attività basate sugli argomenti delle lezioni recenti.
`;

export const studyPlanSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      date: { type: Type.STRING, description: "Data nel formato YYYY-MM-DD" },
      sessions: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            time: { type: Type.STRING, description: "Orario della sessione, es. 15:00 - 17:00" },
            subject: { type: Type.STRING, description: "Materia da studiare" },
            topic: { type: Type.STRING, description: "Argomento specifico" },
            activity: { type: Type.STRING, description: "Attività da svolgere" }
          },
          required: ["time", "subject", "topic", "activity"]
        }
      }
    },
    required: ["date", "sessions"]
  }
};

export const getQuizPrompt = (subject: string, topic: string, summary: string) => `
Basandoti sul seguente riassunto di una lezione di ${subject} sull'argomento "${topic}", crea un quiz a scelta multipla per testare la comprensione.

Il quiz deve contenere 5 domande.
Ogni domanda deve avere:
- 4 opzioni di risposta.
- Una sola opzione corretta.
- Le opzioni devono essere plausibili ma distinguibili.

Riassunto:
---
${summary}
---
`;

export const quizSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      question: {
        type: Type.STRING,
        description: 'Il testo della domanda del quiz.',
      },
      options: {
        type: Type.ARRAY,
        description: 'Un array di 4 stringhe con le possibili risposte.',
        items: { type: Type.STRING },
      },
      correctAnswer: {
          type: Type.STRING,
          description: 'La stringa esatta della risposta corretta, che deve essere una delle stringhe in `options`.'
      }
    },
    required: ["question", "options", "correctAnswer"],
  },
};

export const getQuizExplanationsPrompt = (subject: string, topic: string, summary: string, questionsToExplain: any[]) => `
Sei un tutor IA. Il tuo compito è fornire spiegazioni chiare e concise per le domande di un quiz a cui uno studente ha risposto in modo errato.
Basati sul riassunto della lezione fornito per contestualizzare la tua risposta.

Per ogni domanda fornita, spiega perché la risposta corretta è giusta, facendo riferimento ai concetti chiave del riassunto. Sii incoraggiante e didattico.
La spiegazione non deve superare le 2-3 frasi.

**Contesto della Lezione:**
- Materia: ${subject}
- Argomento: ${topic}
- Riassunto:
  ---
  ${summary}
  ---

**Domande a cui rispondere:**
${JSON.stringify(questionsToExplain, null, 2)}
`;

export const explanationsSchema = {
  type: Type.OBJECT,
  description: "Un dizionario dove la chiave è la domanda e il valore è la spiegazione.",
  additionalProperties: { type: Type.STRING }
};
export const getFlashcardsPrompt = (subject: string, topic: string, summary: string) => `
Basandoti sul seguente riassunto di una lezione di ${subject} sull'argomento "${topic}", crea 10 flashcard per lo studio e il ripasso.

Ogni flashcard deve avere:
- Una "front" (fronte) con una domanda chiara, un concetto chiave o un termine da definire.
- Una "back" (retro) con la risposta concisa, la definizione o la spiegazione.

Le flashcard devono coprire i concetti più importanti del riassunto.

Riassunto:
---
${summary}
---
`;

export const flashcardsSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      front: { type: Type.STRING, description: "La domanda o il concetto chiave." },
      back: { type: Type.STRING, description: "La risposta o la spiegazione." }
    },
    required: ["front", "back"]
  }
};
