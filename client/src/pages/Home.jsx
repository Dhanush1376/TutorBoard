import React, { useState, useEffect, useRef, useCallback } from 'react';
import Layout from '../components/layout/Layout';
import Sidebar from '../components/sidebar/Sidebar';
import Board from '../components/Board';
import ChatWindow from '../components/chat/ChatWindow';
import InputBar from '../components/chat/InputBar';
import TeachingModal from '../components/teaching/TeachingModal';
import ModulesPage from '../components/modules/ModulesPage';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, Trophy, GitCompare, PencilLine, Lightbulb } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || "https://tutorboard.onrender.com";

const Home = ({ setIsDark, isDark }) => {
  // Global Sessions
  const [chatHistory, setChatHistory] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  
  // App Routing
  const [activeView, setActiveView] = useState('chat'); // 'chat' | 'modules'
  const [customModules, setCustomModules] = useState([]);
  
  // Local input state
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // Playback State
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  // Teaching Modal State
  const [isTeachingOpen, setIsTeachingOpen] = useState(false);
  const [teachingData, setTeachingData] = useState(null);
  const [error, setError] = useState(null);

  // Duplicate submission guard
  const isSubmittingRef = useRef(false);
  const msgIdCounter = useRef(0);
  const getMsgId = (suffix = '') => `msg-${Date.now()}-${++msgIdCounter.current}${suffix ? `-${suffix}` : ''}`;

  const activeSession = chatHistory.find(c => c.id === activeChatId) || null;
  const messages = activeSession?.messages || [];
  const hasStarted = messages.length > 0;

  // Determine global board data
  const lastMessageWithSteps = [...messages].reverse().find(m => m.steps && m.steps.length > 0);
  const activeSteps = lastMessageWithSteps?.steps || [];

  // Reset playback when switching
  useEffect(() => {
    setCurrentStep(0);
    setIsPlaying(false);
  }, [activeChatId, activeSteps.length]);

  // Playback loop
  useEffect(() => {
    let interval;
    if (isPlaying && activeSteps.length > 0) {
      const displayDuration = 2500 / speed;
      interval = setInterval(() => {
        setCurrentStep((prev) => {
          if (prev >= activeSteps.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, displayDuration);
    }
    return () => clearInterval(interval);
  }, [isPlaying, speed, activeSteps.length]);

  const handleNewChat = () => {
    setActiveChatId(null);
    setPrompt('');
  };

  const handleSelectChat = (id) => {
    setActiveChatId(id);
  };

  const handleDeleteChat = (id) => {
    setChatHistory(prev => prev.filter(c => c.id !== id));
    if (activeChatId === id) setActiveChatId(null);
  };

  const handleRenameChat = (id, newTitle) => {
    setChatHistory(prev => prev.map(c => c.id === id ? { ...c, title: newTitle } : c));
  };

  const handleLoadModule = (moduleData) => {
    const sessionId = `session-${Date.now()}`;
    const newSession = {
      id: sessionId,
      title: moduleData.title,
      messages: [
        { id: getMsgId('user'), role: 'user', content: `Explain ${moduleData.title}` },
        { id: getMsgId('ai'), role: 'assistant', content: moduleData.description, steps: moduleData.data.steps }
      ]
    };
    setChatHistory(prev => [newSession, ...prev]);
    setActiveChatId(sessionId);
  };

  // Open Canvas for a specific message's steps
  const handleOpenCanvas = useCallback((steps, title) => {
    if (steps && steps.length > 0) {
      setTeachingData({ title: title || 'Teaching Session', steps });
      setIsTeachingOpen(true);
    }
  }, []);

  const handleSubmit = async () => {
    if (!prompt.trim() || isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    
    const userPrompt = prompt;
    setPrompt('');
    setIsGenerating(true);
    setError(null);
    setActiveView('chat');

    const workingSessionId = activeChatId || `session-${Date.now()}`;
    if (!activeChatId) setActiveChatId(workingSessionId);

    // Atomic update: Create session AND add message in one go
    setChatHistory(prev => {
      const idx = prev.findIndex(s => s.id === workingSessionId);
      const userMessage = { id: getMsgId('user'), role: 'user', content: userPrompt };

      if (idx === -1) {
        // Create new session starting with the user's message
        return [{ 
          id: workingSessionId, 
          title: userPrompt.substring(0, 40) + (userPrompt.length > 40 ? '...' : ''), 
          messages: [userMessage] 
        }, ...prev];
      } else {
        // Update existing session
        const next = [...prev];
        next[idx] = {
          ...next[idx],
          messages: [...next[idx].messages, userMessage]
        };
        return next;
      }
    });

    try {
      const response = await fetch(`${API_URL}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: userPrompt }),
      });
      if (!response.ok) throw new Error('AI Agent is currently unavailable. Please check your API key or server status.');
      const data = await response.json();
      
      setChatHistory(prev => {
        const next = [...prev];
        const idx = next.findIndex(s => s.id === workingSessionId);
        if (idx !== -1) {
          // Prevent duplicate AI responses for the same generation
          const hasSteps = data.steps && data.steps.length > 0;
          next[idx] = {
            ...next[idx],
            messages: [
              ...next[idx].messages,
              {
                id: getMsgId('ai'),
                role: 'assistant',
                content: hasSteps 
                  ? `I've prepared a visualization for **${data.title}**. You can view it on the canvas behind this message or click the button below to expand it.` 
                  : "I've processed your request, but I couldn't generate a visual step-by-step for this concept yet.",
                steps: data.steps,
                stepTitle: data.title
              }
            ]
          };
        }
        return next;
      });

      // Auto-open the Teaching Modal with the received data
      if (data.steps && data.steps.length > 0) {
        setTeachingData({ title: data.title, steps: data.steps });
        setIsTeachingOpen(true);
      }
    } catch (err) {
      console.error(err);
      setError(err.message);
      setChatHistory(prev => {
        const next = [...prev];
        const idx = next.findIndex(s => s.id === workingSessionId);
        if (idx !== -1) {
          next[idx] = {
            ...next[idx],
            messages: [
              ...next[idx].messages,
              {
                id: getMsgId('err'),
                role: 'assistant',
                content: `Error: ${err.message}`
              }
            ]
          };
        }
        return next;
      });
    } finally {
      setIsGenerating(false);
      // Small timeout to prevent immediate double-clicks after "generating" ends
      setTimeout(() => { isSubmittingRef.current = false; }, 500);
    }
  };

  return (
    <Layout 
      sidebar={
        <Sidebar 
          chatHistory={chatHistory}
          activeChatId={activeChatId}
          onSelectChat={handleSelectChat}
          onNewChat={handleNewChat}
          onLoadModule={handleLoadModule}
          onDeleteChat={handleDeleteChat}
          onRenameChat={handleRenameChat}
          isDark={isDark}
          setIsDark={setIsDark}
          activeView={activeView}
          setActiveView={setActiveView}
        />
      }
    >
      <div className="w-full h-full relative flex flex-col items-center overflow-hidden m-0 p-0">
        
        {/* Modules View Overlay */}
        <AnimatePresence>
          {activeView === 'modules' && (
            <motion.div 
              initial={{ opacity: 0, y: 30, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.98 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="absolute inset-0 z-40 bg-[var(--bg-primary)] h-full w-full overflow-hidden"
            >
              <ModulesPage 
                customModules={customModules}
                setCustomModules={setCustomModules}
                onLoadModule={(mod) => {
                  handleLoadModule(mod);
                  setActiveView('chat');
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Grid is already provided by Layout.jsx at z-0 */}

        {/* State 1: Claude-style Landing View */}
        {!hasStarted && activeView === 'chat' && (
           <motion.div 
             initial={{ opacity: 0, scale: 0.98, filter: 'blur(8px)' }}
             animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
             transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
             className="w-full h-full flex flex-col items-center justify-center relative z-20 px-6"
           >
              <div className="flex flex-col items-start justify-center mb-12 relative w-full max-w-3xl">
                <motion.span 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                  className="text-sm md:text-base font-sans text-[var(--text-tertiary)] uppercase tracking-[0.2em] mb-2"
                >
                  Welcome to, 
                </motion.span>
                
                {/* Typing Animation for TutorBoard */}
                <motion.h1 
                  initial={{ opacity: 0, y: 10, filter: 'blur(8px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  transition={{ duration: 0.8, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  className="text-4xl md:text-6xl font-serif text-[var(--text-primary)] tracking-tight opacity-95"
                >
                  TutorBoard
                </motion.h1>
              </div>

              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.8, ease: "easeOut" }}
                className="w-full max-w-3xl"
              >
                 <InputBar 
                    value={prompt} 
                    onChange={setPrompt} 
                    onSubmit={handleSubmit} 
                    isGenerating={isGenerating} 
                    isLanding 
                 />
              </motion.div>

              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.1, duration: 0.6 }}
                className="flex flex-wrap justify-center gap-2 md:gap-3 mt-8 md:mt-10 max-w-2xl px-4"
              >
                 {[
                   { label: 'Explain step-by-step', prefix: 'Explain step-by-step: ', icon: BookOpen }, 
                   { label: 'Quiz me', prefix: 'Generate a quiz on: ', icon: Trophy }, 
                   { label: 'Compare concepts', prefix: 'Compare and visualize: ', icon: GitCompare }, 
                   { label: 'Practice problems', prefix: 'Give practice problems for: ', icon: PencilLine }, 
                   { label: 'Think deeply', prefix: '[Think deeply] ', icon: Lightbulb }
                 ].map((action, i) => {
                   const Icon = action.icon;
                   return (
                     <motion.button 
                       key={action.label}
                       initial={{ opacity: 0, scale: 0.9 }}
                       animate={{ opacity: 1, scale: 1 }}
                       transition={{ duration: 0.4, delay: 1.2 + (i * 0.08), ease: "easeOut" }}
                       onClick={() => { 
                         setPrompt(action.prefix); 
                         setTimeout(() => { const el = document.querySelector('textarea'); if(el) { el.focus(); } }, 50); 
                       }}
                       className="flex items-center gap-1.5 px-3 py-2 md:px-4 md:py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-full text-[12px] md:text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--text-tertiary)] hover:bg-[var(--bg-tertiary)] transition-all font-medium whitespace-nowrap active:scale-95 shadow-sm"
                     >
                       <Icon size={14} className="opacity-70" />
                       <span>{action.label}</span>
                     </motion.button>
                   );
                 })}
              </motion.div>
           </motion.div>
        )}

        {/* State 2: Active Chat View */}
        {hasStarted && activeView === 'chat' && (
          <div className="absolute inset-0 z-30 flex flex-col">
            
            {/* Spacer for top navbar */}
            <div className="h-[80px] flex-shrink-0" />

            {/* Scrollable Chat Messages */}
            <div className="flex-1 overflow-y-auto no-scrollbar px-4">
               <div className="w-full max-w-2xl mx-auto">
                  <ChatWindow 
                    messages={messages} 
                    isGenerating={isGenerating} 
                    onOpenCanvas={handleOpenCanvas}
                  />
               </div>
            </div>

            {/* Fixed Input Bar at Bottom */}
            <div className="flex-shrink-0 w-full pb-6 pt-3 px-4 bg-gradient-to-t from-[var(--bg-primary)] via-[var(--bg-primary)] to-transparent">
               <div className="w-full max-w-3xl mx-auto">
                  <InputBar 
                    value={prompt} 
                    onChange={setPrompt} 
                    onSubmit={handleSubmit} 
                    isGenerating={isGenerating} 
                  />
               </div>
            </div>

          </div>
        )}

      </div>

      {/* Teaching Modal Overlay — renders above everything */}
      <TeachingModal
        isOpen={isTeachingOpen}
        onClose={() => { setIsTeachingOpen(false); setTeachingData(null); }}
        title={teachingData?.title}
        steps={teachingData?.steps || []}
      />

    </Layout>
  );
};

export default Home;
