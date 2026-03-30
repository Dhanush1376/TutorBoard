import React, { useState } from 'react';
import { PanelLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import Logo from '../Logo';

const Layout = ({ sidebar, children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 768);

  // Inject onClose prop to the sidebar component
  const sidebarWithProps = React.isValidElement(sidebar) 
    ? React.cloneElement(sidebar, { onClose: () => setIsSidebarOpen(false) })
    : sidebar;

  return (
    <div className="h-full w-full bg-[var(--bg-primary)] text-[var(--text-primary)] flex overflow-hidden font-sans border-0 m-0 p-0 transition-colors duration-250">
      
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

        {/* Top Navbar Overlay (Like Gemini) */}
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
               <div className="flex items-center gap-2 px-2 py-2.5">
                 <span className="text-[var(--text-secondary)] text-[15px] font-bold tracking-tight">
                   TutorBoard
                 </span>
               </div>
           </div>
            <div className="flex items-center pointer-events-auto mr-8">
              <motion.div
                whileHover={{ y: -1, scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="relative"
              >
                <Link 
                  to="/auth"
                  className="flex items-center justify-center px-6 py-2 rounded-full font-bold text-[14px] tracking-tight shadow-md transition-shadow duration-300 group"
                  style={{ 
                    backgroundColor: 'var(--text-primary)', 
                    color: 'var(--bg-primary)',
                    textDecoration: 'none'
                  }}
                >
                    <span className="relative z-10 mr-1.5 opacity-100">Sign In</span>
                    
                    <motion.svg 
                      width="15" 
                      height="15" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="2.5" 
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                    >
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </motion.svg>
                </Link>
              </motion.div>
           </div>
        </header>

        {/* Content Area */}
        {children}
      </main>

    </div>
  );
};

export default Layout;
