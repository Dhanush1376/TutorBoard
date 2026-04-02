import gsap from 'gsap';

/**
 * GSAP Animation Manager for TutorBoard
 * Centralizes common animation patterns and style variations
 */
export const gsapManager = {
  // Common reveal animation
  reveal: (targets, options = {}) => {
    return gsap.from(targets, {
      opacity: 0,
      y: 20,
      duration: 0.8,
      stagger: 0.2,
      ease: 'power3.out',
      ...options
    });
  },

  // Success/Pulse animation
  pulse: (target, options = {}) => {
    return gsap.to(target, {
      scale: 1.05,
      duration: 0.4,
      repeat: 1,
      yoyo: true,
      ease: 'power2.inOut',
      ...options
    });
  },

  // Flow animation for connections
  animateFlow: (target, options = {}) => {
    return gsap.fromTo(target, 
      { strokeDashoffset: 100 }, 
      { strokeDashoffset: 0, duration: 1.5, ease: 'none', repeat: -1, ...options }
    );
  },

  // Style variation maps
  styles: {
    minimal: {
      colors: { primary: '#1c1711', secondary: '#808080', accent: '#d1d1d1' },
      spacing: 40,
      strokeWidth: 1
    },
    educational: {
      colors: { primary: '#2563eb', secondary: '#64748b', accent: '#3b82f6' },
      spacing: 60,
      strokeWidth: 2
    },
    colorful: {
      colors: { primary: '#7c3aed', secondary: '#db2777', accent: '#f59e0b' },
      spacing: 80,
      strokeWidth: 3
    }
  }
};

export default gsapManager;
