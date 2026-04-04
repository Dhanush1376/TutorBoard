import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Layout from '../components/layout/Layout';
import Sidebar from '../components/sidebar/Sidebar';
import Board from '../components/Board';
import ChatWindow from '../components/chat/ChatWindow';
import InputBar from '../components/chat/InputBar';
import TeachingModal from '../components/teaching/TeachingModal';
import TeachingSession from '../components/teaching/TeachingSession';
import ModulesPage from '../components/modules/ModulesPage';
import ErrorBoundary from '../components/common/ErrorBoundary';
import { motion, AnimatePresence } from 'framer-motion';
import useTutorStore, { STATES } from '../store/tutorStore';

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

const Home = ({ setIsDark, isDark }) => {
  // Global Sessions with persistence
  const [chatHistory, setChatHistory] = useState(() => {
    const saved = localStorage.getItem('tutorboard-history');
    return saved ? JSON.parse(saved) : [];
  });
  const [activeChatId, setActiveChatId] = useState(null);

  useEffect(() => {
    localStorage.setItem('tutorboard-history', JSON.stringify(chatHistory));
  }, [chatHistory]);
  
  // App Routing
  const [activeView, setActiveView] = useState('chat'); // 'chat' | 'modules'
  const [customModules, setCustomModules] = useState([]);
  
  // Local input state
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeMode, setActiveMode] = useState('chat'); // 'chat' | 'teach' | 'solve' | etc.

  // Playback State
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  // Teaching Modal State (legacy visual viewer)
  const [isTeachingOpen, setIsTeachingOpen] = useState(false);
  const [teachingData, setTeachingData] = useState(null);
  const [error, setError] = useState(null);

  // NEW: Live Teaching Session State
  const [isTeachingSessionOpen, setIsTeachingSessionOpen] = useState(false);
  const [teachingTopic, setTeachingTopic] = useState('');

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
    setActiveView('chat');
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

  // Open Canvas for a specific message's steps/objects
  const handleOpenCanvas = useCallback((steps, title, domain, visualizationType, extraData, messageId) => {
    const hasVisualData = (steps && steps.length > 0) || (extraData?.objects && extraData.objects.length > 0);
    if (hasVisualData) {
      // 1. Prepare the timeline data
      const timelineData = {
        title: title || 'Teaching Session',
        steps: steps || [],
        domain: domain,
        visualizationType: visualizationType,
        objects: extraData?.objects || [],
        elements: extraData?.elements || [],
        motion: extraData?.motion || [],
        connections: extraData?.connections || [],
        sequence: extraData?.sequence || [],
        totalSteps: steps?.length || 0
      };

      // 2. Clear current session
      const store = useTutorStore.getState();
      store.resetTeaching();
      
      // 3. Find historical context to seed the doubt thread
      let userPrompt = title || 'Initial Question';
      let aiAnswer = null;

      const chat = chatHistory.find(c => c.id === activeChatId);
      if (chat && messageId) {
        const msgIndex = chat.messages.findIndex(m => m.id === messageId);
        if (msgIndex !== -1) {
          userPrompt = chat.messages[msgIndex - 1]?.content || userPrompt;
          aiAnswer = chat.messages[msgIndex]?.content;
        }
      }

      // 4. Initialize session with context
      store.startSession(title, userPrompt);
      if (aiAnswer) {
        // Update the first doubt with the AI's actual answer from the chat
        const history = store.doubtHistory;
        if (history.length > 0) {
          history[0].answer = aiAnswer;
          history[0].hasVisuals = true;
          store.setDoubtResponse({ answer: aiAnswer, hasVisuals: true, _question: userPrompt });
        }
      }

      store.setTimeline(timelineData);
      store.setMachineState(STATES.TEACHING); // Bypass LOADING state
      
      // 5. Open the immersive UI
      setIsTeachingSessionOpen(true);
      setTeachingTopic(title || 'Manual Session');
    }
  }, [activeChatId, chatHistory]);

  const handleDeleteMessage = useCallback((messageId) => {
    setChatHistory(prev => {
      const idx = prev.findIndex(s => s.id === activeChatId);
      if (idx === -1) return prev;
      const next = [...prev];
      next[idx] = {
        ...next[idx],
        messages: next[idx].messages.filter(m => m.id !== messageId)
      };
      return next;
    });
  }, [activeChatId]);

  const handleEditMessage = useCallback((messageId, content) => {
    setPrompt(content);
    handleDeleteMessage(messageId);
    setTimeout(() => {
      const el = document.querySelector('textarea');
      if (el) el.focus();
    }, 50);
  }, [handleDeleteMessage]);

  const handleSubmit = async () => {
    // ─── Universal Submission Guard ───
    if (!prompt.trim() || isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    
    const userPrompt = prompt.trim();
    const currentMode = activeMode;
    const modeLabel = currentMode.charAt(0).toUpperCase() + currentMode.slice(1);
    
    setPrompt('');
    setIsGenerating(true);
    setError(null);
    setActiveView('chat');

    const workingSessionId = activeChatId || `session-${Date.now()}`;
    if (!activeChatId) setActiveChatId(workingSessionId);

    // ─── 1. RECORD IN HISTORY (Agnostic of Mode) ───
    setChatHistory(prev => {
      const idx = prev.findIndex(s => s.id === workingSessionId);
      const userMessage = { 
        id: getMsgId('user'), 
        role: 'user', 
        content: currentMode === 'chat' ? userPrompt : `[${modeLabel}] ${userPrompt}` 
      };

      if (idx === -1) {
        return [{ 
          id: workingSessionId, 
          title: userPrompt.substring(0, 40) + (userPrompt.length > 40 ? '...' : ''), 
          messages: [userMessage] 
        }, ...prev];
      } else {
        const next = [...prev];
        next[idx] = { ...next[idx], messages: [...next[idx].messages, userMessage] };
        return next;
      }
    });

    // ─── 2. EXECUTE MODE LOGIC (Unified Conversational Flow) ───


    try {
      let response;
      let data;

      // All modes now call /doubt to ensure conversational-first experience on dashboard
      response = await fetch(`${API_URL}/doubt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          question: userPrompt,
          history: messages,
          activeMode: currentMode,
          forceNoVisuals: currentMode === 'chat'
        }),
      });
      
      if (!response.ok) throw new Error('TutorBoard AI is currently unavailable.');
      const result = await response.json();
      
      console.log('[TutorBoard] API response:', JSON.stringify(result).substring(0, 300));

      const visualSteps = (result.hasVisuals && result.visualUpdate)
        ? (result.visualUpdate.steps || result.visualUpdate.sequence || []) 
        : [];
      
      data = {
        answer: result.answer,
        steps: visualSteps,
        title: result.visualUpdate?.title || 'Response',
        domain: result.visualUpdate?.domain,
        visualizationType: result.visualUpdate?.visualizationType || result.visualUpdate?.type,
        hasVisuals: result.hasVisuals,
        objects: result.visualUpdate?.objects,
        elements: result.visualUpdate?.elements,
        motion: result.visualUpdate?.motion,
        connections: result.visualUpdate?.connections,
        sequence: result.visualUpdate?.sequence
      };
      
      setChatHistory(prev => {
        const next = [...prev];
        const idx = next.findIndex(s => s.id === workingSessionId);
        if (idx !== -1) {
          const hasVisualData = (data.steps && data.steps.length > 0) || (data.objects && data.objects.length > 0);
          let aiMessageContent = data.answer;
          
          // Personality: In teaching modes, if AI only gives visual, provide a nice breadcrumb
          if (currentMode !== 'chat' && !aiMessageContent && hasVisualData) {
             aiMessageContent = `I've prepared a visual diagram for **${data.title}**.`;
          }

          next[idx] = {
            ...next[idx],
            messages: [
              ...next[idx].messages,
              {
                id: getMsgId('ai'),
                role: 'assistant',
                content: aiMessageContent || "Done.",
                steps: data.steps,
                stepTitle: data.title,
                domain: data.domain,
                visualizationType: data.visualizationType,
                objects: data.objects,
                elements: data.elements,
                motion: data.motion,
                connections: data.connections,
                sequence: data.sequence
              }
            ]
          };
        }
        return next;
      });
    } catch (err) {
      console.error('[TutorBoard] Submit error:', err);
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
                id: getMsgId('error'),
                role: 'assistant',
                content: `⚠️ ${err.message || 'Something went wrong. Please try again.'}`,
                steps: [],
                stepTitle: '',
                domain: 'general',
                visualizationType: 'process'
              }
            ]
          };
        }
        return next;
      });
    } finally {
      setIsGenerating(false);
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

        {/* State 1: Landing View */}
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
                    activeMode={activeMode}
                    setActiveMode={setActiveMode}
                    isDark={isDark}
                 />
              </motion.div>
            </motion.div>
         )}

        {/* State 2: Active Chat / Canvas View */}
        {hasStarted && activeView === 'chat' && (
          <div className="absolute inset-0 z-30 flex flex-col overflow-hidden">
            
            {/* Spacer for top navbar */}
            <div className="h-[80px] flex-shrink-0" />

            {/* ─── MODE-BASED CONTENT ─── */}
            <div className="flex-1 relative overflow-hidden">
              
              {/* 1. CHAT / PEDAGOGICAL HUB (Persistent) */}
              <div className={`absolute inset-0 flex flex-col transition-all duration-500 ${(activeView === 'chat' && activeMode !== 'canvas') ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-10 pointer-events-none'}`}>
                <div className="flex-1 overflow-y-auto no-scrollbar px-4 pt-4">
                   <div className="w-full max-w-3xl mx-auto py-10">
                      <ChatWindow 
                        messages={messages} 
                        isGenerating={isGenerating} 
                        onOpenCanvas={handleOpenCanvas}
                        onDeleteMessage={handleDeleteMessage}
                        onEditMessage={handleEditMessage}
                      />
                   </div>
                </div>
              </div>

              {/* 2. CANVAS MODE (Legacy) */}
              <div className={`absolute inset-0 transition-all duration-500 ${(activeMode === 'canvas' && !isGenerating) ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none'}`}>
                 <Board 
                   stepData={teachingData?.steps?.[0]} 
                   steps={teachingData?.steps || []} 
                   currentStep={0} 
                   domain={teachingData?.domain} 
                   visualizationType={teachingData?.visualizationType} 
                   objects={teachingData?.objects}
                 />
              </div>

            </div>

            {/* Fixed Input Bar at Bottom */}
            <div className="flex-shrink-0 w-full pb-6 pt-3 px-4 bg-gradient-to-t from-[var(--bg-primary)] via-[var(--bg-primary)] to-transparent z-40">
               <div className="w-full max-w-3xl mx-auto">
                  <InputBar 
                    value={prompt} 
                    onChange={setPrompt} 
                    onSubmit={handleSubmit} 
                    isGenerating={isGenerating} 
                    activeMode={activeMode}
                    setActiveMode={setActiveMode}
                    isDark={isDark}
                  />
               </div>
            </div>

          </div>
        )}

      </div>

      {/* Teaching Modal Overlay (legacy visual viewer) */}
      <TeachingModal
        isOpen={isTeachingOpen}
        onClose={() => { 
          setIsTeachingOpen(false); 
          setTeachingData(null); 
          setActiveMode('chat');
        }}
        title={teachingData?.title}
        steps={teachingData?.steps || []}
        domain={teachingData?.domain}
        visualizationType={teachingData?.visualizationType}
        objects={teachingData?.objects}
        elements={teachingData?.elements}
        motion={teachingData?.motion}
        connections={teachingData?.connections}
        sequence={teachingData?.sequence}
      />

      {/* NEW: Real-Time Teaching Session in Portal */}
      {isTeachingSessionOpen && typeof document !== 'undefined' && createPortal(
        <ErrorBoundary onClose={() => setIsTeachingSessionOpen(false)}>
          <TeachingSession
            isOpen={isTeachingSessionOpen}
            onClose={() => {
              setIsTeachingSessionOpen(false);
              setTeachingTopic('');
              setActiveMode('chat');
            }}
            initialTopic={teachingTopic}
          />
        </ErrorBoundary>,
        document.body
      )}

    </Layout>
  );
};

export default Home;
