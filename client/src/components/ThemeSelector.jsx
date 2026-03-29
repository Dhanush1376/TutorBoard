import React from 'react';
import { useTheme } from '../context/ThemeContext';
import { Sun, Moon, Check } from 'lucide-react';

const ThemeSelector = () => {
  const { themes, currentThemeId, setCurrentThemeId, mode, toggleMode } = useTheme();

  return (
    <div className="w-full space-y-6">
      
      {/* 1. Mode Toggle (Separate from Theme) */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
          Appearance
        </span>
        <button
          onClick={toggleMode}
          className="flex items-center gap-2 px-3 py-1.5 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-full hover:bg-[var(--bg-secondary)] transition-all"
        >
          <div className={`p-1 rounded-full transition-all ${mode === 'light' ? 'bg-[#D4D4D4] text-[#0f0f0f]' : 'text-[var(--text-tertiary)]'}`}>
            <Sun size={12} />
          </div>
          <div className={`p-1 rounded-full transition-all ${mode === 'dark' ? 'bg-[#D4D4D4] text-[#0f0f0f]' : 'text-[var(--text-tertiary)]'}`}>
            <Moon size={12} />
          </div>
        </button>
      </div>

      {/* 2. 2x2 Theme Grid */}
      <div className="grid grid-cols-2 gap-3">
        {themes.map((theme) => {
          const isSelected = currentThemeId === theme.id;
          const displayColors = theme.colors[mode];

          return (
            <button
              key={theme.id}
              onClick={() => setCurrentThemeId(theme.id)}
              className={`flex flex-col items-start p-3 rounded-2xl border transition-all text-left relative group ${
                isSelected 
                  ? 'bg-[var(--bg-tertiary)] border-[var(--text-primary)] shadow-lg' 
                  : 'bg-transparent border-[var(--border-color)] hover:border-[var(--text-tertiary)]'
              }`}
            >
              {isSelected && (
                <div className="absolute top-2 right-2 w-4 h-4 bg-[var(--text-primary)] text-[var(--bg-primary)] rounded-full flex items-center justify-center">
                   <Check size={10} strokeWidth={4} />
                </div>
              )}

              <span className={`text-[11px] font-bold mb-3 transition-colors ${isSelected ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
                {theme.name}
              </span>

              {/* Color Swatch Strip */}
              <div className="flex gap-1.5 mt-auto">
                {[displayColors.bg, displayColors.surface, displayColors.text, displayColors.aiBubble].map((color, i) => (
                  <div 
                    key={i} 
                    className="w-3 h-3 rounded-full border border-black/5 shadow-sm" 
                    style={{ backgroundColor: color }} 
                  />
                ))}
              </div>
            </button>
          );
        })}
      </div>

    </div>
  );
};

export default ThemeSelector;
