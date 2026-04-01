import React, { useState, useRef, useEffect } from 'react';
import { ArrowUp, Loader2, MessageCircleQuestion } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || "https://tutorboard.onrender.com";

const InlineChat = ({ currentStep, stepDescription, stepData, onVisualUpdate }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const scrollRef = useRef(null);

  // Fetch history on mount
  useEffect(() => {
    const fetchHistory = async () => {
      const token = localStorage.getItem('tb-token');
      if (!token || token === 'guest') return;

      try {
        const res = await fetch(`${API_URL}/api/doubts/history`, {
          headers: { 
            'Authorization': `Bearer ${token}` 
          }
        });

        if (res.ok) {
          const data = await res.json();
          const historyMessages = data.history.flatMap(d => ([
            { role: 'user', content: d.question },
            { role: 'assistant', content: d.answer }
          ]));
          setMessages(historyMessages);
        }
      } catch (err) {
        console.error('Failed to fetch chat history:', err);
      }
    };

    fetchHistory();
  }, []);

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
      const token = localStorage.getItem('tb-token');
      const headers = { 'Content-Type': 'application/json' };
      if (token && token !== 'guest') {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${API_URL}/doubt`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          question: userQuestion,
          history: messages, // Send multi-turn history
          stepDescription: stepDescription || '',
          stepData: stepData || {},
          stepIndex: currentStep
        }),
      });

      if (!response.ok) throw new Error('Failed to get answer');
      const data = await response.json();
      
      setMessages(prev => [...prev, { role: 'assistant', content: data.answer }]);

      // Trigger visual update if the AI provided one
      if (data.hasVisuals && data.visualUpdate && onVisualUpdate) {
        onVisualUpdate(data.visualUpdate);
      }
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
    // Prevent spacebar or other keys from bubbling up to the TeachingModal shortcuts
    e.stopPropagation();
    
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
