import React from 'react';

const Logo = ({ size = "md", className = "", animate = false }) => {
  const dimensions = {
    sm: { width: 24, height: 28 },
    md: { width: 34, height: 40 },
    lg: { width: 42, height: 50 },
    xl: { width: 80, height: 94 }
  };

  const { width, height } = dimensions[size] || dimensions.md;

  return (
    <div className={`inline-flex items-center justify-center shrink-0 ${className}`}>
      <svg 
        width={width} 
        height={height} 
        viewBox="250 85 180 210" 
        xmlns="http://www.w3.org/2000/svg" 
        className={animate ? "loader-svg" : ""}
        style={{ overflow: 'visible' }}
      >
        {/* Outer Wire — Thinner and matching the brand weight */}
        <polyline 
          className={animate ? "wire" : ""} 
          points="340,90 427,140 427,240 340,290 253,240 253,140 340,90" 
          fill="currentColor" 
          fillOpacity="0.05"
          stroke="currentColor" 
          strokeWidth="8"
          strokeLinejoin="round"
          style={animate ? { strokeDasharray: 680, '--len': 680, '--d': '0s' } : { opacity: 1 }}
        />
        
        {/* Core structure — Solid for visual weight */}
        <polygon 
          className={animate ? "plate-top" : ""} 
          points="340,90 427,140 340,190 253,140" 
          fill="currentColor" 
          fillOpacity={animate ? 0 : 0.4} 
        />
        <polygon 
          className={animate ? "plate-left" : ""} 
          points="253,140 340,190 340,290 253,240" 
          fill="currentColor" 
          fillOpacity={animate ? 0 : 0.3} 
        />
        <polygon 
          className={animate ? "plate-right" : ""} 
          points="340,190 427,140 427,240 340,290" 
          fill="currentColor" 
          fillOpacity={animate ? 0 : 0.35} 
        />
        
        {/* Inner IC — The core mark */}
        <polygon 
          className={animate ? "ic-top" : ""} 
          points="340,158 376,179 340,200 304,179" 
          fill="currentColor" 
          fillOpacity={animate ? 0 : 1} 
        />
        <polygon 
          className={animate ? "ic-left" : ""} 
          points="304,179 340,200 340,242 304,221" 
          fill="currentColor" 
          fillOpacity={animate ? 0 : 0.9} 
        />
        <polygon 
          className={animate ? "ic-right" : ""} 
          points="340,200 376,179 376,221 340,242" 
          fill="currentColor" 
          fillOpacity={animate ? 0 : 0.9} 
        />
      </svg>
    </div>
  );
};

export default Logo;
