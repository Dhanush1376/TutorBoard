import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Settings, CreditCard, User, Sparkles, ShieldCheck, ChevronRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import useTutorStore from '../../store/tutorStore';

const AccountMenu = ({ onSettingsClick, variant = 'full', layoutView = 'right' }) => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);
  const isLeftHand = layoutView === 'left';
  const { user: authUser, logout } = useAuth();
  
  // Get initials
  const initials = authUser?.name 
    ? authUser.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
    : 'U';

  const handleLogout = () => {
    logout();
  };

  const [imgError, setImgError] = useState(false);

  if (variant === 'compact') {
    return (
      <div className="relative" ref={menuRef}>
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className={`flex items-center gap-2.5 p-1 px-2 rounded-full transition-all border ${isOpen ? 'bg-[var(--bg-tertiary)] border-[var(--border-color)]' : 'border-transparent hover:border-[var(--border-color)] hover:bg-[var(--bg-tertiary)]'}`}
        >
          <div className={`w-7 h-7 rounded-full flex items-center justify-center font-normal text-[10px] uppercase tracking-wider shadow-sm transition-transform hover:scale-105 overflow-hidden bg-[var(--text-primary)] text-[var(--bg-primary)]`}>
            {authUser?.avatar && !imgError ? (
              <img 
                src={authUser.avatar} 
                alt="" 
                className="w-full h-full object-cover" 
                onError={() => setImgError(true)}
              />
            ) : (
              initials
            )}
          </div>
          <div className="flex flex-col flex-1 items-start pr-1 overflow-hidden min-w-0">
             <span className="text-[12px] font-normal text-[var(--text-primary)] truncate max-w-[80px]">
               {authUser?.name || 'User'}
             </span>
          </div>
        </button>

        {/* Dropdown Menu - Top orientation (aligned based on hand view) */}
        <div 
          className={`absolute top-full ${isLeftHand ? 'left-0' : 'right-0'} pt-2 w-56 transition-all duration-300 ease-spring z-[100] ${isOpen ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-1 pointer-events-none'}`}
        >
          <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-2xl p-1.5 shadow-2xl overflow-hidden">
            <div className="px-4 py-3 mb-1 border-b border-[var(--border-color)] bg-[var(--bg-tertiary)]/30">
               <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-normal text-xs uppercase tracking-wider overflow-hidden bg-[var(--text-primary)] text-[var(--bg-primary)]`}>
                    {authUser?.avatar && !imgError ? (
                      <img 
                        src={authUser.avatar} 
                        alt="" 
                        className="w-full h-full object-cover" 
                        onError={() => setImgError(true)}
                      />
                    ) : (
                      initials
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 overflow-hidden">
                      <p className="text-[13px] font-normal text-[var(--text-primary)] truncate">{authUser?.name || 'User'}</p>
                    </div>
                    <p className="text-[10px] font-normal text-[var(--text-tertiary)] truncate">{authUser?.email || 'user@tutorboard.app'}</p>
                  </div>
               </div>
            </div>
            
            <div className="p-1 space-y-0.5">
              <button 
                onClick={() => { setIsOpen(false); onSettingsClick('appearance'); }}
                className="w-full flex items-center gap-3 p-2.5 hover:bg-[var(--bg-tertiary)] rounded-xl text-[13px] font-normal text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors text-left"
              >
                <Settings size={15} />
                Settings
              </button>

              <div className="px-3 py-1.5 opacity-40 grayscale flex items-center gap-3">
                <CreditCard size={15} />
                <span className="text-[11px] font-normal uppercase tracking-widest">Premium Plan</span>
              </div>
              
              <div className="h-[1px] bg-[var(--border-color)] my-1.5 mx-2" />
              
              <button 
                onClick={() => { setIsOpen(false); handleLogout(); }} 
                className="w-full flex items-center gap-3 p-2.5 hover:bg-red-500/10 rounded-xl text-[13px] font-normal text-red-500 transition-colors text-left"
              >
                <LogOut size={15} />
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full mb-1" ref={menuRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center gap-3 p-2 rounded-2xl transition-all border ${isOpen ? 'bg-[var(--bg-tertiary)] border-[var(--border-color)]' : 'border-transparent hover:border-[var(--border-color)] hover:bg-[var(--bg-tertiary)]'}`}
      >
        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-normal text-[11px] uppercase tracking-wider shadow-sm overflow-hidden bg-[var(--text-primary)] text-[var(--bg-primary)]`}>
          {authUser?.avatar && !imgError ? (
            <img 
              src={authUser.avatar} 
              alt="" 
              className="w-full h-full object-cover" 
              onError={() => setImgError(true)}
            />
          ) : (
            initials
          )}
        </div>
        <div className="flex-1 text-left whitespace-nowrap overflow-hidden">
          <div className="flex items-center gap-2">
            <p className="text-[13px] font-normal text-[var(--text-primary)] truncate">{authUser?.name || '...'}</p>
          </div>
        </div>
      </button>

      {/* Context menu on click - Sidebar orientation (bottom-up) */}
      <div 
        className={`absolute bottom-full left-0 w-full pb-2 transition-all duration-300 ease-spring z-[100] ${isOpen ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-1 pointer-events-none'}`}
      >
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-[18px] p-1.5 shadow-2xl">
          
          <div className="p-1 space-y-0.5">
            <div className="px-3 py-1.5 opacity-40 grayscale flex items-center gap-3">
              <CreditCard size={15} />
              <span className="text-[11px] font-normal uppercase tracking-widest">Premium Plan</span>
            </div>
            
            <div className="h-[1px] bg-[var(--border-color)] my-1.5 mx-2" />
            
            <button 
              onClick={() => { setIsOpen(false); handleLogout(); }} 
              className="w-full flex items-center gap-3 p-2.5 hover:bg-red-500/10 rounded-xl text-[13px] font-normal text-red-500 transition-colors text-left"
            >
              <LogOut size={15} />
              Logout
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccountMenu;
