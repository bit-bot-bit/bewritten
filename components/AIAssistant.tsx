import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, X, Send, ChevronUp, Minimize2, Maximize2, Loader2, Sparkles } from 'lucide-react';
import { chatWithBible } from '../services/geminiService';
import { StoryState } from '../types';

interface AIAssistantProps {
    storyState: StoryState;
    isMobile?: boolean;
}

type PanelMode = 'normal' | 'maximized' | 'minimized';

const MarkdownRenderer = ({ content }: { content: string }) => {
    // Basic Markdown parser: bold, italic, list, heading
    const parse = (text: string) => {
        const lines = text.split('\n');
        return lines.map((line, i) => {
            // Lists
            if (line.match(/^(\d+\.|-)\s/)) {
                 const content = line.replace(/^(\d+\.|-)\s/, '');
                 return <li key={i} className="ml-4 list-disc pl-1 mb-1">{formatInline(content)}</li>;
            }
            // Headings
            if (line.startsWith('### ')) return <h3 key={i} className="text-lg font-bold mt-2 mb-1">{formatInline(line.slice(4))}</h3>;
            if (line.startsWith('## ')) return <h2 key={i} className="text-xl font-bold mt-3 mb-2 border-b border-border pb-1">{formatInline(line.slice(3))}</h2>;
            if (line.startsWith('# ')) return <h1 key={i} className="text-2xl font-bold mt-4 mb-3">{formatInline(line.slice(2))}</h1>;

            // Empty line
            if (!line.trim()) return <div key={i} className="h-2" />;

            // Paragraph
            return <p key={i} className="mb-2 last:mb-0 leading-relaxed">{formatInline(line)}</p>;
        });
    };

    const formatInline = (text: string) => {
        // Split by bold (**text**)
        const parts = text.split(/(\*\*.*?\*\*)/g);
        return parts.map((part, index) => {
            if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={index} className="text-accent font-semibold">{part.slice(2, -2)}</strong>;
            }
            // Check for italic (*text*)
            const subParts = part.split(/(\*.*?\*)/g);
            return subParts.map((sub, subIndex) => {
                 if (sub.startsWith('*') && sub.endsWith('*')) {
                     return <em key={`${index}-${subIndex}`} className="italic text-main/90">{sub.slice(1, -1)}</em>;
                 }
                 return sub;
            });
        });
    };

    return <div className="text-sm text-main">{parse(content)}</div>;
};

