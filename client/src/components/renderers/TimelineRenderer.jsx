import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { gsapManager } from '../../utils/gsap-manager';

gsap.registerPlugin(ScrollTrigger);

const TimelineRenderer = ({ dsl, style = 'educational' }) => {
  const containerRef = useRef(null);
  const itemsRef = useRef([]);
  const lineRef = useRef(null);
  const dotRefs = useRef([]);

  const { timeline = [] } = dsl || {};
  const currentStyle = gsapManager.styles[style] || gsapManager.styles.educational;

  useEffect(() => {
    if (!timeline.length) return;

    gsap.set(itemsRef.current, { opacity: 0, x: (i) => i % 2 === 0 ? -50 : 50 });
    gsap.set(dotRefs.current, { scale: 0, opacity: 0 });
    
    const tl = gsap.timeline();

    tl.from(lineRef.current, {
        scaleY: 0,
        transformOrigin: "top",
        duration: 1.5,
        ease: 'power4.inOut'
    });

    timeline.forEach((_, i) => {
        ScrollTrigger.create({
            trigger: itemsRef.current[i],
            start: "top 85%",
            onEnter: () => {
                gsap.to(itemsRef.current[i], { opacity: 1, x: 0, duration: 0.8, ease: 'power3.out' });
                gsap.to(dotRefs.current[i], { scale: 1, opacity: 1, duration: 0.5, ease: 'back.out(2)' });
            },
            once: true
        });
    });

    return () => ScrollTrigger.getAll().forEach(st => st.kill());
  }, [timeline]);

  return (
    <div ref={containerRef} className="absolute inset-0 w-full h-full flex flex-col items-center pointer-events-none p-10 overflow-y-auto no-scrollbar bg-grid-fine opacity-80">
      <div className="relative flex flex-col items-center w-full max-w-3xl py-32 min-h-screen">
        
        {/* Main Vertical Axis */}
        <div 
          ref={lineRef}
          className="absolute h-full w-[1.5px] opacity-10"
          style={{ backgroundColor: currentStyle.colors.primary, left: '50%' }}
        />

        {timeline.map((item, i) => (
          <div 
            key={`timeline-${i}`}
            className={`relative flex items-center w-full mb-24 ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}
          >
            {/* Timeline Dot with Glow */}
            <div 
                ref={el => dotRefs.current[i] = el}
                className="absolute w-6 h-6 rounded-full shadow-2xl z-20 flex items-center justify-center"
                style={{ 
                    backgroundColor: currentStyle.colors.primary, 
                    left: '50%', 
                    transform: 'translateX(-50%)',
                    boxShadow: `0 0 20px ${currentStyle.colors.primary}40`
                }}
            >
                <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
            </div>

            {/* Event Content Card */}
            <div 
                ref={el => itemsRef.current[i] = el}
                className={`w-[44%] pointer-events-auto group cursor-pointer ${i % 2 === 0 ? 'text-right pr-12' : 'text-left pl-12'}`}
            >
              <div 
                className="bg-[var(--bg-secondary)]/60 backdrop-blur-3xl border border-[var(--border-color)] p-8 rounded-[2rem] shadow-xl transition-all duration-500 group-hover:bg-[var(--bg-tertiary)] group-hover:scale-[1.02] group-hover:shadow-2xl"
              >
                <div className={`flex items-center gap-3 mb-4 ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
                    <span 
                        className="text-[10px] font-black tracking-[0.2em] uppercase px-3 py-1 rounded-full border border-[var(--border-color)] text-[var(--text-tertiary)]"
                    >
                        {item.time}
                    </span>
                </div>
                <h4 className="text-2xl font-serif italic text-[var(--text-primary)] mb-3 leading-tight tracking-tight">
                    {item.event}
                </h4>
                <p className="text-[14px] text-[var(--text-secondary)] leading-relaxed font-medium opacity-85">
                    {item.description}
                </p>
                
                {/* Decorative Accent */}
                <div 
                    className={`h-0.5 mt-6 w-0 group-hover:w-full transition-all duration-700 rounded-full`}
                    style={{ backgroundColor: currentStyle.colors.primary }}
                />
              </div>
            </div>

          </div>
        ))}

        <div className="h-20 w-full" /> {/* Bottom Spacing */}
      </div>
    </div>
  );
};

export default TimelineRenderer;
