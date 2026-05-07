import React from 'react';
import ParticleWaves from '../canvas/ParticleWaves';

/**
 * IntroAnimation Component
 * Renders a full-screen cinematic SVG animation as the first point of entry.
 * Leverages animations and theme-aware colors defined in index.css.
 */
const IntroAnimation = () => {
  return (
    <div 
      className="fixed inset-0 z-[2000] flex items-center justify-center overflow-hidden select-none loader-fade"
      style={{ backgroundColor: 'transparent' }}
    >
      {/* Base Background Layer */}
      <div 
        className="absolute inset-0 bg-[var(--bg-primary)]" 
        style={{ zIndex: -1 }}
      />
      
      {/* Particle Waves Animation */}
      <ParticleWaves opacity={0.6} />

      <div className="w-[min(480px,90vw)]" style={{ position: 'relative', zIndex: 1 }}>
        <svg 
          width="100%" 
          viewBox="0 0 680 530" 
          xmlns="http://www.w3.org/2000/svg" 
          className="loader-svg"
          style={{ overflow: 'visible' }}
        >
          {/* PHASE 1: WIREFRAME lines draw (0–1s) */}
          <polyline 
            className="wire"
            style={{ '--len': 680, '--d': '0s' }}
            points="340,90 427,140 427,240 340,290 253,240 253,140 340,90"
            fill="none" 
            strokeWidth="0.8"
            strokeDasharray="680" 
            opacity="0.0"
          />

          <line className="wire" style={{ '--len': 105, '--d': '0.15s' }}
            x1="340" y1="90" x2="340" y2="190"
            strokeWidth="0.6"
            strokeDasharray="105" opacity="0.0"
          />

          <line className="wire" style={{ '--len': 96, '--d': '0.3s' }}
            x1="253" y1="140" x2="340" y2="190"
            strokeWidth="0.6"
            strokeDasharray="96" opacity="0.0"
          />

          <line className="wire" style={{ '--len': 96, '--d': '0.45s' }}
            x1="427" y1="140" x2="340" y2="190"
            strokeWidth="0.6"
            strokeDasharray="96" opacity="0.0"
          />

          <line className="wire" style={{ '--len': 105, '--d': '0.6s' }}
            x1="340" y1="190" x2="340" y2="290"
            strokeWidth="0.6"
            strokeDasharray="105" opacity="0.0"
          />

          {/* PHASE 2: PLATES ASSEMBLE (1.0s – 2.1s) */}
          <polygon 
            className="plate-top"
            points="340,90 427,140 340,190 253,140"
            opacity="0"
          />

          <polygon 
            className="plate-left"
            points="253,140 340,190 340,290 253,240"
            opacity="0"
          />

          <polygon 
            className="plate-right"
            points="340,190 427,140 427,240 340,290"
            opacity="0"
          />

          {/* PHASE 3: INNER CUBE assembles (2.1s – 2.9s) */}
          <polygon 
            className="ic-top"
            points="340,158 376,179 340,200 304,179"
            opacity="0"
          />
          <polygon 
            className="ic-left"
            points="304,179 340,200 340,242 304,221"
            opacity="0"
          />
          <polygon 
            className="ic-right"
            points="340,200 376,179 376,221 340,242"
            opacity="0"
          />

          {/* PHASE 5: TEXT (3.0s – 4s) */}
          <text 
            className="wordmark"
            x="340" y="358" textAnchor="middle"
            fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
            opacity="0"
          >
            TUTORBOARD
          </text>

          <circle className="dot-sep" cx="340" cy="380" r="2.2" opacity="0" />

          <text 
            className="tagline"
            x="340" y="406" textAnchor="middle"
            fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
            opacity="0"
          >
            VISUALIZE · UNDERSTAND · LEARN
          </text>

          <text 
            className="sublabel"
            x="340" y="458" textAnchor="middle"
            fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
            opacity="0"
          >
            Interactive AI Visualization System
          </text>

        </svg>
      </div>
    </div>
  );
};

export default IntroAnimation;
