import React, { useState, useLayoutEffect, useMemo } from 'react';
import { themes } from '../lib/themes';
import useTutorStore from '../store/tutorStore';
import { ThemeContext } from './ThemeContext';

/**
 * ThemeProvider - Global provider for application themes.
 * Only exports the component to maintain Fast Refresh compatibility.
 */
export const ThemeProvider = ({ children }) => {
  const [currentThemeId, setCurrentThemeId] = useState(() => {
    return localStorage.getItem('tb-theme') || 'bone-obsidian';
  });
  
  // Entire application is permanently locked to dark theme
  const mode = 'dark';
  const setMode = () => {};

  const currentTheme = useMemo(() => 
    themes.find(t => t.id === currentThemeId) || themes[0],
    [currentThemeId]
  );

  const globalFont = useTutorStore(state => state.globalFont);
  const glassIntensity = useTutorStore(state => state.glassIntensity);
  const canvasTone = useTutorStore(state => state.canvasTone);

  useLayoutEffect(() => {
    const root = document.documentElement;
    const tokens = currentTheme.colors['dark'] || {};
    
    if (!tokens.bg) {
      console.warn('[ThemeContext] Theme tokens are malformed or missing for dark theme');
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
      '--user-bubble-bg': tokens.userBubble,
      '--user-bubble-text': tokens.userBubbleText,
      '--ai-bubble-bg': tokens.aiBubble,
      '--ai-bubble-text': tokens.aiBubbleText,

      // Theme-specific text selection
      '--selection-bg': `rgba(${hexToRgb(tokens.text)}, 0.22)`,
      '--selection-text': tokens.text,
      
      // Session / Stage theme surfaces
      '--st-surface': tokens.surface,
      '--st-line': 'rgba(249, 246, 229, 0.07)',
      '--st-line-strong': tokens.border || 'rgba(249, 246, 229, 0.13)',
      
      // Dynamic Appearance
      '--global-font': '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      '--glass-blur': `${((glassIntensity ?? 80) / 100) * 25}px`,
      '--glass-opacity': `${((glassIntensity ?? 80) / 100) * 0.95}`,
      '--glass-bg': `rgba(15, 15, 14, ${((glassIntensity ?? 80) / 100) * 0.9})`,
      '--glass-border': 'rgba(255, 255, 255, 0.08)',
      '--glass-shadow': '0 16px 64px rgba(0, 0, 0, 0.6), 0 1px 0 rgba(255, 255, 255, 0.06) inset',
      '--canvas-filter': (canvasTone || 'neutral') === 'neutral' ? 'none' : 
                         canvasTone === 'warm' ? 'sepia(0.15) saturate(1.1) brightness(1.02)' : 
                         'hue-rotate(200deg) saturate(0.2) brightness(1.05)',
    };

    try {
      Object.entries(mapping).forEach(([key, value]) => {
        if (value !== undefined) root.style.setProperty(key, value);
      });
    } catch (e) {
      console.error('[ThemeContext] Failed to apply CSS variables:', e);
    }

    // Always keep dark class on document element
    root.classList.add('dark');

    localStorage.setItem('tb-theme', currentThemeId);
    localStorage.setItem('tb-mode', 'dark');

  }, [currentThemeId, currentTheme, glassIntensity, canvasTone]);

  const value = useMemo(() => ({
    themes, 
    currentThemeId, 
    setCurrentThemeId, 
    mode: 'dark', 
    setMode, 
    toggleMode: () => {},
    currentTheme
  }), [currentThemeId, currentTheme]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};
