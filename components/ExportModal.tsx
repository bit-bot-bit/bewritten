import React, { useState } from 'react';
import { StoryState, ExportFormat } from '../types';
import { Download, Layout, Sparkles, X, FileText, Loader2, Printer, FileType } from 'lucide-react';
import { generateBookLayoutCSS, generateStoryBlurb } from '../services/geminiService';

interface ExportModalProps {
    isOpen: boolean;
    onClose: () => void;
    story: StoryState;
}

export const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose, story }) => {
    const [stylePrompt, setStylePrompt] = useState('Standard Novel: Garamond font, indented paragraphs, clean headers');
    const [css, setCss] = useState('');
    const [blurb, setBlurb] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [isGeneratingBlurb, setIsGeneratingBlurb] = useState(false);
    const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('html');

    if (!isOpen) return null;

    const handleGenerateLayout = async () => {
        setIsGenerating(true);
        try {
            const generatedCss = await generateBookLayoutCSS(stylePrompt);
            setCss(generatedCss);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleGenerateBlurb = async () => {
        setIsGeneratingBlurb(true);
        try {
            const generatedBlurb = await generateStoryBlurb(story);
            setBlurb(generatedBlurb);
        } finally {
            setIsGeneratingBlurb(false);
        }
    };

    const downloadFile = (content: string, extension: string, type: string) => {
        const blob = new Blob([content], { type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${story.title.replace(/\s+/g, '_')}_Export.${extension}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleDownload = () => {
        if (selectedFormat === 'md') {
            let mdContent = `# ${story.title}\n\n`;
            if (blurb) mdContent += `> ${blurb}\n\n---\n\n`;
            story.chapters.forEach(ch => {
                mdContent += `## ${ch.title}\n\n${ch.content}\n\n`;
            });
            downloadFile(mdContent, 'md', 'text/markdown');
            return;
        }

        if (selectedFormat === 'txt') {
            let txtContent = `${story.title.toUpperCase()}\n\n`;
            if (blurb) txtContent += `${blurb}\n\n${'-'.repeat(20)}\n\n`;
            story.chapters.forEach(ch => {
                txtContent += `\n\n${ch.title.toUpperCase()}\n\n${ch.content}\n`;
            });
            downloadFile(txtContent, 'txt', 'text/plain');
            return;
        }

        // HTML / PDF (Print)
        const fullHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>${story.title}</title>
    <style>
        ${css || `
            @page { size: A5; margin: 2cm; }
            body { font-family: 'Georgia', serif; line-height: 1.6; color: #000; max-width: 800px; margin: 0 auto; padding: 2rem; background: #fff; }
            .title-page { text-align: center; margin-top: 30vh; page-break-after: always; }
            .book-title { font-size: 3rem; margin-bottom: 1rem; }
            .author-name { font-size: 1.5rem; color: #555; font-weight: normal; }
            .blurb-page { page-break-after: always; display: flex; align-items: center; justify-content: center; height: 80vh; }
            .blurb { font-style: italic; max-width: 60%; text-align: center; }
            .chapter { page-break-before: always; margin-top: 3rem; }
            .chapter-title { font-size: 2rem; margin-bottom: 2rem; text-align: center; }
            p { margin-bottom: 0; text-indent: 1.5em; }
            p:first-of-type { text-indent: 0; }
        `}
    </style>
</head>
<body>
    <div class="title-page">
        <h1 class="book-title">${story.title}</h1>
        <h2 class="author-name">Written with Mythos AI</h2>
    </div>

    ${blurb ? `
    <div class="blurb-page">
        <div class="blurb">
            <p>${blurb}</p>
        </div>
    </div>
    ` : ''}

    <div class="content">
        ${story.chapters.map(ch => `
            <div class="chapter">
                <h3 class="chapter-title">${ch.title}</h3>
                ${ch.content.split('\n').filter(p => p.trim()).map(p => `<p>${p}</p>`).join('')}
            </div>
        `).join('')}
    </div>
</body>
</html>
        `;
        downloadFile(fullHtml, 'html', 'text/html');
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-surface border border-border rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center p-6 border-b border-border">
                    <h2 className="text-2xl font-bold text-main flex items-center gap-2">
                        <Download size={24} className="text-accent" />
                        Export Story
                    </h2>
                    <button onClick={onClose} className="text-muted hover:text-main">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-6 flex-1 overflow-y-auto space-y-6">
                    {/* Format Selection */}
                    <div className="flex gap-4">
                        {[
                            { id: 'html', label: 'PDF / HTML', icon: Printer, desc: 'Print-ready layout' },
                            { id: 'md', label: 'Markdown', icon: FileType, desc: 'For structure & apps' },
                            { id: 'txt', label: 'Plain Text', icon: FileText, desc: 'Raw content' }
                        ].map((fmt) => (
                            <button
                                key={fmt.id}
                                onClick={() => setSelectedFormat(fmt.id as ExportFormat)}
                                className={`flex-1 p-4 rounded-xl border transition-all text-left ${
                                    selectedFormat === fmt.id
                                    ? 'bg-accent-dim border-accent text-accent'
                                    : 'bg-card border-border hover:border-muted text-muted hover:text-main'
                                }`}
                            >
                                <fmt.icon size={24} className="mb-2" />
                                <div className="font-bold text-sm">{fmt.label}</div>
                                <div className="text-[10px] opacity-70">{fmt.desc}</div>
                            </button>
                        ))}
                    </div>

                    {/* Blurb Section */}
                    <div className="bg-card p-4 rounded-xl border border-border">
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="font-semibold text-main flex items-center gap-2">
                                <Sparkles size={18} /> Back Cover Blurb
                            </h3>
                            <button 
                                onClick={handleGenerateBlurb}
                                disabled={isGeneratingBlurb}
                                className="text-xs bg-accent-dim text-accent hover:bg-accent hover:text-white px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                            >
                                {isGeneratingBlurb ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                                Auto-Generate
                            </button>
                        </div>
                        <textarea 
                            value={blurb}
                            onChange={(e) => setBlurb(e.target.value)}
                            placeholder="Story synopsis will appear here..."
                            className="themed-control w-full border border-border rounded-lg p-3 text-sm text-main h-24 resize-none outline-none focus:border-accent"
                            style={{ color: 'var(--color-text-main)', caretColor: 'var(--color-text-main)' }}
                        />
                    </div>

                    {/* Layout Section - Only for HTML */}
                    {selectedFormat === 'html' && (
                        <div className="bg-card p-4 rounded-xl border border-border">
                            <h3 className="font-semibold text-main mb-3 flex items-center gap-2">
                                <Layout size={18} /> Layout Styling
                            </h3>
                            <div className="flex gap-2 mb-3">
                                <input 
                                    value={stylePrompt}
                                    onChange={(e) => setStylePrompt(e.target.value)}
                                    className="themed-control flex-1 border border-border rounded-lg px-3 py-2 text-sm text-main focus:border-accent outline-none"
                                    style={{ color: 'var(--color-text-main)', caretColor: 'var(--color-text-main)' }}
                                />
                                <button 
                                    onClick={handleGenerateLayout}
                                    disabled={isGenerating}
                                    className="bg-accent text-white px-4 py-2 rounded-lg text-sm font-medium hover:brightness-110 flex items-center gap-2 disabled:opacity-50"
                                >
                                    {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                                    AI Format
                                </button>
                            </div>
                            <p className="text-xs text-muted mb-2">
                                For PDF: Download HTML, open in browser, then 'Print to PDF'.
                            </p>
                            {css && (
                                 <div className="text-xs font-mono p-2 rounded border border-border overflow-hidden h-20 relative themed-control">
                                    <div className="absolute top-1 right-2 text-[10px] text-muted">CSS Generated</div>
                                    {css.substring(0, 200)}...
                                 </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="p-6 border-t border-border bg-card rounded-b-2xl flex justify-end gap-3">
                    <button onClick={onClose} className="px-5 py-2.5 text-sm font-medium text-muted hover:text-main">
                        Cancel
                    </button>
                    <button 
                        onClick={handleDownload}
                        className="bg-accent text-white px-6 py-2.5 rounded-xl font-medium hover:brightness-110 flex items-center gap-2 shadow-lg shadow-accent/20"
                    >
                        <Download size={18} />
                        Export {selectedFormat.toUpperCase()}
                    </button>
                </div>
            </div>
        </div>
    );
};
