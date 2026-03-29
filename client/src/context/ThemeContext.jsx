import React, { createContext, useContext, useState, useEffect } from 'react';
import { themes } from '../lib/themes';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [currentThemeId, setCurrentThemeId] = useState(() => {
    return localStorage.getItem('tb-theme') || 'ivory-ink';
  });
  const [mode, setMode] = useState(() => {
    return localStorage.getItem('tb-mode') || 'dark';
  });

  const currentTheme = themes.find(t => t.id === currentThemeId) || themes[0];

  useEffect(() => {
    const root = document.documentElement;
    const tokens = currentTheme.colors[mode];

    // Inject CSS variables into :root
    const mapping = {
      '--bg-primary': tokens.bg,
      '--bg-secondary': tokens.surface,
      '--bg-tertiary': tokens.surface2,
      '--text-primary': tokens.text,
      '--text-secondary': tokens.textSub,
      '--text-tertiary': tokens.textMuted,
      '--border-color': tokens.border,
      '--user-bubble-bg': tokens.userBubble,
      '--ai-bubble-bg': tokens.aiBubble,
    };

    Object.entries(mapping).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });

    // Handle dark mode class for tailwind
    if (mode === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    localStorage.setItem('tb-theme', currentThemeId);
    localStorage.setItem('tb-mode', mode);

  }, [currentThemeId, mode, currentTheme]);

  const toggleMode = () => setMode(prev => prev === 'light' ? 'dark' : 'light');

  return (
    <ThemeContext.Provider value={{ 
      themes, 
      currentThemeId, 
      setCurrentThemeId, 
      mode, 
      setMode, 
      toggleMode,
      currentTheme
    }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
