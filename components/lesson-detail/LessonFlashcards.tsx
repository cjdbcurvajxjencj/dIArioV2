import React, { useState } from 'react';
import { Lesson, GeminiModel, Flashcard } from '../../types';
import { generateFlashcards } from '../../services/geminiService';

interface LessonFlashcardsProps {
    lesson: Lesson;
    analysisModel: GeminiModel;
    apiKey: string;
}

const LessonFlashcards: React.FC<LessonFlashcardsProps> = ({ lesson, analysisModel, apiKey }) => {
    const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);

    const handleGenerate = async () => {
        if (!apiKey || !lesson.summary) return;
        setIsGenerating(true);
        try {
            const cards = await generateFlashcards(
                lesson.summary,
                lesson.subject,
                lesson.topic,
                analysisModel,
                apiKey
            );
            setFlashcards(cards);
            setCurrentIndex(0);
            setIsFlipped(false);
        } catch (error) {
            console.error("Flashcards error:", error);
            alert("Errore durante la generazione delle flashcard.");
        } finally {
            setIsGenerating(false);
        }
    };

    const nextCard = () => {
        if (currentIndex < flashcards.length - 1) {
            setCurrentIndex(prev => prev + 1);
            setIsFlipped(false);
        }
    };

    const prevCard = () => {
        if (currentIndex > 0) {
            setCurrentIndex(prev => prev - 1);
            setIsFlipped(false);
        }
    };

    if (flashcards.length === 0) {
        return (
            <div className="text-center p-10 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                <i className="fas fa-clone text-4xl text-slate-300 dark:text-slate-600 mb-4"></i>
                <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200">Flashcard di Ripasso</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Genera delle flashcard basate sul contenuto della lezione per testare la tua memoria.</p>
                <button
                    onClick={handleGenerate}
                    disabled={isGenerating}
                    className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center justify-center mx-auto"
                >
                    {isGenerating ? (
                        <><i className="fas fa-spinner fa-spin mr-2"></i>Generazione...</>
                    ) : (
                        <><i className="fas fa-magic mr-2"></i>Genera Flashcard</>
                    )}
                </button>
            </div>
        );
    }

    const currentCard = flashcards[currentIndex];

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="font-bold text-slate-800 dark:text-slate-100">Flashcard ({currentIndex + 1}/{flashcards.length})</h3>
                <button onClick={handleGenerate} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline">Rigenera</button>
            </div>

            <div 
                className="perspective-1000 h-64 cursor-pointer"
                onClick={() => setIsFlipped(!isFlipped)}
            >
                <div className={`relative w-full h-full transition-transform duration-500 transform-style-3d ${isFlipped ? 'rotate-y-180' : ''}`}>
                    {/* Front */}
                    <div className="absolute inset-0 backface-hidden bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center p-6 text-center">
                        <p className="text-xl font-medium text-slate-800 dark:text-slate-100">{currentCard.front}</p>
                        <div className="absolute bottom-4 right-4 text-xs text-slate-400">Clicca per girare</div>
                    </div>
                    {/* Back */}
                    <div className="absolute inset-0 backface-hidden rotate-y-180 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl shadow-lg border border-indigo-200 dark:border-indigo-800 flex items-center justify-center p-6 text-center">
                        <p className="text-lg text-slate-700 dark:text-slate-200">{currentCard.back}</p>
                        <div className="absolute bottom-4 right-4 text-xs text-indigo-400">Risposta</div>
                    </div>
                </div>
            </div>

            <div className="flex justify-center items-center space-x-6">
                <button 
                    onClick={prevCard} 
                    disabled={currentIndex === 0}
                    className="w-12 h-12 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-30 transition-all"
                >
                    <i className="fas fa-chevron-left"></i>
                </button>
                <button 
                    onClick={nextCard} 
                    disabled={currentIndex === flashcards.length - 1}
                    className="w-12 h-12 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-30 transition-all"
                >
                    <i className="fas fa-chevron-right"></i>
                </button>
            </div>
        </div>
    );
};

export default LessonFlashcards;
