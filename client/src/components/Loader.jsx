import React from 'react';

const Loader = ({ fullScreen = true, autoFade = false, glass = false, className = "" }) => {
  return (
    <div 
      className={`flex flex-col items-center justify-center 
        ${fullScreen ? "h-screen w-full" : "w-full py-8"} 
        ${glass ? "fixed inset-0 z-[999] backdrop-blur-2xl bg-[var(--bg-primary)]/45" : "bg-[var(--bg-primary)]"}
        ${autoFade ? "loader-fade" : ""} 
        ${className}`}
    >
      <div className="logo-wrap w-[min(480px,90vw)] max-w-sm">
        <svg width="100%" viewBox="0 0 680 530" xmlns="http://www.w3.org/2000/svg" className="loader-svg">
          {/* Outer silhouette */}
          <polyline className="wire"
            style={{ strokeDasharray: 680, '--len': 680, '--d': '0s' }}
            points="340,90 427,140 427,240 340,290 253,240 253,140 340,90"
            fill="none" strokeWidth="0.8" />
          
          <line className="wire" style={{ strokeDasharray: 105, '--len': 105, '--d': '0.15s' }} x1="340" y1="90" x2="340" y2="190" strokeWidth="0.6" />
          <line className="wire" style={{ strokeDasharray: 96, '--len': 96, '--d': '0.3s' }} x1="253" y1="140" x2="340" y2="190" strokeWidth="0.6" />
          <line className="wire" style={{ strokeDasharray: 96, '--len': 96, '--d': '0.45s' }} x1="427" y1="140" x2="340" y2="190" strokeWidth="0.6" />
          <line className="wire" style={{ strokeDasharray: 105, '--len': 105, '--d': '0.6s' }} x1="340" y1="190" x2="340" y2="290" strokeWidth="0.6" />

          {/* Plates Assemble */}
          <polygon className="plate-top" points="340,90 427,140 340,190 253,140" />
          <polygon className="plate-left" points="253,140 340,190 340,290 253,240" />
          <polygon className="plate-right" points="340,190 427,140 427,240 340,290" />

          {/* Inner Cube */}
          <polygon className="ic-top" points="340,158 376,179 340,200 304,179" />
          <polygon className="ic-left" points="304,179 340,200 340,242 304,221" />
          <polygon className="ic-right" points="340,200 376,179 376,221 340,242" />

          {/* Text */}
          <text className="loader-text wordmark" x="340" y="358" textAnchor="middle">TUTORBOARD</text>
          <circle className="loader-text dot-sep" cx="340" cy="380" r="2.2" />
          <text className="loader-text tagline" x="340" y="406" textAnchor="middle">VISUALIZE · UNDERSTAND · LEARN</text>
          <text className="loader-text sublabel" x="340" y="458" textAnchor="middle">Interactive AI Visualization System</text>
        </svg>
      </div>
    </div>
  );
};

export default Loader;
