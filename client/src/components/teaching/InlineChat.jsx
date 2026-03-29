import React, { useState, useRef, useEffect } from 'react';
import { ArrowUp, Loader2, MessageCircleQuestion } from 'lucide-react';

const InlineChat = ({ currentStep, stepDescription, stepData }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = async () => {
    if (!input.trim() || isLoading) return;

    const userQuestion = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userQuestion }]);
    setIsLoading(true);

    try {
      const response = await fetch('http://localhost:3001/api/doubt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: userQuestion,
          stepDescription: stepDescription || '',
          stepData: stepData || {},
          stepIndex: currentStep
        }),
      });

      if (!response.ok) throw new Error('Failed to get answer');
      const data = await response.json();
      
      setMessages(prev => [...prev, { role: 'assistant', content: data.answer }]);
    } catch (err) {
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Sorry, I couldn\'t process that. Please try again.' 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      
      {/* Toggle Button (when collapsed) */}
      {!isExpanded && messages.length === 0 && (
        <button
          onClick={() => setIsExpanded(true)}
          className="flex items-center gap-2 mx-auto px-4 py-2 bg-[var(--bg-secondary)]/80 backdrop-blur-xl border border-[var(--border-color)] rounded-full text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-all"
        >
          <MessageCircleQuestion size={14} />
          Ask a doubt about this step
        </button>
      )}

      {/* Expanded Chat */}
      {(isExpanded || messages.length > 0) && (
        <div className="bg-[var(--bg-secondary)]/90 backdrop-blur-2xl border border-[var(--border-color)] rounded-2xl overflow-hidden shadow-2xl">
          
          {/* Messages Thread */}
          {messages.length > 0 && (
            <div 
              ref={scrollRef}
              className="max-h-40 overflow-y-auto p-3 space-y-2 no-scrollbar"
            >
              {messages.map((msg, i) => (
                <div 
                  key={i} 
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[85%] px-3 py-2 rounded-xl text-xs leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-[var(--text-primary)] text-[var(--bg-primary)] rounded-tr-none'
                      : 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded-tl-none'
                  }`}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="px-3 py-2 rounded-xl bg-[var(--bg-tertiary)] rounded-tl-none">
                    <Loader2 size={14} className="animate-spin text-[var(--text-tertiary)]" />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Input */}
          <div className="flex items-center gap-2 p-2 border-t border-[var(--border-color)]">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a doubt about this step..."
              className="flex-1 bg-transparent text-[var(--text-primary)] placeholder-[var(--text-tertiary)] text-xs outline-none px-3 py-2"
            />
            <button
              onClick={handleSubmit}
              disabled={!input.trim() || isLoading}
              className="p-1.5 bg-[var(--text-primary)] text-[var(--bg-primary)] rounded-lg disabled:opacity-20 hover:opacity-90 transition-all"
            >
              <ArrowUp size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default InlineChat;
