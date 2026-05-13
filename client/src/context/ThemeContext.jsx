import { createContext } from 'react';

/**
 * ThemeContext.jsx
 * 
 * Separated from Provider and Hook exports to ensure pure Fast Refresh compatibility.
 * Contains only the stable named export of the ThemeContext object.
 */
export const ThemeContext = createContext(null);
