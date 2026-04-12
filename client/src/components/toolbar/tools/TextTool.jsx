import React from 'react';
import { 
  Type, 
  Terminal, 
  Sigma,
  Check
} from 'lucide-react';
import useTutorStore from '../../../store/tutorStore';
import ToolButtonBase from '../components/ToolButtonBase';

const MODES = [
  { id: 'standard', icon: Type,     label: 'Label',   desc: 'Clean annotations' },
  { id: 'code',     icon: Terminal, label: 'Code',    desc: 'Monospace panel' },
  { id: 'formula',  icon: Sigma,    label: 'Math',    desc: 'LaTeX Notation' },
];

const SIZES = [
  { id: 12, label: 'Small' },
  { id: 16, label: 'Medium' },
  { id: 24, label: 'Large' },
  { id: 32, label: 'Heading' },
];

const TextTool = (props) => {
  const { 
    textType, setTextType,
    textSize, setTextSize 
  } = useTutorStore();

  const Submenu = (
    <div className="flex flex-col gap-5 p-3.5 min-w-[210px]">
      {/* Notation Mode */}
      <div className="flex flex-col gap-2.5">
        <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest px-1">Notation Mode</span>
        <div className="flex flex-col gap-1">
          {MODES.map((mode) => {
            const isActive = textType === mode.id;
            return (
              <button
                key={mode.id}
                onClick={() => setTextType(mode.id)}
                className="flex items-center gap-3 p-2.5 rounded-xl transition-all border"
                style={{ 
                  background: isActive ? 'var(--bg-secondary)' : 'transparent',
                  borderColor: isActive ? 'var(--text-primary)' : 'transparent',
                  color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)'
                }}
              >
                <div 
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: isActive ? 'var(--bg-primary)' : 'rgba(255,255,255,0.03)' }}
                >
                  <mode.icon size={16} strokeWidth={isActive ? 2.5 : 2} />
                </div>
                <div className="flex flex-col items-start leading-tight">
                  <span className="text-[11px] font-bold">{mode.label}</span>
                  <span className="text-[9px] text-[var(--text-tertiary)]">{mode.desc}</span>
                </div>
                {isActive && <Check size={12} className="ml-auto" />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="h-px bg-[var(--border-color)] opacity-40 mx-1" />

      {/* Font Scale */}
      <div className="flex flex-col gap-2.5">
        <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest px-1">Font Scale</span>
        <div className="flex gap-1 p-1 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)]">
          {SIZES.map((s) => {
            const isActive = textSize === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setTextSize(s.id)}
                className="flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all"
                style={{ 
                  background: isActive ? 'var(--bg-primary)' : 'transparent',
                  color: isActive ? 'var(--text-primary)' : 'var(--text-tertiary)',
                  boxShadow: isActive ? '0 2px 8px rgba(0,0,0,0.12)' : 'none',
                  border: isActive ? '1px solid var(--border-color)' : '1px solid transparent'
                }}
              >
                {s.label[0]}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  const CurrentIcon = MODES.find(m => m.id === textType)?.icon || Type;

  return (
    <ToolButtonBase 
      {...props}
      id="text" 
      icon={CurrentIcon} 
      label="Text" 
      shortcut="T"
      customSubmenu={Submenu}
    />
  );
};

export default TextTool;
