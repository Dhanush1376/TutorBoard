import React from 'react';

const VisaiLogo = ({ className = "", size = "md", showLabel = false }) => {
  const dimensions = {
    xs: 24,
    sm: 28,
    md: 36,
    lg: 48,
    xl: 80
  };

  const currentSize = dimensions[size] || dimensions.md;

  return (
    <div className={`inline-flex flex-col items-center justify-center shrink-0 ${className}`}>
      <svg 
        width={currentSize} 
        height={showLabel ? currentSize * (530/680) : currentSize * (260/200)} 
        viewBox={showLabel ? "0 0 680 530" : "240 60 200 260"} 
        xmlns="http://www.w3.org/2000/svg"
        className="drop-shadow-sm transition-transform duration-300 hover:scale-105"
      >
        {/* Outer cube faces */}
        <polygon points="340,90 427,140 340,190 253,140" fill="currentColor" fillOpacity="0.1" />
        <polygon points="253,140 340,190 340,290 253,240" fill="currentColor" fillOpacity="0.3" />
        <polygon points="340,190 427,140 427,240 340,290" fill="currentColor" fillOpacity="0.5" />

        {/* Inner cube */}
        <polygon points="340,158 376,179 340,200 304,179" fill="currentColor" fillOpacity="0.2" />
        <polygon points="304,179 340,200 340,242 304,221" fill="currentColor" fillOpacity="0.4" />
        <polygon points="340,200 376,179 376,221 340,242" fill="currentColor" fillOpacity="0.8" />

        {/* Optional Label */}
        {showLabel && (
          <text 
            x="340" 
            y="458" 
            textAnchor="middle"
            fontFamily="inherit"
            fontSize="16"   // slightly bigger text
            fontWeight="600" 
            letterSpacing="2"
            fill="currentColor" 
            fillOpacity="0.6"
            className="uppercase"
          >
            Interactive AI Visualization System
          </text>
        )}
      </svg>
    </div>
  );
};

export default VisaiLogo;