import { useState, useEffect } from 'react';

/**
 * Hook to track window size with debounced updates
 * Returns current dimensions and a pre-calculated isMobile flag
 */
export default function useWindowSize() {
  const [windowSize, setWindowSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 0,
    isMobile: typeof window !== 'undefined' ? window.innerWidth < 768 : false,
    isTablet: typeof window !== 'undefined' ? window.innerWidth >= 768 && window.innerWidth <= 1024 : false,
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let timeoutId = null;

    const handleResize = () => {
      // Debounce logic
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        const w = window.innerWidth;
        setWindowSize({
          width: w,
          height: window.innerHeight,
          isMobile: w < 768,
          isTablet: w >= 768 && w <= 1024,
        });
      }, 150); // 150ms debounce
    };

    window.addEventListener('resize', handleResize);
    
    // Initial call to ensure accuracy on mount
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timeoutId);
    };
  }, []);

  return windowSize;
}
