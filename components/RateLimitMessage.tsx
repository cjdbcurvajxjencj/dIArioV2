import React, { useState, useEffect, useMemo } from 'react';

const RateLimitMessage: React.FC = () => {
    const calculateTimeRemaining = () => {
        const now = new Date();
        // Assume reset is at midnight UTC of the next day
        const tomorrow = new Date();
        tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
        tomorrow.setUTCHours(0, 0, 0, 0);

        const diff = tomorrow.getTime() - now.getTime();

        if (diff <= 0) {
            return { hours: '00', minutes: '00', seconds: '00' };
        }

        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        return {
            hours: String(hours).padStart(2, '0'),
            minutes: String(minutes).padStart(2, '0'),
            seconds: String(seconds).padStart(2, '0'),
        };
    };

    const [time, setTime] = useState(calculateTimeRemaining());

    useEffect(() => {
        const timer = setInterval(() => {
            setTime(calculateTimeRemaining());
        }, 1000);

        return () => clearInterval(timer);
    }, []);

    return (
        <div className="text-center p-3 bg-orange-50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-500/30 rounded-lg">
            <h4 className="font-bold text-orange-800 dark:text-orange-200 flex items-center justify-center">
                <i className="fas fa-hourglass-half mr-2"></i>
                Quota Giornaliera Esaurita
            </h4>
            <p className="text-sm text-orange-700 dark:text-orange-300 mt-2">
                Hai raggiunto il limite massimo di richieste all'IA per oggi.
                <br />
                Le funzionalità complete saranno ripristinate tra:
            </p>
            <div className="text-2xl font-mono font-bold text-orange-900 dark:text-orange-100 my-3 bg-white/50 dark:bg-black/20 p-2 rounded-lg inline-block shadow-inner">
                {time.hours}:{time.minutes}:{time.seconds}
            </div>
            <p className="text-xs text-orange-600 dark:text-orange-400">
                Nel frattempo, puoi ancora accedere ai riassunti e ai dati già elaborati.
            </p>
        </div>
    );
};

export default RateLimitMessage;