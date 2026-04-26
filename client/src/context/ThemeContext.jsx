import React, { createContext, useContext, useState, useEffect } from 'react';
import { themes } from '../lib/themes';
import useTutorStore from '../store/tutorStore';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [currentThemeId, setCurrentThemeId] = useState(() => {
    return localStorage.getItem('tb-theme') || 'bone-obsidian';
  });
  const [mode, setMode] = useState(() => {
    const saved = localStorage.getItem('tb-mode');
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  const currentTheme = themes.find(t => t.id === currentThemeId) || themes[0];
  const { globalFont, glassIntensity, canvasTone } = useTutorStore();

  useEffect(() => {
    const root = document.documentElement;
    const tokens = currentTheme.colors[mode] || currentTheme.colors['light'] || currentTheme.colors['dark'] || {};
    
    // Safety check for tokens object
    if (!tokens.bg) {
      console.warn('[ThemeContext] Theme tokens are malformed or missing for mode:', mode);
      return; 
    }

    // Helper to convert hex to RGB
    const hexToRgb = (hex) => {
      if (!hex || typeof hex !== 'string') return '0,0,0';
      const cleanHex = hex.replace('#', '');
      if (cleanHex.length !== 6) return '0,0,0';
      const r = parseInt(cleanHex.substring(0, 2), 16);
      const g = parseInt(cleanHex.substring(2, 4), 16);
      const b = parseInt(cleanHex.substring(4, 6), 16);
      return `${r}, ${g}, ${b}`;
    };

    // Inject CSS variables into :root
    const mapping = {
      '--bg-primary': tokens.bg,
      '--bg-primary-rgb': hexToRgb(tokens.bg),
      '--bg-secondary': tokens.surface,
      '--bg-secondary-rgb': hexToRgb(tokens.surface),
      '--bg-tertiary': tokens.surface2,
      '--text-primary': tokens.text,
      '--text-secondary': tokens.textSub,
      '--text-tertiary': tokens.textMuted,
      '--border-color': tokens.border,
      '--user-bubble-text': tokens.userBubbleText,
      '--ai-bubble-bg': tokens.aiBubble,
      '--ai-bubble-text': tokens.aiBubbleText,
      
      // Dynamic Appearance
      '--global-font': '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      '--glass-blur': `${((glassIntensity ?? 80) / 100) * 25}px`,
      '--glass-opacity': `${((glassIntensity ?? 80) / 100) * 0.95}`,
      '--glass-bg': mode === 'light' 
        ? `rgba(255, 255, 255, ${((glassIntensity ?? 80) / 100) * 0.88})` 
        : `rgba(15, 15, 14, ${((glassIntensity ?? 80) / 100) * 0.9})`,
      '--glass-border': mode === 'light' ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.08)',
      '--glass-shadow': mode === 'light' 
        ? '0 12px 48px rgba(0, 0, 0, 0.12), 0 1px 0 rgba(255, 255, 255, 0.95) inset' 
        : '0 16px 64px rgba(0, 0, 0, 0.6), 0 1px 0 rgba(255, 255, 255, 0.06) inset',
      '--canvas-filter': (canvasTone || 'neutral') === 'neutral' ? 'none' : 
                         canvasTone === 'warm' ? 'sepia(0.15) saturate(1.1) brightness(1.02)' : 
                         'hue-rotate(200deg) saturate(0.2) brightness(1.05)', // Cool/Frosty
    };

    try {
      Object.entries(mapping).forEach(([key, value]) => {
        if (value !== undefined) root.style.setProperty(key, value);
      });
    } catch (e) {
      console.error('[ThemeContext] Failed to apply CSS variables:', e);
    }

    // Handle dark mode class for tailwind
    if (mode === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    localStorage.setItem('tb-theme', currentThemeId);
    localStorage.setItem('tb-mode', mode);

  }, [currentThemeId, mode, currentTheme, globalFont, glassIntensity, canvasTone]);

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
