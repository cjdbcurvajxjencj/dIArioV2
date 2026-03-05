import React, { useState, useRef, useEffect } from 'react';
import { Lesson, GeminiModel } from '../../types';
import { chatWithLesson } from '../../services/geminiService';
import MarkdownRenderer from '../MarkdownRenderer';

interface LessonChatProps {
    lesson: Lesson;
    analysisModel: GeminiModel;
    apiKey: string;
}

interface Message {
    role: 'user' | 'model';
    text: string;
}

const LessonChat: React.FC<LessonChatProps> = ({ lesson, analysisModel, apiKey }) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isSending, setIsSending] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim() || isSending || !apiKey) return;

        const userMessage = input.trim();
        setInput('');
        setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
        setIsSending(true);

        try {
            const history = messages.map(m => ({
                role: m.role,
                parts: [{ text: m.text }]
            }));

            const response = await chatWithLesson(
                userMessage,
                history,
                lesson.summary || '',
                lesson.subject,
                lesson.topic,
                analysisModel,
                apiKey
            );

            setMessages(prev => [...prev, { role: 'model', text: response }]);
        } catch (error) {
            console.error("Chat error:", error);
            setMessages(prev => [...prev, { role: 'model', text: "Scusa, si è verificato un errore durante la generazione della risposta. Riprova." }]);
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className="flex flex-col h-[500px] bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="p-3 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center">
                <i className="fas fa-robot text-indigo-500 mr-2"></i>
                <h3 className="font-bold text-slate-800 dark:text-slate-100">Tutor IA</h3>
            </div>

            <div className="flex-grow overflow-y-auto p-4 space-y-4">
                {messages.length === 0 && (
                    <div className="text-center py-10 text-slate-500 dark:text-slate-400">
                        <p className="text-sm">Fai una domanda su questa lezione!</p>
                        <p className="text-xs mt-1 italic">Esempio: "Quali sono i concetti chiave?"</p>
                    </div>
                )}
                {messages.map((m, i) => (
                    <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] p-3 rounded-2xl ${
                            m.role === 'user' 
                                ? 'bg-indigo-600 text-white rounded-tr-none' 
                                : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-tl-none shadow-sm'
                        }`}>
                            <div className="prose prose-sm dark:prose-invert max-w-none">
                                <MarkdownRenderer content={m.text} />
                            </div>
                        </div>
                    </div>
                ))}
                {isSending && (
                    <div className="flex justify-start">
                        <div className="bg-white dark:bg-slate-800 p-3 rounded-2xl rounded-tl-none border border-slate-200 dark:border-slate-700 shadow-sm">
                            <div className="flex space-x-1">
                                <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></div>
                                <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                                <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                            </div>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <div className="p-3 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700">
                <div className="flex items-center space-x-2">
                    <input
                        type="text"
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyPress={e => e.key === 'Enter' && handleSend()}
                        placeholder="Scrivi un messaggio..."
                        className="flex-grow p-2 bg-slate-100 dark:bg-slate-700 border-none rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500"
                        disabled={isSending}
                    />
                    <button
                        onClick={handleSend}
                        disabled={isSending || !input.trim()}
                        className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                    >
                        <i className="fas fa-paper-plane"></i>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LessonChat;