export const AIAssistant: React.FC<AIAssistantProps> = ({ storyState, isMobile = false }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<{role: 'user' | 'ai', text: string}[]>([]);
    const [input, setInput] = useState('');
    const [isThinking, setIsThinking] = useState(false);
    const [panelMode, setPanelMode] = useState<PanelMode>('normal');
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isThinking, isOpen]);

    useEffect(() => {
        if (isOpen && inputRef.current && !isMobile) {
            inputRef.current.focus();
        }
    }, [isOpen, isMobile]);

    const handleSend = async () => {
        if (!input.trim()) return;
        const userMsg = input;
        setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
        setInput('');
        setIsThinking(true);

        try {
            const response = await chatWithBible(userMsg, storyState);
            setMessages(prev => [...prev, { role: 'ai', text: response }]);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'AI request failed';
            setMessages(prev => [...prev, { role: 'ai', text: `Error: ${message}` }]);
        } finally {
            setIsThinking(false);
        }
    };

    const toggleOpen = () => {
        if (isOpen) {
            setIsOpen(false);
        } else {
            setIsOpen(true);
            if (isMobile) setPanelMode('maximized');
        }
    };

    const isMaximized = panelMode === 'maximized';
    const isMinimized = panelMode === 'minimized';

    // Mobile floating button (always visible when closed)
    if (!isOpen) {
        return (
            <button 
                onClick={toggleOpen}
                className={`fixed z-50 flex items-center gap-2 shadow-2xl transition-all hover:scale-105 active:scale-95 ${
                    isMobile
                        ? 'top-2 left-1/2 -translate-x-1/2 bg-surface/90 backdrop-blur-md border border-accent/30 text-accent px-4 py-2 rounded-full text-xs font-bold'
                        : 'bottom-6 right-6 bg-accent text-white p-4 rounded-full hover:bg-accent/90'
                }`}
            >
                {isMobile ? <Sparkles size={16} /> : <MessageSquare size={24} />}
                <span className="font-medium">{isMobile ? 'Co-Author' : 'Co-Author'}</span>
            </button>
        );
    }

    // Minimized state (desktop/mobile)
    if (isMinimized) {
        return (
            <div
                className={`fixed z-50 bg-surface/95 backdrop-blur-md border border-border shadow-2xl flex items-center justify-between px-4 py-3 rounded-xl transition-all ${
                    isMobile
                        ? 'top-16 left-4 right-4'
                        : 'bottom-6 right-6 w-72'
                }`}
            >
                <div className="font-semibold text-main flex items-center gap-2 text-sm">
                    <Sparkles size={16} className="text-accent" />
                    <span className="truncate">Thinking...</span>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setPanelMode(isMobile ? 'maximized' : 'normal')}
                        className="p-1.5 hover:bg-white/10 rounded-lg text-muted hover:text-main transition-colors"
                    >
                        <Maximize2 size={16} />
                    </button>
                    <button
                        onClick={() => setIsOpen(false)}
                        className="p-1.5 hover:bg-white/10 rounded-lg text-muted hover:text-main transition-colors"
                    >
                        <X size={16} />
                    </button>
                </div>
            </div>
        );
    }

    // Main Chat Window
    return (
        <div 
            className={`fixed z-50 bg-surface/95 backdrop-blur-xl border border-border shadow-2xl flex flex-col overflow-hidden transition-all duration-300 ease-in-out ${
                isMaximized
                    ? isMobile
                        ? 'inset-0 z-[60]'
                        : 'inset-4 md:inset-10 lg:inset-20 rounded-2xl'
                    : isMobile
                        ? 'inset-x-0 bottom-0 top-14 rounded-t-2xl border-b-0' // Sheet-like on mobile
                        : 'bottom-6 right-6 w-[400px] h-[600px] rounded-2xl'
            }`}
        >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border bg-surface/50">
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-accent/10 rounded-lg text-accent">
                        <Sparkles size={20} />
                    </div>
                    <div>
                        <h3 className="font-bold text-main text-sm">Mythos Co-Author</h3>
                        <p className="text-[10px] text-muted uppercase tracking-wider">Context Aware AI</p>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setPanelMode('minimized')}
                        className="p-2 hover:bg-white/5 rounded-lg text-muted hover:text-main transition-colors"
                        title="Minimize"
                    >
                        <Minimize2 size={18} />
                    </button>
                    <button
                        onClick={() => setPanelMode(isMaximized ? 'normal' : 'maximized')}
                        className="p-2 hover:bg-white/5 rounded-lg text-muted hover:text-main transition-colors"
                        title={isMaximized ? 'Restore' : 'Maximize'}
                    >
                        {isMaximized ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                    </button>
                    <button
                        onClick={() => setIsOpen(false)}
                        className="p-2 hover:bg-red-500/10 rounded-lg text-muted hover:text-red-400 transition-colors"
                        title="Close"
                    >
                        <X size={18} />
                    </button>
                </div>
            </div>

            {/* Messages Area */}
            <div
                className="flex-1 overflow-y-auto p-4 space-y-6 scroll-smooth"
                ref={scrollRef}
            >
                {messages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-center p-8 text-muted/60 space-y-4">
                        <MessageSquare size={48} className="opacity-20" />
                        <p className="text-sm max-w-[240px]">
                            Ask me to review your latest chapter, suggest plot twists, or simulate a character conversation.
                        </p>
                    </div>
                )}

                {messages.map((msg, i) => (
                    <div
                        key={i}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                        <div
                            className={`max-w-[85%] rounded-2xl p-4 text-sm shadow-sm ${
                                msg.role === 'user'
                                ? 'bg-accent text-white rounded-br-none'
                                : 'bg-card border border-border text-main rounded-bl-none'
                            }`}
                        >
                            {msg.role === 'ai' ? (
                                <MarkdownRenderer content={msg.text} />
                            ) : (
                                <span className="whitespace-pre-wrap leading-relaxed">{msg.text}</span>
                            )}
                        </div>
                    </div>
                ))}

                {isThinking && (
                    <div className="flex justify-start">
                        <div className="bg-card border border-border rounded-2xl rounded-bl-none p-4 flex items-center gap-3">
                            <Loader2 size={18} className="text-accent animate-spin" />
                            <span className="text-sm text-muted animate-pulse">Thinking...</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Input Area */}
            <div className="p-4 bg-surface border-t border-border">
                <div className="relative flex items-center gap-2">
                    <input 
                        ref={inputRef}
                        className="flex-1 bg-surface border border-border transition-colors text-main placeholder-muted rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-accent/50 outline-none focus:border-accent"
                        placeholder="Ask your co-author..."
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                        disabled={isThinking}
                    />
                    <button 
                        onClick={handleSend}
                        disabled={isThinking || !input.trim()}
                        className="p-3 bg-accent text-white rounded-xl hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-accent/20 transition-all active:scale-95"
                    >
                        <Send size={18} />
                    </button>
                </div>
                <div className="text-[10px] text-center text-muted mt-2 opacity-60">
                    AI can make mistakes. Verify important details.
                </div>
            </div>
        </div>
    );
};
