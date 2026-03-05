import React, { useState, useContext, useEffect } from 'react';
import { AppContext } from '../../App';
import { Quiz, Lesson, QuizQuestion, GeminiModel } from '../../types';
import { generateQuiz, generateQuizExplanations } from '../../services/geminiService';
import RateLimitMessage from '../RateLimitMessage';

interface LessonQuizProps {
    lesson: Lesson;
    analysisModel: GeminiModel;
    apiKey: string;
}

const LessonQuiz: React.FC<LessonQuizProps> = ({ lesson, analysisModel, apiKey }) => {
    const { quizzes, saveQuiz, processingState, setProcessingState } = useContext(AppContext);
    const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [selectedAnswers, setSelectedAnswers] = useState<(string | null)[]>([]);
    const [showResults, setShowResults] = useState(false);
    const [resultsData, setResultsData] = useState<{ score: number; incorrect: { question: QuizQuestion; userAnswer: string | null }[] } | null>(null);
    const [explanations, setExplanations] = useState<Record<string, string> | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isRateLimited, setIsRateLimited] = useState(false);

    const isGenerating = !!processingState[`quiz-${lesson.id}`];
    const isLoadingExplanations = !!processingState[`explanations-${lesson.id}`];

    const lessonQuizzes = quizzes
        .filter(q => q.lessonId === lesson.id)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const handleGenerateQuiz = async () => {
        if (!apiKey || !lesson.summary) return;
        setProcessingState(`quiz-${lesson.id}`, true);
        setError(null);
        setIsRateLimited(false);
        try {
            const questions = await generateQuiz(lesson.summary, lesson.subject, lesson.topic, analysisModel, apiKey);
            const newQuiz: Quiz = {
                id: `quiz-${Date.now()}`,
                lessonId: lesson.id,
                createdAt: new Date().toISOString(),
                questions
            };
            await saveQuiz(newQuiz);
            startQuiz(newQuiz);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            if (errorMessage.startsWith('RATE_LIMIT_EXCEEDED::')) {
                setIsRateLimited(true);
            } else {
                setError(errorMessage.replace('Error: ', ''));
            }
        } finally {
            setProcessingState(`quiz-${lesson.id}`, false);
        }
    };

    const startQuiz = (quiz: Quiz) => {
        setActiveQuiz(quiz);
        setCurrentQuestionIndex(0);
        setSelectedAnswers(Array(quiz.questions.length).fill(null));
        setShowResults(false);
        setResultsData(null);
        setExplanations(null);
    };

    const handleAnswerSelect = (answer: string) => {
        if (showResults) return;
        const newAnswers = [...selectedAnswers];
        newAnswers[currentQuestionIndex] = answer;
        setSelectedAnswers(newAnswers);
    };

    const handleNext = () => {
        if (currentQuestionIndex < activeQuiz!.questions.length - 1) {
            setCurrentQuestionIndex(prev => prev + 1);
        } else {
            finishQuiz();
        }
    };

    const finishQuiz = async () => {
        const quiz = activeQuiz!;
        const score = selectedAnswers.reduce((acc, answer, index) => {
            return answer === quiz.questions[index].correctAnswer ? acc + 1 : acc;
        }, 0);

        const incorrectAnswers = quiz.questions
            .map((q, index) => ({ question: q, userAnswer: selectedAnswers[index] }))
            .filter(item => item.userAnswer !== item.question.correctAnswer);

        setResultsData({ score, incorrect: incorrectAnswers });
        setShowResults(true);

        if (incorrectAnswers.length > 0 && lesson.summary && apiKey) {
            setProcessingState(`explanations-${lesson.id}`, true);
            try {
                const fetchedExplanations = await generateQuizExplanations(lesson.summary, lesson.subject, lesson.topic, incorrectAnswers, analysisModel, apiKey);
                setExplanations(fetchedExplanations);
            } catch (error) {
                console.error("Failed to get explanations", error);
            } finally {
                setProcessingState(`explanations-${lesson.id}`, false);
            }
        }
    };

    if (activeQuiz && !showResults) {
        const currentQuestion = activeQuiz.questions[currentQuestionIndex];
        return (
            <div className="space-y-6 animate-fade-in">
                <div className="flex justify-between items-center">
                    <h3 className="font-bold text-slate-800 dark:text-slate-100">Domanda {currentQuestionIndex + 1} di {activeQuiz.questions.length}</h3>
                    <button onClick={() => setActiveQuiz(null)} className="text-xs text-slate-500 hover:text-red-500">Esci</button>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-xl border border-slate-200 dark:border-slate-700">
                    <h4 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-6">{currentQuestion.question}</h4>
                    <div className="space-y-3">
                        {currentQuestion.options.map(option => {
                            const isSelected = selectedAnswers[currentQuestionIndex] === option;
                            return (
                                <button 
                                    key={option} 
                                    onClick={() => handleAnswerSelect(option)} 
                                    className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                                        isSelected 
                                            ? 'bg-indigo-100 dark:bg-indigo-900/50 border-indigo-500 text-indigo-900 dark:text-indigo-100' 
                                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-indigo-300 dark:hover:border-indigo-700'
                                    }`}
                                >
                                    {option}
                                </button>
                            );
                        })}
                    </div>
                </div>
                <div className="flex justify-end">
                    <button
                        onClick={handleNext}
                        disabled={!selectedAnswers[currentQuestionIndex]}
                        className="bg-indigo-600 text-white font-bold py-2 px-8 rounded-lg shadow-md hover:bg-indigo-700 disabled:opacity-50 transition-all"
                    >
                        {currentQuestionIndex < activeQuiz.questions.length - 1 ? "Prossima" : "Termina"}
                    </button>
                </div>
            </div>
        );
    }

    if (showResults && resultsData) {
        return (
            <div className="space-y-6 animate-fade-in">
                <div className="text-center">
                    <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">Risultati</h3>
                    <p className="text-slate-600 dark:text-slate-400">Hai totalizzato {resultsData.score} su {activeQuiz!.questions.length}</p>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-3 mt-4">
                        <div className="bg-green-500 h-3 rounded-full transition-all duration-1000" style={{ width: `${(resultsData.score / activeQuiz!.questions.length) * 100}%` }}></div>
                    </div>
                </div>

                {resultsData.incorrect.length > 0 && (
                    <div className="space-y-4 mt-8">
                        <h4 className="font-bold text-slate-800 dark:text-slate-100 border-b dark:border-slate-700 pb-2">Revisione Errori</h4>
                        {resultsData.incorrect.map(({ question, userAnswer }, index) => (
                            <div key={index} className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700">
                                <p className="font-semibold text-slate-800 dark:text-slate-200 mb-3">{question.question}</p>
                                <div className="text-sm space-y-1 mb-4">
                                    <p className="text-red-600 dark:text-red-400 flex items-center"><i className="fas fa-times mr-2"></i>Tua: {userAnswer || "Nessuna"}</p>
                                    <p className="text-green-600 dark:text-green-400 flex items-center"><i className="fas fa-check mr-2"></i>Corretta: {question.correctAnswer}</p>
                                </div>
                                <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-md border border-indigo-100 dark:border-indigo-800 text-sm">
                                    <h5 className="font-bold text-indigo-800 dark:text-indigo-300 mb-1 flex items-center"><i className="fas fa-lightbulb mr-2"></i>Spiegazione AI</h5>
                                    {isLoadingExplanations ? (
                                        <p className="italic text-indigo-600 dark:text-indigo-400 animate-pulse">Generazione spiegazione...</p>
                                    ) : (
                                        <p className="text-indigo-900 dark:text-indigo-200">{explanations?.[question.question] || "Spiegazione non disponibile."}</p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                <div className="flex justify-center pt-4">
                    <button onClick={() => setActiveQuiz(null)} className="bg-indigo-600 text-white px-8 py-2 rounded-lg font-bold hover:bg-indigo-700 transition-all">Chiudi Quiz</button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="text-center p-8 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                <i className="fas fa-question-circle text-4xl text-slate-300 dark:text-slate-600 mb-4"></i>
                <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200">Mettiti alla prova</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Genera un quiz personalizzato su questa lezione per verificare quanto hai imparato.</p>
                
                {isRateLimited && <div className="mb-4"><RateLimitMessage /></div>}
                {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

                <button
                    onClick={handleGenerateQuiz}
                    disabled={isGenerating}
                    className="bg-indigo-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center justify-center mx-auto shadow-lg"
                >
                    {isGenerating ? (
                        <><i className="fas fa-spinner fa-spin mr-2"></i>Generazione...</>
                    ) : (
                        <><i className="fas fa-bolt mr-2"></i>Genera Quiz</>
                    )}
                </button>
            </div>

            {lessonQuizzes.length > 0 && (
                <div className="mt-8">
                    <h4 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">Quiz Precedenti</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {lessonQuizzes.map(q => (
                            <button 
                                key={q.id} 
                                onClick={() => startQuiz(q)}
                                className="p-3 text-left bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:border-indigo-500 dark:hover:border-indigo-500 transition-all flex justify-between items-center group"
                            >
                                <span className="text-sm text-slate-700 dark:text-slate-300">{new Date(q.createdAt).toLocaleDateString()} - {new Date(q.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                <i className="fas fa-play text-slate-300 group-hover:text-indigo-500 transition-colors"></i>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default LessonQuiz;
