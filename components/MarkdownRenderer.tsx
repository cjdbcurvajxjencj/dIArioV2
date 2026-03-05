import React, { useMemo } from 'react';
import katex from 'katex';

const MarkdownRenderer: React.FC<{ content: string; className?: string }> = React.memo(({ content, className = '' }) => {
    // This function renders inline elements like bold, italic, and inline math.
    const renderInline = (text: string): string => {
        let processed = text;
        // Process bold **text**
        processed = processed.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-slate-800 dark:text-slate-100">$1</strong>');
        // Process italic *text*
        processed = processed.replace(/\*(.*?)\*/g, '<em>$1</em>');
        // Process inline math $...$
        processed = processed.replace(/\$(.*?)\$/g, (match, formula) => {
            try {
                // Use KaTeX to render the formula.
                return katex.renderToString(formula, { throwOnError: false, displayMode: false, strict: (errorCode) => (errorCode === 'unicodeTextInMathMode' ? 'ignore' : 'warn') });
            } catch (e) {
                // If KaTeX fails, return the original text.
                return match;
            }
        });
        return processed;
    };

    const htmlContent = useMemo(() => {
        if (!content) return '';

        // 1. Process block-level math first ($$ ... $$)
        const parts = content.split(/(\$\$[\s\S]*?\$\$)/g);

        return parts.map(part => {
            if (part.startsWith('$$') && part.endsWith('$$')) {
                try {
                    return katex.renderToString(part.slice(2, -2), {
                        displayMode: true,
                        throwOnError: false,
                        strict: (errorCode) => (errorCode === 'unicodeTextInMathMode' ? 'ignore' : 'warn'),
                    });
                } catch (e) {
                    return `<pre class="bg-red-100 text-red-800 p-2 rounded">KaTeX Error: ${e instanceof Error ? e.message : String(e)}</pre>`;
                }
            }
            
            // 2. Build an array of structured blocks (paragraphs, lists, headings)
            const lines = part.trim().split('\n');
            const blocks: { type: 'p' | 'h2' | 'h3' | 'h4' | 'hr' | 'ul'; lines: string[] }[] = [];
            
            for (const line of lines) {
                const trimmedLine = line.trim();
                if (trimmedLine === '') continue;

                const lastBlock = blocks[blocks.length - 1];
                const listItemMatch = trimmedLine.match(/^\s*\*\s+(.*)/);

                if (trimmedLine.startsWith('## ')) {
                    blocks.push({ type: 'h2', lines: [trimmedLine.substring(3)] });
                } else if (trimmedLine.startsWith('### ')) {
                    blocks.push({ type: 'h3', lines: [trimmedLine.substring(4)] });
                } else if (trimmedLine.startsWith('#### ')) {
                    blocks.push({ type: 'h4', lines: [trimmedLine.substring(5)] });
                } else if (trimmedLine.startsWith('**') && trimmedLine.endsWith('**') && !trimmedLine.substring(2, trimmedLine.length-2).includes('**')) {
                    blocks.push({ type: 'h2', lines: [trimmedLine.substring(2, trimmedLine.length - 2)] });
                } else if (trimmedLine === '---') {
                    blocks.push({ type: 'hr', lines: [] });
                } else if (listItemMatch) {
                    const text = listItemMatch[1];
                    if (lastBlock?.type === 'ul') {
                        lastBlock.lines.push(text);
                    } else {
                        blocks.push({ type: 'ul', lines: [text] });
                    }
                } else {
                    if (lastBlock?.type === 'p') {
                        lastBlock.lines.push(trimmedLine);
                    } else {
                        blocks.push({ type: 'p', lines: [trimmedLine] });
                    }
                }
            }
            
            // 3. Render the blocks into HTML strings
            return blocks.map((block) => {
                switch(block.type) {
                    case 'h2':
                        return `<h2 class="text-2xl font-bold mt-6 mb-3 text-slate-800 dark:text-slate-100">${renderInline(block.lines[0])}</h2>`;
                    case 'h3':
                         return `<h3 class="text-lg font-bold mt-4 mb-2 text-slate-700 dark:text-slate-200">${renderInline(block.lines[0])}</h3>`;
                    case 'h4':
                        return `<h4 class="text-md font-bold mt-4 mb-2 text-slate-700 dark:text-slate-300">${renderInline(block.lines[0])}</h4>`;
                    case 'hr':
                        return `<hr class="my-4 border-slate-300 dark:border-slate-600" />`;
                    case 'ul':
                        const listItems = block.lines.map(l => `<li>${renderInline(l)}</li>`).join('');
                        return `<ul class="list-disc list-outside pl-5 my-2 space-y-1">${listItems}</ul>`;
                    case 'p':
                        return `<p class="my-2">${block.lines.map(renderInline).join('<br />')}</p>`;
                    default:
                        return '';
                }
            }).join('');
        }).join('');
    }, [content]);

    return <div className={className} dangerouslySetInnerHTML={{ __html: htmlContent }} />;
});

export default MarkdownRenderer;