import React, { useState, useRef, useEffect } from 'react';
import { Lesson } from '../../types';

interface LessonAudioPlayerProps {
    lesson: Lesson;
}

const LessonAudioPlayer: React.FC<LessonAudioPlayerProps> = ({ lesson }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const audioRef = useRef<HTMLAudioElement>(null);

    useEffect(() => {
        if (lesson.audioBlob) {
            const url = URL.createObjectURL(lesson.audioBlob);
            setAudioUrl(url);
            return () => URL.revokeObjectURL(url);
        }
    }, [lesson.audioBlob]);

    const togglePlay = () => {
        if (!audioRef.current) return;
        if (isPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.play();
        }
        setIsPlaying(!isPlaying);
    };

    const onTimeUpdate = () => {
        if (audioRef.current) {
            setCurrentTime(audioRef.current.currentTime);
        }
    };

    const onLoadedMetadata = () => {
        if (audioRef.current) {
            setDuration(audioRef.current.duration);
        }
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const time = parseFloat(e.target.value);
        if (audioRef.current) {
            audioRef.current.currentTime = time;
            setCurrentTime(time);
        }
    };

    const formatTime = (time: number) => {
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    if (!lesson.audioBlob || !audioUrl) return null;

    return (
        <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 mb-6">
            <audio 
                ref={audioRef} 
                src={audioUrl} 
                onTimeUpdate={onTimeUpdate} 
                onLoadedMetadata={onLoadedMetadata}
                onEnded={() => setIsPlaying(false)}
            />
            <div className="flex items-center space-x-4">
                <button 
                    onClick={togglePlay}
                    className="w-10 h-10 flex-shrink-0 bg-indigo-600 text-white rounded-full flex items-center justify-center hover:bg-indigo-700 transition-colors shadow-md"
                >
                    <i className={`fas ${isPlaying ? 'fa-pause' : 'fa-play'}`}></i>
                </button>
                <div className="flex-grow space-y-1">
                    <div className="flex justify-between text-[10px] font-mono text-slate-500 dark:text-slate-400">
                        <span>{formatTime(currentTime)}</span>
                        <span>{formatTime(duration)}</span>
                    </div>
                    <input 
                        type="range" 
                        min="0" 
                        max={duration || 0} 
                        step="0.1"
                        value={currentTime} 
                        onChange={handleSeek}
                        className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                    />
                </div>
            </div>
        </div>
    );
};

export default LessonAudioPlayer;
