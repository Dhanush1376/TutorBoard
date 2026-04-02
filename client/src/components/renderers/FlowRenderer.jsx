import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { gsapManager } from '../../utils/gsap-manager';

const FlowRenderer = ({ dsl, style = 'educational' }) => {
  const containerRef = useRef(null);
  const nodesRef = useRef([]);
  const connectionsRef = useRef([]);
  const svgRef = useRef(null);

  const { nodes = [], connections = [] } = dsl || {};
  const currentStyle = gsapManager.styles[style] || gsapManager.styles.educational;

  useEffect(() => {
    if (!nodes.length) return;

    const tl = gsap.timeline();
    
    // Reset positions/opacity for re-animation
    gsap.set(nodesRef.current, { opacity: 0, scale: 0, y: 40 });
    gsap.set(connectionsRef.current, { strokeDasharray: 1000, strokeDashoffset: 1000 });

    tl.to(nodesRef.current, {
      opacity: 1,
      scale: 1,
      y: 0,
      stagger: 0.1,
      duration: 1,
      ease: 'elastic.out(1, 0.75)'
    });

    tl.to(connectionsRef.current, {
        strokeDashoffset: 0,
        duration: 1.2,
        ease: 'power2.inOut',
        stagger: 0.05
    }, "-=0.7");

  }, [nodes]);

  const width = 800;
  const height = 600;
  
  const getPos = (index) => {
      const row = Math.floor(index / 2);
      const col = index % 2;
      const xGap = 300;
      const yGap = 180;
      return {
          x: width / 2 + (col === 0 ? -xGap/2 : xGap/2),
          y: 120 + row * yGap
      };
  };

  const positions = nodes.reduce((acc, node, i) => {
      acc[node.id] = getPos(i);
      return acc;
  }, {});

  return (
    <div ref={containerRef} className="absolute inset-0 w-full h-full flex items-center justify-center pointer-events-none p-10 bg-grid-fine opacity-90">
      <svg ref={svgRef} width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="w-full h-auto max-h-[85vh] drop-shadow-2xl">
        <defs>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={currentStyle.colors.primary} stopOpacity="0.2" />
            <stop offset="50%" stopColor={currentStyle.colors.primary} stopOpacity="0.8" />
            <stop offset="100%" stopColor={currentStyle.colors.primary} stopOpacity="0.2" />
          </linearGradient>
        </defs>

        {/* Connections */}
        <g>
          {connections.map((conn, i) => {
            const start = positions[conn.from];
            const end = positions[conn.to];
            if (!start || !end) return null;

            return (
              <g key={`conn-${i}`}>
                <path
                  ref={el => connectionsRef.current[i] = el}
                  d={`M ${start.x} ${start.y} C ${start.x} ${(start.y + end.y)/2}, ${end.x} ${(start.y + end.y)/2}, ${end.x} ${end.y}`}
                  stroke="url(#lineGrad)"
                  strokeWidth={currentStyle.strokeWidth + 2}
                  fill="none"
                  strokeLinecap="round"
                />
                {conn.label && (
                    <text
                        x={(start.x + end.x) / 2}
                        y={(start.y + end.y) / 2 - 10}
                        textAnchor="middle"
                        className="text-[10px] font-bold uppercase tracking-widest fill-current text-[var(--text-tertiary)]"
                    >
                        {conn.label}
                    </text>
                )}
              </g>
            );
          })}
        </g>

        {/* Nodes */}
        <g>
          {nodes.map((node, i) => {
            const { x, y } = positions[node.id];
            return (
              <g key={node.id} ref={el => nodesRef.current[i] = el} className="pointer-events-auto cursor-pointer group">
                {/* Outer Glow */}
                <circle
                  cx={x}
                  cy={y}
                  r="50"
                  fill="none"
                  stroke={currentStyle.colors.primary}
                  strokeWidth="2"
                  className="opacity-0 group-hover:opacity-20 transition-opacity duration-300"
                  filter="url(#glow)"
                />
                <circle
                  cx={x}
                  cy={y}
                  r="42"
                  fill="var(--bg-secondary)"
                  stroke={currentStyle.colors.primary}
                  strokeWidth={currentStyle.strokeWidth}
                  className="transition-all duration-300 group-hover:r-[45]"
                />
                <text
                  x={x}
                  y={y - 5}
                  textAnchor="middle"
                  className="text-[11px] font-black uppercase tracking-tighter fill-current text-[var(--text-primary)]"
                >
                  {node.label.length > 12 ? node.label.slice(0, 10) + '..' : node.label}
                </text>
                <text
                  x={x}
                  y={y + 12}
                  textAnchor="middle"
                  className="text-[20px] opacity-80"
                >
                  {node.icon || '✦'}
                </text>
                {node.description && (
                   <g className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <rect x={x - 60} y={y + 55} width="120" height="30" rx="8" fill="var(--bg-tertiary)" className="shadow-lg" />
                      <text
                        x={x}
                        y={y + 74}
                        textAnchor="middle"
                        className="text-[9px] fill-current text-[var(--text-secondary)] font-medium"
                      >
                        {node.description.length > 25 ? node.description.slice(0, 22) + '...' : node.description}
                      </text>
                   </g>
                )}
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
};

export default FlowRenderer;
