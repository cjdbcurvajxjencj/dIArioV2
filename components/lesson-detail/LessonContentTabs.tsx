import React, { useState, useEffect, useRef } from 'react';
import { Lesson } from '../../types';
import MarkdownRenderer from '../MarkdownRenderer';
import { useDebounce } from '../../hooks/useDebounce';

interface LessonContentTabsProps {
    lesson: Lesson;
    isSearchVisible: boolean;
    setIsSearchVisible: (val: boolean) => void;
}

const LessonContentTabs: React.FC<LessonContentTabsProps> = ({
    lesson,
    isSearchVisible,
    setIsSearchVisible
}) => {
    const [activeTab, setActiveTab] = useState<'summary' | 'transcript'>('summary');
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearchTerm = useDebounce(searchTerm, 500);
    const [isSearching, setIsSearching] = useState(false);
    const [searchResults, setSearchResults] = useState<HTMLElement[]>([]);
    const [currentResultIndex, setCurrentResultIndex] = useState(-1);
    const contentRef = useRef<HTMLDivElement>(null);

    // --- SEARCH LOGIC ---
    const unhighlight = () => {
        if (!contentRef.current) return;
        contentRef.current.querySelectorAll('span.search-highlight, span.search-highlight-current').forEach(el => {
            const parent = el.parentNode;
            if (parent) {
                while (el.firstChild) {
                    parent.insertBefore(el.firstChild, el);
                }
                parent.removeChild(el);
                parent.normalize(); // Merges adjacent text nodes
            }
        });
    };
    
    useEffect(() => {
        setIsSearching(searchTerm.trim().length > 0 && searchTerm !== debouncedSearchTerm);
    }, [searchTerm, debouncedSearchTerm]);

    useEffect(() => {
        if (!isSearchVisible) {
            unhighlight();
            setSearchResults([]);
            setCurrentResultIndex(-1);
            return;
        }

        unhighlight();
        if (!debouncedSearchTerm.trim()) {
            setSearchResults([]);
            setCurrentResultIndex(-1);
            return;
        }

        const container = contentRef.current;
        if (!container) return;

        const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
        const term = debouncedSearchTerm.toLowerCase();
        const nodesToProcess: { node: Text; index: number }[] = [];

        let node;
        while ((node = walker.nextNode())) {
            const text = node.textContent?.toLowerCase() || '';
            let index = text.indexOf(term);
            while (index !== -1) {
                nodesToProcess.push({ node: node as Text, index });
                index = text.indexOf(term, index + 1);
            }
        }

        const results: HTMLElement[] = [];
        for (const { node, index } of nodesToProcess.reverse()) {
            if (node.parentElement?.classList.contains('search-highlight')) continue;

            const range = document.createRange();
            range.setStart(node, index);
            range.setEnd(node, index + debouncedSearchTerm.length);

            const highlightSpan = document.createElement('span');
            highlightSpan.className = 'search-highlight';
            try {
                range.surroundContents(highlightSpan);
                results.unshift(highlightSpan);
            } catch (e) {
                console.error("Error surrounding contents:", e, {node, index, term});
            }
        }
        
        setSearchResults(results);
        setCurrentResultIndex(results.length > 0 ? 0 : -1);

        return unhighlight;
    }, [debouncedSearchTerm, isSearchVisible, activeTab]);

    useEffect(() => {
        searchResults.forEach((el, index) => {
            el.classList.toggle('search-highlight-current', index === currentResultIndex);
        });

        if (currentResultIndex !== -1 && searchResults[currentResultIndex]) {
            requestAnimationFrame(() => {
                searchResults[currentResultIndex]?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center',
                    inline: 'nearest',
                });
            });
        }
    }, [currentResultIndex, searchResults]);
    // --- END SEARCH LOGIC ---

    return (
        <div className="relative">
            {isSearchVisible && (
                <div className="sticky top-0 z-10 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm p-3 mb-2 rounded-lg border dark:border-slate-700 shadow-sm animate-fade-in">
                    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                        {/* Search Input */}
                        <div className="flex items-center flex-grow min-w-[150px]">
                            <i className={`fas ${isSearching ? 'fa-spinner fa-spin' : 'fa-search'} text-slate-400`}></i>
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Cerca nel testo..."
                                className="w-full p-1 bg-transparent focus:outline-none text-slate-800 dark:text-slate-100 ml-2"
                                autoFocus
                            />
                        </div>
                        {/* Search Controls */}
                        <div className="flex items-center gap-x-3 flex-shrink-0">
                            <span className="text-sm font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                {searchResults.length > 0 ? currentResultIndex + 1 : 0} / {searchResults.length}
                            </span>
                            <div className="flex items-center">
                                <button onClick={() => setCurrentResultIndex(p => (p - 1 + searchResults.length) % searchResults.length)} disabled={searchResults.length === 0} className="px-2 py-1 rounded disabled:opacity-50 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"><i className="fas fa-chevron-up text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"></i></button>
                                <button onClick={() => setCurrentResultIndex(p => (p + 1) % searchResults.length)} disabled={searchResults.length === 0} className="px-2 py-1 rounded disabled:opacity-50 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"><i className="fas fa-chevron-down text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"></i></button>
                            </div>
                            <button onClick={() => { setIsSearchVisible(false); setSearchTerm(''); }} className="px-2 py-1 rounded text-slate-500 hover:text-red-500"><i className="fas fa-times"></i></button>
                        </div>
                    </div>
                </div>
            )}
            <div className="border-b border-slate-200 dark:border-slate-700 mb-4">
                <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                    <button onClick={() => setActiveTab('summary')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'summary' ? 'border-violet-500 text-violet-600 dark:text-violet-400' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-500'}`}>
                        <i className="fas fa-book-open mr-2"></i>Riassunto
                    </button>
                    <button onClick={() => setActiveTab('transcript')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'transcript' ? 'border-violet-500 text-violet-600 dark:text-violet-400' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-500'}`}>
                        <i className="fas fa-file-alt mr-2"></i>Trascrizione
                    </button>
                </nav>
            </div>

            <div ref={contentRef} className="prose prose-slate dark:prose-invert max-w-none text-slate-600 dark:text-slate-300 leading-relaxed">
                {activeTab === 'summary' ? (
                    <MarkdownRenderer content={lesson.summary || ''} />
                ) : (
                    <MarkdownRenderer content={lesson.transcript || ''} />
                )}
            </div>
        </div>
    );
};

export default LessonContentTabs;
