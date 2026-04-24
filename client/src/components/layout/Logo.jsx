import React from 'react';

const Logo = ({ size = "md", className = "", animate = false }) => {
  const dimensions = { sm: 28, md: 40, lg: 50, xl: 94 };
  const currentSize = dimensions[size] || dimensions.md;

  return (
    <div className={`inline-flex items-center justify-center shrink-0 ${className}`}>
      <svg 
        width={currentSize} 
        height={currentSize * (260/200)} 
        viewBox="240 60 200 260" 
        xmlns="http://www.w3.org/2000/svg"
        className={animate ? "animate-pulse" : "drop-shadow-sm transition-transform duration-300 hover:scale-105"}
      >
        <polygon points="340,90 427,140 340,190 253,140" fill="currentColor" fillOpacity={animate ? 0.05 : 0.1} />
        <polygon points="253,140 340,190 340,290 253,240" fill="currentColor" fillOpacity={animate ? 0.15 : 0.3} />
        <polygon points="340,190 427,140 427,240 340,290" fill="currentColor" fillOpacity={animate ? 0.25 : 0.5} />
        <polygon points="340,158 376,179 340,200 304,179" fill="currentColor" fillOpacity={animate ? 0.1 : 0.2} />
        <polygon points="304,179 340,200 340,242 304,221" fill="currentColor" fillOpacity={animate ? 0.2 : 0.4} />
        <polygon points="340,200 376,179 376,221 340,242" fill="currentColor" fillOpacity={animate ? 0.4 : 0.8} />
      </svg>
    </div>
  );
};

export default Logo;
