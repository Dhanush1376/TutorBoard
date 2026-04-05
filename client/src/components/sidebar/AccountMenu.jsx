import React from 'react';
import { LogOut, Settings, CreditCard, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const AccountMenu = ({ onSettingsClick, variant = 'full' }) => {
  const { user, logout } = useAuth();
  
  // Get initials
  const initials = user?.name 
    ? user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
    : 'G';

  const handleLogout = () => {
    logout();
  };

  if (variant === 'compact') {
    return (
      <div className="group relative">
        <button className="flex items-center gap-2.5 p-1 px-2 hover:bg-[var(--bg-tertiary)] rounded-full transition-all border border-transparent hover:border-[var(--border-color)] group/btn">
          <div className="w-7 h-7 rounded-full bg-[var(--text-primary)] flex items-center justify-center text-[var(--bg-primary)] font-bold text-[10px] uppercase tracking-wider shadow-sm transition-transform group-hover/btn:scale-105">
            {initials}
          </div>
          <div className="flex flex-col flex-1 items-start pr-1 overflow-hidden min-w-0">
             <span className="text-[12px] font-semibold text-[var(--text-primary)] truncate max-w-[80px]">
               {user?.name || 'Guest'}
             </span>
          </div>
        </button>

        {/* Dropdown Menu - Top Right orientation */}
        <div className="absolute top-full right-0 mt-2 w-56 opacity-0 translate-y-2 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto transition-all duration-300 ease-spring z-[100]">
          <div className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-2xl p-1.5 shadow-2xl backdrop-blur-3xl overflow-hidden" style={{ background: 'var(--glass-bg)', backdropFilter: 'blur(24px) saturate(1.8)', WebkitBackdropFilter: 'blur(24px) saturate(1.8)' }}>
            <div className="px-4 py-3 mb-1 border-b border-[var(--border-color)] bg-[var(--bg-tertiary)]/30">
               <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[var(--text-primary)] flex items-center justify-center text-[var(--bg-primary)] font-bold text-xs uppercase tracking-wider">
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold text-[var(--text-primary)] truncate">{user?.name || 'Guest User'}</p>
                    <p className="text-[10px] font-medium text-[var(--text-tertiary)] truncate">{user?.email || 'guest@tutorboard.app'}</p>
                  </div>
               </div>
            </div>
            
            <div className="p-1 space-y-0.5">
              <button onClick={onSettingsClick} className="w-full flex items-center gap-3 p-2.5 hover:bg-[var(--bg-tertiary)] rounded-xl text-[13px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors text-left">
                <Settings size={15} />
                Settings
              </button>
              <button className="w-full flex items-center gap-3 p-2.5 hover:bg-[var(--bg-tertiary)] rounded-xl text-[13px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors text-left">
                <CreditCard size={15} />
                Subscription
              </button>
              
              <div className="h-[1px] bg-[var(--border-color)] my-1.5 mx-2" />
              
              <button onClick={handleLogout} className="w-full flex items-center gap-3 p-2.5 hover:bg-red-500/10 rounded-xl text-[13px] font-medium text-red-500 transition-colors text-left">
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
    <div className="group relative w-full mb-1">
      <button className="w-full flex items-center gap-3 p-2 hover:bg-[var(--bg-tertiary)] rounded-2xl transition-all border border-transparent hover:border-[var(--border-color)]">
        <div className="w-8 h-8 rounded-full bg-[var(--text-primary)] flex items-center justify-center text-[var(--bg-primary)] font-bold text-[11px] uppercase tracking-wider shadow-sm">
          {initials}
        </div>
        <div className="flex-1 text-left whitespace-nowrap overflow-hidden">
          <p className="text-[13px] font-semibold text-[var(--text-primary)] truncate">{user?.name || 'Loading...'}</p>
        </div>
      </button>

      {/* Context menu on hover - Sidebar orientation (bottom-up) */}
      <div className="absolute bottom-full left-0 w-full mb-2 opacity-0 translate-y-2 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto transition-all duration-300 ease-spring z-[100]">
        <div className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-[18px] p-1.5 shadow-2xl backdrop-blur-3xl" style={{ background: 'var(--glass-bg)', backdropFilter: 'blur(24px) saturate(1.8)', WebkitBackdropFilter: 'blur(24px) saturate(1.8)' }}>
          <button onClick={onSettingsClick} className="w-full flex items-center gap-3 p-2.5 hover:bg-[var(--bg-tertiary)] rounded-xl text-[13px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors text-left">
            <Settings size={15} />
            Settings
          </button>
          <button className="w-full flex items-center gap-3 p-2.5 hover:bg-[var(--bg-tertiary)] rounded-xl text-[13px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors text-left">
            <CreditCard size={15} />
            Subscription
          </button>
          <div className="h-[1px] bg-[var(--border-color)] my-1.5 mx-2" />
          <button onClick={handleLogout} className="w-full flex items-center gap-3 p-2.5 hover:bg-red-500/10 rounded-xl text-[13px] font-medium text-red-500 transition-colors text-left">
            <LogOut size={15} />
            Logout
          </button>
        </div>
      </div>
    </div>
  );
};

export default AccountMenu;
