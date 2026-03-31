import React from 'react';
import { LogOut, Settings, CreditCard } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const AccountMenu = ({ onSettingsClick }) => {
  const { user, logout } = useAuth();
  
  // Get initials
  const initials = user?.name 
    ? user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
    : 'U';

  const handleLogout = () => {
    logout();
  };

  return (
    <div className="group relative w-full">
      <button className="w-full flex items-center gap-3 p-2 hover:bg-[var(--bg-tertiary)] rounded-xl transition-all border border-transparent hover:border-[var(--border-color)]">
        <div className="w-8 h-8 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center text-[var(--text-primary)] font-medium text-xs border border-[var(--border-color)]">
          {initials}
        </div>
        <div className="flex-1 text-left whitespace-nowrap overflow-hidden">
          <p className="text-xs font-medium text-[var(--text-primary)] truncate">{user?.name || 'Loading...'}</p>
          <p className="text-[10px] text-[var(--text-tertiary)]">Free Plan</p>
        </div>
      </button>

      {/* Context menu on hover */}
      <div className="absolute bottom-full left-0 w-full mb-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl p-1.5 shadow-2xl opacity-0 hover:opacity-100 group-hover:opacity-100 transition-opacity pointer-events-none group-hover:pointer-events-auto">
        <button onClick={onSettingsClick} className="w-full flex items-center gap-2 p-2 hover:bg-[var(--bg-tertiary)] rounded-lg text-xs text-[var(--text-secondary)] transition-colors">
          <Settings size={12} />
          Settings
        </button>
        <button className="w-full flex items-center gap-2 p-2 hover:bg-[var(--bg-tertiary)] rounded-lg text-xs text-[var(--text-secondary)] transition-colors">
          <CreditCard size={12} />
          Subscription
        </button>
        <div className="h-px bg-[var(--border-color)] my-1" />
        <button onClick={handleLogout} className="w-full flex items-center gap-2 p-2 hover:bg-red-500/10 rounded-lg text-xs text-[var(--text-tertiary)] hover:text-red-400 transition-colors">
          <LogOut size={12} />
          Logout
        </button>
      </div>
    </div>
  );
};

export default AccountMenu;
