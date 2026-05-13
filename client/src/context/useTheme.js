import { useContext } from 'react';
import { ThemeContext } from './ThemeContext';

/**
 * useTheme - Hook to access theme state and methods.
 * Isolated to a separate file to ensure Fast Refresh compatibility.
 */
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
