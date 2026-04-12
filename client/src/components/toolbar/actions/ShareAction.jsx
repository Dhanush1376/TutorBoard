import React from 'react';
import { 
  Share, 
  Link, 
  Download, 
  FileJson,
  QrCode
} from 'lucide-react';
import ActionButtonBase from '../components/ActionButtonBase';

const ShareAction = (props) => {
  const Submenu = (
    <div className="flex flex-col gap-4 p-3.5 min-w-[200px]">
      {/* Collaboration */}
      <div className="flex flex-col gap-2">
        <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest px-1">Collaborate</span>
        <button
          onClick={() => {
            navigator.clipboard.writeText(window.location.href);
            props.onMouseLeave?.();
          }}
          className="flex items-center gap-3 p-3 rounded-xl border border-[var(--border-color)] hover:bg-[var(--bg-secondary)] transition-all group"
        >
          <div className="w-8 h-8 rounded-lg bg-[var(--bg-primary)] flex items-center justify-center group-hover:scale-110 transition-transform">
            <Link size={15} className="text-[var(--text-primary)]" />
          </div>
          <div className="flex flex-col items-start leading-tight">
            <span className="text-xs font-bold text-[var(--text-primary)]">Invite Others</span>
            <span className="text-[9px] text-[var(--text-tertiary)]">Copy secure link</span>
          </div>
        </button>
      </div>

      <div className="h-px bg-[var(--border-color)] opacity-40 mx-1" />

      {/* Export Options */}
      <div className="flex flex-col gap-2">
        <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest px-1">Archive & Export</span>
        <div className="flex gap-2">
          <button
            title="Download as PNG"
            className="flex-1 flex flex-col items-center gap-1.5 p-2 rounded-xl border border-[var(--border-color)] hover:bg-[var(--bg-secondary)] transition-all group"
          >
            <Download size={14} className="text-[var(--text-tertiary)] group-hover:text-[var(--text-primary)]" />
            <span className="text-[9px] font-bold uppercase text-[var(--text-tertiary)]">PNG</span>
          </button>
          <button
            title="Copy as Canvas JSON"
            className="flex-1 flex flex-col items-center gap-1.5 p-2 rounded-xl border border-[var(--border-color)] hover:bg-[var(--bg-secondary)] transition-all group"
          >
            <FileJson size={14} className="text-[var(--text-tertiary)] group-hover:text-[var(--text-primary)]" />
            <span className="text-[9px] font-bold uppercase text-[var(--text-tertiary)]">JSON</span>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <ActionButtonBase 
      {...props}
      icon={Share} 
      label="Share Session" 
      customSubmenu={Submenu}
    />
  );
};

export default ShareAction;
