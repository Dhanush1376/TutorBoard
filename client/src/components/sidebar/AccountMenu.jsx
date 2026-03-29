import React from 'react';
import { LogOut, Settings, CreditCard } from 'lucide-react';

const AccountMenu = () => {
  return (
    <div className="group relative w-full">
      <button className="w-full flex items-center gap-3 p-2 hover:bg-[var(--bg-tertiary)] rounded-xl transition-all border border-transparent hover:border-[var(--border-color)]">
        <div className="w-8 h-8 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center text-[var(--text-primary)] font-medium text-xs border border-[var(--border-color)]">
          DA
        </div>
        <div className="flex-1 text-left">
          <p className="text-xs font-medium text-[var(--text-primary)]">Dhanush A.</p>
          <p className="text-[10px] text-[var(--text-tertiary)]">Free Plan</p>
        </div>
      </button>

      {/* Context menu on hover */}
      <div className="absolute bottom-full left-0 w-full mb-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl p-1.5 shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none group-hover:pointer-events-auto">
        {[
          { icon: Settings, label: 'Settings' },
          { icon: CreditCard, label: 'Subscription' },
        ].map((item) => (
          <button key={item.label} className="w-full flex items-center gap-2 p-2 hover:bg-[var(--bg-tertiary)] rounded-lg text-xs text-[var(--text-secondary)] transition-colors">
            <item.icon size={12} />
            {item.label}
          </button>
        ))}
        <div className="h-px bg-[var(--border-color)] my-1" />
        <button className="w-full flex items-center gap-2 p-2 hover:bg-red-500/10 rounded-lg text-xs text-[var(--text-tertiary)] hover:text-red-400 transition-colors">
          <LogOut size={12} />
          Logout
        </button>
      </div>
    </div>
  );
};

export default AccountMenu;
