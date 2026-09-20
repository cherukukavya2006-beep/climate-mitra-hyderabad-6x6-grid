import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2 } from 'lucide-react';

interface Message {
  role: 'user' | 'bot';
  content: string;
}

export default function AIAssistant() {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'bot', content: 'Hello! I am Climate Mitra. Ask me anything about weather, farming, or climate change in English or Telugu.' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg = input.trim();
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/ai/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: userMsg })
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: 'bot', content: data.answer }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'bot', content: 'Network error. Please try again later.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto animate-in fade-in duration-500 h-[calc(100vh-12rem)] flex flex-col">
      <div className="text-center space-y-2 mb-6 shrink-0">
        <h2 className="text-3xl font-bold text-brand-dark flex items-center justify-center gap-3">
          <Bot className="text-brand-primary" size={32} />
          Ask Climate Mitra
        </h2>
        <p className="text-brand-dark/60">Your AI co-pilot for agricultural intelligence.</p>
      </div>

      <div className="flex-grow glass-card rounded-3xl overflow-hidden flex flex-col border border-brand-border shadow-md">
        <div className="flex-grow overflow-y-auto p-4 sm:p-6 space-y-6 bg-brand-surface/40">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`flex items-start max-w-[85%] sm:max-w-[75%] gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center ${msg.role === 'user' ? 'bg-brand-secondary/20 text-brand-secondary' : 'bg-brand-primary/20 text-brand-primary'}`}>
                  {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                </div>
                <div className={`p-4 rounded-2xl ${
                  msg.role === 'user' 
                    ? 'bg-brand-secondary text-white rounded-tr-none' 
                    : 'bg-white border border-brand-border shadow-sm text-brand-dark rounded-tl-none'
                }`}>
                  <p className="whitespace-pre-wrap text-sm sm:text-base leading-relaxed">{msg.content}</p>
                </div>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="flex items-start max-w-[85%] gap-3">
                <div className="w-8 h-8 shrink-0 rounded-full bg-brand-primary/20 text-brand-primary flex items-center justify-center">
                  <Bot size={16} />
                </div>
                <div className="p-4 rounded-2xl bg-white border border-brand-border shadow-sm text-brand-dark rounded-tl-none flex items-center gap-2">
                  <Loader2 className="animate-spin text-brand-primary" size={16} />
                  <span className="text-sm text-brand-dark/50">Mitra is thinking...</span>
                </div>
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        <div className="p-4 bg-white border-t border-brand-border">
          <form onSubmit={handleSubmit} className="relative flex items-center">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Type your question here (e.g., 'Will it rain tomorrow?')"
              className="w-full bg-brand-light border border-brand-border rounded-full py-4 pl-6 pr-14 text-brand-dark focus:outline-none focus:ring-2 focus:ring-brand-primary/50 smooth-transition"
            />
            <button 
              type="submit"
              disabled={loading || !input.trim()}
              className="absolute right-2 p-3 bg-brand-primary text-white rounded-full hover:bg-brand-primary/90 disabled:opacity-50 disabled:hover:bg-brand-primary smooth-transition"
            >
              <Send size={18} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
