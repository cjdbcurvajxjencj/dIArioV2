import React, { useState, useContext, useEffect } from 'react';
import { AppContext } from '../App';
import { Quiz, Lesson, LessonStatus, QuizQuestion } from '../types';
import { generateQuiz, generateQuizExplanations } from '../services/geminiService';
import RateLimitMessage from './RateLimitMessage';
import { useSettings } from '../useSettings';

const QUIZ_GENERATION_KEY = 'quiz-generation';
const EXPLANATIONS_GENERATION_KEY = 'explanations-generation';

const QuizGenerator: React.FC<{
    setQuiz: React.Dispatch<React.SetStateAction<Quiz | null>>
    setSelectedLesson: React.Dispatch<React.SetStateAction<Lesson | null>>
}> = ({ setQuiz, setSelectedLesson }) => {
    const { lessons, quizzes, saveQuiz, processingState, setProcessingState } = useContext(AppContext);
    const { settings } = useSettings();
    const [selectedLessonId, setSelectedLessonId] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    const [isRateLimited, setIsRateLimited] = useState(false);

    const isLoading = !!processingState[QUIZ_GENERATION_KEY];

    const availableLessons = lessons.filter(l => l.status === LessonStatus.Completed);
    const selectedLesson = availableLessons.find(l => l.id === selectedLessonId);

    const lessonQuizzes = quizzes
        .filter(q => q.lessonId === selectedLessonId)
        .sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());


    const handleGenerateQuiz = async () => {
        if (!selectedLesson) {
            setError("Seleziona una lezione valida per procedere.");
            return;
        }
        if (!settings.apiKey) {
            alert("API Key non trovata. Per favore, vai nelle impostazioni per aggiungerla.");
            return;
        }

        setProcessingState(QUIZ_GENERATION_KEY, true);
        setError(null);
        setIsRateLimited(false);
        try {
            if (!selectedLesson.summary) throw new Error("Il riassunto non è disponibile per questa lezione. Impossibile generare il quiz.");
            
            const questions = await generateQuiz(selectedLesson.summary, selectedLesson.subject, selectedLesson.topic, settings.analysisModel, settings.apiKey);
            const newQuiz: Quiz = { 
                id: `quiz-${Date.now()}`,
                lessonId: selectedLessonId,
                createdAt: new Date().toISOString(),
                questions 
            };
            await saveQuiz(newQuiz);
            setSelectedLesson(selectedLesson);
            setQuiz(newQuiz);

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            if (errorMessage.startsWith('RATE_LIMIT_EXCEEDED::')) {
                setIsRateLimited(true);
            } else {
                 setError(errorMessage.replace('Error: ', ''));
            }
        } finally {
            setProcessingState(QUIZ_GENERATION_KEY, false);
        }
    };

    const handleStartExistingQuiz = (quiz: Quiz) => {
        if (!selectedLesson) return;
        setSelectedLesson(selectedLesson);
        setQuiz(quiz);
    };

    return (
        <div className="bg-white dark:bg-slate-800 p-8 rounded-lg shadow-xl max-w-2xl mx-auto">
            <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-100 mb-2">Quiz</h2>
            <p className="text-slate-500 dark:text-slate-400 mb-6">Metti alla prova la tua conoscenza: ripeti un quiz o generarne uno nuovo basato sull'analisi AI della lezione.</p>
            {availableLessons.length > 0 ? (
                 <div className="space-y-6">
                    <div>
                        <label htmlFor="lesson-select" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">1. Seleziona una lezione</label>
                        <select
                            id="lesson-select"
                            value={selectedLessonId}
                            onChange={e => {
                                setSelectedLessonId(e.target.value)
                                setError(null);
                                setIsRateLimited(false);
                            }}
                            className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500"
                        >
                            <option value="" disabled>-- Scegli un argomento --</option>
                            {availableLessons.map(l => (
                                <option key={l.id} value={l.id}>{l.subject}: {l.topic}</option>
                            ))}
                        </select>
                    </div>

                    {selectedLessonId && (
                        <div className="animate-fade-in">
                            <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200 my-4">2. Scegli un'azione</h3>
                            <div className="space-y-4">
                               <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 bg-slate-50 dark:bg-slate-700/50">
                                   <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-3">Quiz Svolti in Precedenza</h4>
                                   {lessonQuizzes.length > 0 ? (
                                       <ul className="space-y-2 max-h-48 overflow-y-auto">
                                           {lessonQuizzes.map(quiz => (
                                               <li key={quiz.id}>
                                                   <button 
                                                       onClick={() => handleStartExistingQuiz(quiz)}
                                                       className="w-full text-left p-3 rounded-md bg-white dark:bg-slate-700 hover:bg-indigo-50 dark:hover:bg-slate-600 transition-colors flex justify-between items-center shadow-sm border border-slate-200 dark:border-slate-600"
                                                   >
                                                       <span className="text-slate-800 dark:text-slate-200">Svolto il: {new Date(quiz.createdAt).toLocaleString('it-IT')}</span>
                                                       <i className="fas fa-chevron-right text-slate-400 dark:text-slate-500"></i>
                                                   </button>
                                               </li>
                                           ))}
                                       </ul>
                                   ) : (
                                       <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-2">Nessun quiz svolto per questa lezione.</p>
                                   )}
                               </div>
                                <button
                                    onClick={handleGenerateQuiz}
                                    disabled={isLoading}
                                    className="w-full bg-indigo-600 text-white font-bold py-3 px-6 rounded-lg shadow-md hover:bg-indigo-700 transition-transform transform hover:scale-105 active:scale-95 disabled:bg-slate-400 dark:disabled:bg-slate-600 disabled:cursor-not-allowed flex items-center justify-center"
                                >
                                    {isLoading ? 'Generazione...' : <><i className="fas fa-magic mr-2"></i>Genera Nuovo Quiz</>}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <p className="text-center text-slate-500 dark:text-slate-400 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">Nessuna lezione completata disponibile per creare un quiz. Completa prima l'elaborazione di una lezione.</p>
            )}
             {error && <p className="text-red-500 dark:text-red-400 mt-4">{error}</p>}
             {isRateLimited && <div className="mt-4"><RateLimitMessage /></div>}
        </div>
    );
};

const ActiveQuiz: React.FC<{ quiz: Quiz; lesson: Lesson; onFinish: () => void }> = ({ quiz, lesson, onFinish }) => {
    const { processingState, setProcessingState } = useContext(AppContext);
    const { settings } = useSettings();
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [selectedAnswers, setSelectedAnswers] = useState<(string | null)[]>(Array(quiz.questions.length).fill(null));
    const [showResults, setShowResults] = useState(false);
    
    const [resultsData, setResultsData] = useState<{ score: number; incorrect: { question: QuizQuestion; userAnswer: string | null }[] } | null>(null);
    const [explanations, setExplanations] = useState<Record<string, string> | null>(null);
    const [explanationsError, setExplanationsError] = useState<string | null>(null);

    const isLoadingExplanations = !!processingState[EXPLANATIONS_GENERATION_KEY];

    const handleAnswerSelect = (answer: string) => {
        if (showResults) return;
        const newAnswers = [...selectedAnswers];
        newAnswers[currentQuestionIndex] = answer;
        setSelectedAnswers(newAnswers);
    };

    const handleFinishQuiz = async () => {
        const score = selectedAnswers.reduce((acc, answer, index) => {
            return answer === quiz.questions[index].correctAnswer ? acc + 1 : acc;
        }, 0);

        const incorrectAnswers = quiz.questions
            .map((q, index) => ({ question: q, userAnswer: selectedAnswers[index] }))
            .filter(item => item.userAnswer !== item.question.correctAnswer);

        setResultsData({ score, incorrect: incorrectAnswers });
        setShowResults(true);

        if (incorrectAnswers.length > 0 && lesson.summary && settings.apiKey) {
            setProcessingState(EXPLANATIONS_GENERATION_KEY, true);
            setExplanationsError(null);
            try {
                const fetchedExplanations = await generateQuizExplanations(lesson.summary, lesson.subject, lesson.topic, incorrectAnswers, settings.analysisModel, settings.apiKey);
                setExplanations(fetchedExplanations);
            } catch (error) {
                console.error("Failed to get explanations", error);
                const errorMessage = error instanceof Error ? error.message : String(error);
                setExplanationsError(errorMessage.replace('Error: ', ''));
            } finally {
                setProcessingState(EXPLANATIONS_GENERATION_KEY, false);
            }
        }
    };

    const handleNext = () => {
        if (currentQuestionIndex < quiz.questions.length - 1) {
            setCurrentQuestionIndex(currentQuestionIndex + 1);
        } else {
            handleFinishQuiz();
        }
    };
    
    if (showResults && resultsData) {
        const isRateLimited = explanationsError?.startsWith('RATE_LIMIT_EXCEEDED::');
        return (
            <div className="bg-white dark:bg-slate-800 p-8 rounded-lg shadow-xl max-w-3xl mx-auto animate-fade-in">
                 <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">Risultati del Quiz</h2>
                 <p className="text-lg text-slate-600 dark:text-slate-300 mb-4">Hai risposto correttamente a <span className="font-bold text-indigo-600 dark:text-indigo-400">{resultsData.score}</span> su <span className="font-bold">{quiz.questions.length}</span> domande.</p>
                 <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-4 mb-6">
                    <div className="bg-green-500 h-4 rounded-full" style={{ width: `${(resultsData.score / quiz.questions.length) * 100}%` }}></div>
                 </div>

                 {resultsData.incorrect.length > 0 && (
                     <div className="mt-8">
                         <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-4 border-t dark:border-slate-700 pt-4">Rivedi i tuoi errori</h3>
                         
                         {isRateLimited && <div className="mb-4"><RateLimitMessage /></div>}
                         {explanationsError && !isRateLimited && <p className="text-red-500 dark:text-red-400 mb-4">{explanationsError}</p>}
                         
                         <div className="space-y-6">
                             {resultsData.incorrect.map(({ question, userAnswer }, index) => (
                                 <div key={index} className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-700/50">
                                     <p className="font-semibold text-slate-700 dark:text-slate-200 mb-3">{index + 1}. {question.question}</p>
                                     <div className="text-sm space-y-2">
                                         <p className="flex items-center text-red-700 dark:text-red-400"><i className="fas fa-times-circle w-4 text-center mr-2"></i>La tua risposta: <span className="font-medium ml-1 bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-200 px-2 py-0.5 rounded">{userAnswer || "Nessuna"}</span></p>
                                         <p className="flex items-center text-green-700 dark:text-green-400"><i className="fas fa-check-circle w-4 text-center mr-2"></i>Risposta corretta: <span className="font-medium ml-1 bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200 px-2 py-0.5 rounded">{question.correctAnswer}</span></p>
                                     </div>
                                     
                                     {!explanationsError && settings.apiKey && (
                                         <div className="mt-4 p-3 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-500/30 text-indigo-800 dark:text-indigo-200 rounded-md text-sm">
                                            <h4 className="font-bold mb-1 flex items-center"><i className="fas fa-lightbulb mr-2"></i>Spiegazione AI</h4>
                                            {isLoadingExplanations ? (
                                                <p className="italic">Caricamento spiegazione...</p>

                                            ) : (
                                                <p>{explanations?.[question.question] || "Spiegazione non disponibile."}</p>
                                            )}
                                         </div>
                                     )}
                                 </div>
                             ))}
                         </div>
                     </div>
                 )}
                 
                 <div className="text-center mt-8 border-t dark:border-slate-700 pt-6">
                    <button onClick={onFinish} className="bg-indigo-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-indigo-700 transition-colors">Torna alla selezione</button>
                 </div>
            </div>
        )
    }

    const currentQuestion = quiz.questions[currentQuestionIndex];

    return (
        <div className="bg-white dark:bg-slate-800 p-8 rounded-lg shadow-xl max-w-2xl mx-auto">
            <div key={currentQuestionIndex} className="animate-fade-in">
                <h3 className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">{lesson.subject}: {lesson.topic}</h3>
                <p className="text-slate-500 dark:text-slate-400 mb-4">Domanda {currentQuestionIndex + 1} di {quiz.questions.length}</p>
                <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-6">{currentQuestion.question}</h2>
                <div className="space-y-3">
                    {currentQuestion.options.map(option => {
                        const isSelected = selectedAnswers[currentQuestionIndex] === option;
                        return (
                            <button key={option} onClick={() => handleAnswerSelect(option)} className={`w-full text-left p-4 rounded-lg border-2 transition-colors text-slate-800 dark:text-slate-200 ${isSelected ? 'bg-indigo-100 dark:bg-indigo-900/50 border-indigo-500' : 'bg-slate-50 dark:bg-slate-700/50 border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>
                                {option}
                            </button>
                        )
                    })}
                </div>
            </div>
             <div className="flex justify-end mt-8">
                <button
                    onClick={handleNext}
                    disabled={!selectedAnswers[currentQuestionIndex]}
                    className="bg-indigo-600 text-white font-bold py-2 px-8 rounded-lg shadow-md hover:bg-indigo-700 transition-colors disabled:bg-slate-400 dark:disabled:bg-slate-600 disabled:cursor-not-allowed transform active:scale-95"
                >
                    {currentQuestionIndex < quiz.questions.length - 1 ? "Prossima" : "Termina"}
                </button>
            </div>
        </div>
    );
};


const QuizView: React.FC = () => {
    const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
    const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);

    const handleFinish = () => {
        setActiveQuiz(null);
        setSelectedLesson(null);
    }

    return (
        <div>
            {activeQuiz && selectedLesson ? (
                <ActiveQuiz quiz={activeQuiz} lesson={selectedLesson} onFinish={handleFinish} />
            ) : (
                <QuizGenerator setQuiz={setActiveQuiz} setSelectedLesson={setSelectedLesson} />
            )}
        </div>
    );
};

export default QuizView;