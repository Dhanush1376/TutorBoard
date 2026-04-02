import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { gsapManager } from '../../utils/gsap-manager';

const DiagramRenderer = ({ dsl, style = 'educational' }) => {
  const containerRef = useRef(null);
  const partRefs = useRef([]);
  const labelRefs = useRef([]);

  const { nodes = [], sections = [] } = dsl || {};
  const currentStyle = gsapManager.styles[style] || gsapManager.styles.educational;

  const displayItems = nodes.length > 0 ? nodes : sections;

  useEffect(() => {
    if (!displayItems.length) return;

    gsap.set(partRefs.current, { opacity: 0, scale: 0.8, y: 20 });
    gsap.set(labelRefs.current, { opacity: 0, y: 10 });

    const tl = gsap.timeline();
    tl.to(partRefs.current, {
      opacity: 1,
      scale: 1,
      y: 0,
      stagger: 0.1,
      duration: 0.8,
      ease: 'back.out(1.7)'
    });

    tl.to(labelRefs.current, {
        opacity:1,
        y: 0,
        stagger: 0.1,
        duration: 0.5,
        ease: 'power2.out'
    }, "-=0.4");

  }, [displayItems]);

  return (
    <div ref={containerRef} className="absolute inset-0 w-full h-full flex items-center justify-center pointer-events-none p-10 bg-grid-fine opacity-80">
      <div className="relative w-full max-w-5xl h-full flex flex-wrap items-center justify-center gap-10 overflow-y-auto no-scrollbar py-20">
        
        {displayItems.map((item, i) => (
          <div 
            key={item.id || i}
            className="flex flex-col items-center gap-6 pointer-events-auto group cursor-pointer"
          >
            {/* Visual Part Representation */}
            <div 
              ref={el => partRefs.current[i] = el}
              className="relative w-44 h-44 rounded-[2.5rem] border shadow-[0_20px_50px_rgba(0,0,0,0.05)] transition-all duration-500 group-hover:scale-105 group-hover:shadow-[0_30px_60px_rgba(0,0,0,0.1)] group-hover:border-current"
              style={{ 
                  backgroundColor: 'var(--bg-secondary)',
                  borderColor: 'var(--border-color)',
                  color: currentStyle.colors.primary
              }}
            >
                <div className="absolute inset-2 flex items-center justify-center text-5xl bg-[var(--bg-primary)] rounded-[2rem] border border-[var(--border-subtle)] shadow-inner">
                     {item.icon || '✦'}
                </div>
                
                {/* Glow Ring */}
                <div className="absolute inset-0 rounded-[2.5rem] opacity-0 group-hover:opacity-20 transition-opacity duration-500" 
                     style={{ boxShadow: `0 0 30px ${currentStyle.colors.primary}` }} />
            </div>

            {/* Label & Description */}
            <div 
              ref={el => labelRefs.current[i] = el}
              className="text-center max-w-[180px]"
            >
              <h4 className="text-sm font-black tracking-[0.2em] uppercase text-[var(--text-primary)] mb-2 group-hover:text-current transition-colors">
                {item.label}
              </h4>
              <p className="text-[11px] text-[var(--text-tertiary)] italic leading-relaxed font-medium">
                {item.description}
              </p>
            </div>
          </div>
        ))}

      </div>
    </div>
  );
};

export default DiagramRenderer;
