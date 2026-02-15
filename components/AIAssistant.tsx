import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, X, Send, ChevronUp } from 'lucide-react';
import { chatWithBible } from '../services/geminiService';
import { StoryState } from '../types';

interface AIAssistantProps {
    storyState: StoryState;
}

export const AIAssistant: React.FC<AIAssistantProps> = ({ storyState }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<{role: 'user' | 'ai', text: string}[]>([]);
    const [input, setInput] = useState('');
    const [isThinking, setIsThinking] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

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

    if (!isOpen) {
        return (
            <button 
                onClick={() => setIsOpen(true)}
                className="fixed bottom-6 right-6 bg-accent hover:brightness-110 text-white p-4 rounded-full shadow-2xl transition-all z-50 flex items-center gap-2"
            >
                <MessageSquare size={24} />
                <span className="font-medium pr-1">Co-Author</span>
            </button>
        );
    }

    return (
        <div 
            className="fixed bottom-6 right-6 w-96 h-[500px] bg-surface border border-border rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden"
            style={{ backgroundColor: 'var(--color-surface)' }}
        >
            {/* Header */}
            <div className="bg-surface p-4 flex justify-between items-center border-b border-border">
                <h3 className="font-bold text-main flex items-center gap-2">
                    <MessageSquare size={18} className="text-accent" />
                    Mythos Co-Author
                </h3>
                <button onClick={() => setIsOpen(false)} className="text-muted hover:text-main">
                    <ChevronUp size={20} className="rotate-180" />
                </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-surface" ref={scrollRef}>
                {messages.length === 0 && (
                    <div className="text-muted text-center text-sm mt-10">
                        Ask about your characters, plot holes, or request ideas for the next scene.
                    </div>
                )}
                {messages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] p-3 rounded-2xl text-sm leading-relaxed ${
                            msg.role === 'user' 
                            ? 'bg-accent text-white rounded-br-none' 
                            : 'bg-card text-main rounded-bl-none border border-border'
                        }`}>
                            {msg.text}
                        </div>
                    </div>
                ))}
                {isThinking && (
                    <div className="flex justify-start">
                        <div className="bg-card p-3 rounded-2xl rounded-bl-none border border-border">
                            <div className="flex gap-1">
                                <span className="w-2 h-2 bg-muted rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                <span className="w-2 h-2 bg-muted rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                <span className="w-2 h-2 bg-muted rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Input */}
            <div className="p-4 bg-surface border-t border-border">
                <div className="relative">
                    <input 
                        className="themed-control w-full rounded-xl pl-4 pr-12 py-3 text-sm focus:ring-1 focus:ring-accent outline-none border"
                        placeholder="Ask anything..."
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        style={{ color: 'var(--color-text-main)', caretColor: 'var(--color-text-main)' }}
                    />
                    <button 
                        onClick={handleSend}
                        disabled={isThinking || !input.trim()}
                        className="absolute right-2 top-2 p-1.5 bg-accent text-white rounded-lg hover:brightness-110 disabled:opacity-50 disabled:bg-card"
                    >
                        <Send size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
};
