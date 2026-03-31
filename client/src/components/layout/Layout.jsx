import React, { useState } from 'react';
import { PanelLeft, Sparkles, LogOut, ChevronRight, User } from 'lucide-react';
import VisaiLogo from '../common/VisaiLogo';
import { useAuth } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import Logo from '../Logo';

const Layout = ({ sidebar, children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 768);
  const { user } = useAuth();

  // Inject onClose prop to the sidebar component
  const sidebarWithProps = React.isValidElement(sidebar) 
    ? React.cloneElement(sidebar, { onClose: () => setIsSidebarOpen(false) })
    : sidebar;

  return (
    <div className="h-screen w-full bg-[var(--bg-primary)] text-[var(--text-primary)] flex overflow-hidden font-sans border-0 m-0 p-0 transition-colors duration-250">
      
      {/* Mobile Backdrop Overlay */}
      {isSidebarOpen && (
         <div 
           className="md:hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity duration-300 pointer-events-auto" 
           onClick={() => setIsSidebarOpen(false)}
         />
      )}

      {/* 1. SIDEBAR */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 md:relative 
        flex flex-col h-full bg-[var(--bg-secondary)] border-r flex-shrink-0 overflow-hidden 
        transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]
        ${isSidebarOpen 
          ? 'translate-x-0 w-[260px] border-[var(--border-color)] shadow-2xl md:shadow-none' 
          : '-translate-x-full md:translate-x-0 w-[260px] md:w-0 border-transparent shadow-none'}
      `}>
        <div className="flex flex-col h-full w-[260px] flex-shrink-0 overflow-hidden">
          {sidebarWithProps}
        </div>
      </aside>

      {/* 2. MAIN STAGE: FULL-BLEED */}
      <main className="flex-1 h-full relative overflow-hidden bg-[var(--bg-primary)] z-10 m-0 p-0">
        
        {/* Subtle Theme-Aware Background Grid */}
        <div className="absolute inset-0 bg-grid-pattern opacity-[0.85] pointer-events-none z-0" />

        {/* Top Navbar Overlay */}
        <header className="absolute top-0 left-0 w-full h-[70px] flex items-center px-4 justify-between bg-transparent z-50 pointer-events-none">
             <div className="flex items-center gap-2 pointer-events-auto">
                 {!isSidebarOpen && (
                   <button 
                     onClick={() => setIsSidebarOpen(true)} 
                     className="p-2 -ml-2 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] transition-all"
                     title="Open sidebar"
                   >
                      <PanelLeft size={22} />
                   </button>
                 )}
                 {!isSidebarOpen && (
                   <div className="flex items-center gap-2 px-1 py-2.5">
                     <VisaiLogo className="w-5 h-5 text-[var(--text-secondary)] opacity-80" size="xs" />
                     <span className="text-[var(--text-secondary)] text-[15px] font-bold tracking-tight">
                       TutorBoard
                     </span>
                   </div>
                 )}
             </div>

             {/* Top Right Action Area */}
             <div className="flex items-center gap-3 pointer-events-auto">
                <AnimatePresence mode="wait">
                  {user?.isGuest ? (
                    <motion.button
                      key="signup"
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      onClick={() => window.location.href = '/'}
                      className="flex items-center gap-2 bg-[var(--text-primary)] text-[var(--bg-primary)] px-4 py-2 rounded-xl text-[13px] font-bold hover:opacity-90 transition-all shadow-lg shadow-black/5"
                    >
                      <Sparkles size={16} />
                      Sign Up
                    </motion.button>
                  ) : (
                    <motion.button
                      key="profile"
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      className="flex items-center gap-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] px-4 py-2 rounded-xl text-[13px] font-bold hover:bg-[var(--bg-tertiary)] transition-all shadow-sm"
                    >
                      <User size={16} />
                      Profile
                    </motion.button>
                  )}
                </AnimatePresence>
             </div>
        </header>

        {/* Content Area */}
        {children}
      </main>

    </div>
  );
};

export default Layout;
