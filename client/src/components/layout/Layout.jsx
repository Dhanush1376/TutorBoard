import React, { useState } from 'react';
import { PanelLeft } from 'lucide-react';

const Layout = ({ sidebar, children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Inject onClose prop to the sidebar component
  const sidebarWithProps = React.isValidElement(sidebar) 
    ? React.cloneElement(sidebar, { onClose: () => setIsSidebarOpen(false) })
    : sidebar;

  return (
    <div className="h-full w-full bg-[var(--bg-primary)] text-[var(--text-primary)] flex overflow-hidden font-sans border-0 m-0 p-0 transition-colors duration-250">
      
      {/* 1. SIDEBAR: FLUSH LEFT */}
      <aside className={`flex flex-col h-full bg-[var(--bg-secondary)] border-r ${isSidebarOpen ? 'w-[260px] border-[var(--border-color)]' : 'w-0 border-transparent'} overflow-hidden flex-shrink-0 relative z-50 transition-[width,border-color] duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]`}>
        <div className="flex flex-col h-full w-[260px] flex-shrink-0 overflow-hidden">
          {sidebarWithProps}
        </div>
      </aside>

      {/* 2. MAIN STAGE: FULL-BLEED */}
      <main className="flex-1 h-full relative overflow-hidden bg-[var(--bg-primary)] z-10 m-0 p-0">
        
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
               <div className="px-2 py-2.5 text-[var(--text-secondary)] text-[14px] font-bold tracking-wide">
                 Tutor Studio
               </div>
           </div>
           <div className="flex items-center pointer-events-auto mr-4">
              <button 
                onClick={() => alert('Sign In is coming soon! Authentication will be added in a future update.')}
                className="px-5 py-2.5 bg-[#b8e2f2] text-black border border-transparent rounded-[24px] hover:bg-[#a6d8ec] hover:scale-105 active:scale-95 transition-all font-semibold tracking-wide shadow-sm text-[13px]"
              >
                 Sign In
              </button>
           </div>
        </header>

        {/* Content Area */}
        {children}
      </main>

    </div>
  );
};

export default Layout;
