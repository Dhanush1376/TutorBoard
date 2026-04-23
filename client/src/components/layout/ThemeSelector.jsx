import React from 'react';
import { useTheme } from '../../context/ThemeContext';
import { Sun, Moon, Check } from 'lucide-react';

const ThemeSelector = () => {
  const { themes, currentThemeId, setCurrentThemeId, mode, toggleMode } = useTheme();

  return (
    <div className="w-full space-y-6">
      
      {/* 1. Mode Toggle (Separate from Theme) */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-normal text-[var(--text-secondary)] uppercase tracking-wider">
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

      {/* 2. 4-Column Theme Row */}
      <div className="grid grid-cols-4 gap-2.5">
        {themes.map((theme) => {
          const isSelected = currentThemeId === theme.id;
          const displayColors = theme.colors[mode];

          return (
            <button
              key={theme.id}
              onClick={() => setCurrentThemeId(theme.id)}
              className={`flex flex-col items-center p-2.5 rounded-xl border transition-all text-center relative group ${
                isSelected 
                  ? 'bg-[var(--bg-tertiary)] border-[var(--text-primary)] shadow-md' 
                  : 'bg-transparent border-[var(--border-color)] hover:border-[var(--text-tertiary)]'
              }`}
            >
              <span className={`text-[9px] font-normal mb-2.5 transition-colors leading-tight ${isSelected ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
                {theme.name.split(' & ')[0]}<br/>& {theme.name.split(' & ')[1]}
              </span>

              {/* Color Swatch Strip */}
              <div className="flex gap-1 mt-auto">
                {[
                  displayColors?.bg || '#000', 
                  displayColors?.surface || '#000', 
                  displayColors?.text || '#000', 
                  displayColors?.aiBubble || '#000'
                ].map((color, i) => (
                  <div 
                    key={i} 
                    className="w-2.5 h-2.5 rounded-full border border-black/5 shadow-sm" 
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
