import React from 'react';
import {
  Type,
  Terminal,
  Sigma,
  MessageSquare,
  Check,
  AlignLeft,
  AlignCenter,
  AlignRight,
} from 'lucide-react';
import useTutorStore from '../../../store/tutorStore';
import ToolButtonBase from '../components/ToolButtonBase';

const MODES = [
  { id: 'standard', icon: Type,          label: 'Label',   desc: 'Clean annotations'   },
  { id: 'code',     icon: Terminal,      label: 'Code',    desc: 'Monospace panel'      },
  { id: 'formula',  icon: Sigma,         label: 'Math',    desc: 'LaTeX notation'       },
  { id: 'callout',  icon: MessageSquare, label: 'Callout', desc: 'Bubble annotation'    },
];

const SIZES = [
  { id: 12, label: 'XS' },
  { id: 16, label: 'S'  },
  { id: 24, label: 'M'  },
  { id: 32, label: 'L'  },
  { id: 48, label: 'XL' },
];

const WEIGHTS = [
  { id: 'regular', label: 'Regular', style: 400 },
  { id: 'medium',  label: 'Medium',  style: 500 },
  { id: 'bold',    label: 'Bold',    style: 700 },
];

const ALIGNMENTS = [
  { id: 'left',   icon: AlignLeft   },
  { id: 'center', icon: AlignCenter },
  { id: 'right',  icon: AlignRight  },
];

const SegButton = ({ isActive, onClick, children, style: extraStyle }) => (
  <button
    onClick={onClick}
    className="flex-1 py-1.5 rounded-lg transition-all text-center"
    style={{
      background:  isActive ? 'var(--bg-primary)' : 'transparent',
      color:       isActive ? 'var(--text-primary)' : 'var(--text-tertiary)',
      border:      isActive ? '1px solid var(--border-color)' : '1px solid transparent',
      boxShadow:   isActive ? '0 2px 8px rgba(0,0,0,.12)' : 'none',
      fontSize: 9,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '.04em',
      ...extraStyle,
    }}
  >
    {children}
  </button>
);

const SegBar = ({ children }) => (
  <div
    className="flex gap-1 p-1 rounded-xl border"
    style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
  >
    {children}
  </div>
);

const TextTool = (props) => {
  const {
    textType,   setTextType,
    textSize,   setTextSize,
    textWeight, setTextWeight,
    textAlign,  setTextAlign,
  } = useTutorStore();

  const Submenu = (
    <div className="flex flex-col gap-4 p-3.5" style={{ minWidth: 230 }}>

      {/* Notation mode */}
      <div className="flex flex-col gap-2">
        <span className="text-[9px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest px-1">
          Notation mode
        </span>
        <div className="flex flex-col gap-1">
          {MODES.map(({ id, icon: Icon, label, desc }) => {
            const isActive = textType === id;
            return (
              <button
                key={id}
                onClick={() => setTextType(id)}
                className="flex items-center gap-2.5 p-2.5 rounded-xl transition-all border text-left w-full"
                style={{
                  background:  isActive ? 'var(--bg-secondary)' : 'transparent',
                  borderColor: isActive ? 'var(--border-color)' : 'transparent',
                  color:       isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                }}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{
                    background: isActive ? 'var(--bg-primary)' : 'rgba(255,255,255,.03)',
                  }}
                >
                  <Icon size={14} strokeWidth={isActive ? 2.5 : 2} />
                </div>
                <div className="flex flex-col leading-tight flex-1">
                  <span style={{ fontSize: 11, fontWeight: 600 }}>{label}</span>
                  <span style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>{desc}</span>
                </div>
                {isActive && <Check size={12} className="ml-auto flex-shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="h-px bg-[var(--border-color)] opacity-40 mx-1" />

      {/* Font scale */}
      <div className="flex flex-col gap-2">
        <span className="text-[9px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest px-1">
          Font scale
        </span>
        <SegBar>
          {SIZES.map(({ id, label }) => (
            <SegButton key={id} isActive={textSize === id} onClick={() => setTextSize(id)}>
              {label}
            </SegButton>
          ))}
        </SegBar>
      </div>

      {/* Font weight */}
      <div className="flex flex-col gap-2">
        <span className="text-[9px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest px-1">
          Font weight
        </span>
        <SegBar>
          {WEIGHTS.map(({ id, label, style: fw }) => (
            <SegButton
              key={id}
              isActive={(textWeight ?? 'regular') === id}
              onClick={() => setTextWeight(id)}
              style={{ fontWeight: fw }}
            >
              {label}
            </SegButton>
          ))}
        </SegBar>
      </div>

      {/* Alignment */}
      <div className="flex flex-col gap-2">
        <span className="text-[9px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest px-1">
          Alignment
        </span>
        <SegBar>
          {ALIGNMENTS.map(({ id, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTextAlign(id)}
              className="flex-1 flex items-center justify-center py-1.5 rounded-lg transition-all"
              style={{
                background:  (textAlign ?? 'left') === id ? 'var(--bg-primary)' : 'transparent',
                color:       (textAlign ?? 'left') === id ? 'var(--text-primary)' : 'var(--text-tertiary)',
                border:      (textAlign ?? 'left') === id ? '1px solid var(--border-color)' : '1px solid transparent',
                boxShadow:   (textAlign ?? 'left') === id ? '0 2px 8px rgba(0,0,0,.12)' : 'none',
              }}
            >
              <Icon size={13} />
            </button>
          ))}
        </SegBar>
      </div>

    </div>
  );

  const CurrentIcon = MODES.find((m) => m.id === textType)?.icon ?? Type;

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