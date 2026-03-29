import React, { useState, useEffect } from 'react';
import Layout from '../components/layout/Layout';
import Sidebar from '../components/sidebar/Sidebar';
import Board from '../components/Board';
import ChatWindow from '../components/chat/ChatWindow';
import InputBar from '../components/chat/InputBar';
import TeachingModal from '../components/teaching/TeachingModal';
import ModulesPage from '../components/modules/ModulesPage';
import { motion, AnimatePresence } from 'framer-motion';

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
        { id: `msg-${Date.now()}-1`, role: 'user', content: `Explain ${moduleData.title}` },
        { id: `msg-${Date.now()}-2`, role: 'assistant', content: moduleData.description, steps: moduleData.data.steps }
      ]
    };
    setChatHistory(prev => [newSession, ...prev]);
    setActiveChatId(sessionId);
  };

  const handleSubmit = async () => {
    if (!prompt.trim()) return;
    
    let workingSessionId = activeChatId;
    let workingHistory = [...chatHistory];

    if (!workingSessionId) {
      workingSessionId = `session-${Date.now()}`;
      workingHistory = [{ id: workingSessionId, title: prompt, messages: [] }, ...workingHistory];
      setActiveChatId(workingSessionId);
    }

    const sessionIndex = workingHistory.findIndex(s => s.id === workingSessionId);
    if (sessionIndex === -1) return;

    const userPrompt = prompt;
    setPrompt('');
    setIsGenerating(true);
    setError(null);
    setActiveView('chat'); // Ensure we are in chat view

    workingHistory[sessionIndex].messages.push({ id: `msg-${Date.now()}`, role: 'user', content: userPrompt });
    setChatHistory([...workingHistory]);

    try {
      const response = await fetch('http://localhost:3001/api/generate', {
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
          next[idx].messages.push({
            id: `msg-${Date.now()}-ai`,
            role: 'assistant',
            content: data.steps && data.steps.length > 0 
              ? `Visualization for ${data.title} ready on stage.` 
              : "I've processed your request, but I couldn't generate a visual step-by-step for this concept yet.",
            steps: data.steps
          });
        }
        return next;
      });

      // Open the Teaching Modal with the received data
      if (data.steps && data.steps.length > 0) {
        setTeachingData({ title: data.title, steps: data.steps });
        setIsTeachingOpen(true);
      }
    } catch (err) {
      console.error(err);
      setError(err.message);
      // Add error message to chat
      setChatHistory(prev => {
        const next = [...prev];
        const idx = next.findIndex(s => s.id === workingSessionId);
        if (idx !== -1) {
          next[idx].messages.push({
            id: `msg-${Date.now()}-err`,
            role: 'assistant',
            content: `Error: ${err.message}`
          });
        }
        return next;
      });
    } finally {
      setIsGenerating(false);
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
        {activeView === 'modules' && (
          <div className="absolute inset-0 z-40 bg-[var(--bg-primary)] h-full w-full overflow-hidden">
            <ModulesPage 
              customModules={customModules}
              setCustomModules={setCustomModules}
              onLoadModule={(mod) => {
                handleLoadModule(mod);
                setActiveView('chat');
              }}
            />
          </div>
        )}

        {/* Immersive Stage - Full Screen Background */}
        <div className={`absolute inset-0 z-0 transition-opacity duration-1000 ${hasStarted && activeView === 'chat' ? 'opacity-100' : 'opacity-0'}`}>
          <Board stepData={activeSteps.length > 0 ? activeSteps[currentStep] : null} />
        </div>

        {/* State 1: Claude-style Landing View */}
        {!hasStarted && activeView === 'chat' && (
           <motion.div 
             initial={{ opacity: 0, scale: 0.98, filter: 'blur(8px)' }}
             animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
             transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
             className="w-full h-full flex flex-col items-center justify-center relative z-20 px-6"
           >
              <div className="flex flex-col items-center justify-center mb-12 relative">
                <motion.span 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                  className="text-sm md:text-base font-sans text-[var(--text-tertiary)] uppercase tracking-[0.2em] self-start md:-ml-8 mb-2"
                >
                  Welcome to, 
                </motion.span>
                
                {/* Typing Animation for TutorBoard Studio */}
                <h1 className="text-4xl md:text-6xl font-serif text-[var(--text-primary)] tracking-tight opacity-95 flex overflow-hidden">
                  {"TutorBoard Studio".split('').map((char, index) => (
                    <motion.span
                      key={index}
                      initial={{ opacity: 0, y: 20, filter: 'blur(4px)' }}
                      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                      transition={{ 
                        duration: 0.4, 
                        delay: 0.3 + (index * 0.04), 
                        ease: [0.2, 0.6, 0.3, 1] 
                      }}
                    >
                      {char === ' ' ? '\u00A0' : char}
                    </motion.span>
                  ))}
                </h1>
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
                className="flex flex-wrap justify-center gap-3 mt-10 max-w-2xl px-4"
              >
                 {['Binary Search steps', 'Bubble Sort visualization', 'Graph plotting'].map((hint, i) => (
                   <motion.button 
                     key={hint}
                     initial={{ opacity: 0, scale: 0.9 }}
                     animate={{ opacity: 1, scale: 1 }}
                     transition={{ duration: 0.4, delay: 1.2 + (i * 0.1), ease: "easeOut" }}
                     onClick={() => { setPrompt(hint); setTimeout(() => { const el = document.querySelector('textarea'); if(el) { el.focus(); } }, 50); }}
                     className="px-4 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-full text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-all font-medium"
                   >
                     {hint}
                   </motion.button>
                 ))}
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
                  <ChatWindow messages={messages} />
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
