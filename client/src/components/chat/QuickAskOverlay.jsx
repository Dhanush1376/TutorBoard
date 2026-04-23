import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, Send, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAiRouter } from '../../hooks/useAiRouter';

/**
 * QuickAskOverlay: A production-ready UI for the Plug-and-Play AI Router
 */
export default function QuickAskOverlay({ isOpen, onClose }) {
  const [query, setQuery] = useState("");
  const { askAi, isLoading, error, result } = useAiRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    await askAi(query);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{ 
              position: 'fixed', inset: 0, 
              background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', 
              zIndex: 1000 
            }}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            style={{
              position: 'fixed', top: '20%', left: '50%', x: '-50%',
              width: '100%', maxWidth: '500px',
              background: 'var(--bg-primary)', border: '1px solid var(--border-color)',
              borderRadius: '24px', boxShadow: '0 20px 50px rgba(0,0,0,0.2)',
              zIndex: 1001, padding: '24px', overflow: 'hidden'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: 'rgba(139, 92, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8b5cf6' }}>
                  <Sparkles size={18} />
                </div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 500 }}>AI Quick Assistant</h3>
              </div>
              <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ marginBottom: '20px' }}>
              <div style={{ position: 'relative' }}>
                <textarea
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Ask anything... (e.g., Explain binary search)"
                  style={{
                    width: '100%', height: '100px', background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)', borderRadius: '16px',
                    padding: '16px', fontSize: '14px', color: 'var(--text-primary)',
                    resize: 'none', outline: 'none'
                  }}
                />
                <button
                  type="submit"
                  disabled={isLoading || !query.trim()}
                  style={{
                    position: 'absolute', bottom: '12px', right: '12px',
                    width: '36px', height: '36px', borderRadius: '10px',
                    background: '#8b5cf6', color: 'white', border: 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', opacity: (isLoading || !query.trim()) ? 0.5 : 1
                  }}
                >
                  {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                </button>
              </div>
            </form>

            <AnimatePresence mode="wait">
              {error && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  style={{ padding: '12px', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', fontSize: '13px', display: 'flex', gap: '8px' }}>
                  <AlertCircle size={16} /> {error}
                </motion.div>
              )}

              {result && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  
                  <div style={{ padding: '12px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', fontSize: '12px', display: 'flex', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <CheckCircle2 size={14} /> Response generated via <b>{result._meta?.provider}</b>
                    </div>
                  </div>

                  <div style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: 'var(--text-secondary)' }}>Explanation</h4>
                    <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.6 }}>{result.explanation}</p>
                  </div>

                  <div>
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: 'var(--text-secondary)' }}>Key Steps</h4>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {result.steps.map((step, i) => (
                        <div key={i} style={{ padding: '6px 12px', background: 'var(--bg-tertiary)', borderRadius: '20px', fontSize: '12px', border: '1px solid var(--border-color)' }}>
                          {step}
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
