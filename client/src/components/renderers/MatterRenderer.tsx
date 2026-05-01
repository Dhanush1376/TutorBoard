import React, { useRef, useEffect, useState, useImperativeHandle, forwardRef } from 'react';
import Matter from 'matter-js';
import { motion, AnimatePresence } from 'framer-motion';

const CW = 800;
const CH = 600;

interface MatterRendererProps {
  timeline: {
    elements?: any[];
    connections?: any[];
    timeline?: any[];
    steps?: any[];
  };
  currentStepIndex: number;
  onRegister?: (instance: any) => void;
}

const MatterRenderer = forwardRef((props: MatterRendererProps, ref) => {
  const { timeline, currentStepIndex, onRegister } = props;

  const elements = timeline?.elements || [];
  const connections = timeline?.connections || [];
  const steps = timeline?.timeline || timeline?.steps || [];
  const currentStep = steps[currentStepIndex] || {};

  const sceneRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Matter.Engine | null>(null);
  const runnerRef = useRef<Matter.Runner | null>(null);
  const trailsRef = useRef<Map<string, { x: number; y: number }[]>>(new Map());
  const [renderState, setRenderState] = useState<{ bodies: any[], constraints: any[], trails: any[] }>({ bodies: [], constraints: [], trails: [] });
  const [globalGravity, setGlobalGravity] = useState<number>(1);
  const [restitutionMult, setRestitutionMult] = useState<number>(1);

  // 1. Initialize Engine & World Bounds
  useEffect(() => {
    const engine = Matter.Engine.create();
    engineRef.current = engine;
    const world = engine.world;
    engine.gravity.y = (currentStep.gravity !== undefined) ? currentStep.gravity : 1; 

    const runner = Matter.Runner.create();
    runnerRef.current = runner;
    Matter.Runner.run(runner, engine);

    // Create World Bounds
    const wallOptions = { isStatic: true, label: 'Wall', friction: 0.5, restitution: 0.5 };
    const ground = Matter.Bodies.rectangle(CW / 2, CH + 25, CW, 50, wallOptions);
    const ceiling = Matter.Bodies.rectangle(CW / 2, -25, CW, 50, wallOptions);
    const leftWall = Matter.Bodies.rectangle(-25, CH / 2, 50, CH, wallOptions);
    const rightWall = Matter.Bodies.rectangle(CW + 25, CH / 2, 50, CH, wallOptions);
    
    Matter.World.add(world, [ground, ceiling, leftWall, rightWall]);

    // Add Mouse Control
    if (sceneRef.current) {
      const mouse = Matter.Mouse.create(sceneRef.current);
      const mouseConstraint = Matter.MouseConstraint.create(engine, {
        mouse: mouse,
        constraint: {
          label: 'Mouse Constraint',
          stiffness: 0.2,
          render: { visible: false }
        }
      });
      Matter.World.add(world, mouseConstraint);
    }

    return () => {
      Matter.Runner.stop(runner);
      Matter.Engine.clear(engine);
      Matter.Composite.clear(world, false);
    };
  }, []);

  useImperativeHandle(ref, () => ({
    addBody: (config: any) => {
      if (!engineRef.current) return;
      const x = (config.x ?? 0.5) * CW;
      const y = (config.y ?? 0.1) * CH;
      const mass = config.mass || 1;
      const body = Matter.Bodies.circle(x, y, 20 * mass, { 
        label: config.id || 'spawned',
        restitution: 0.8 
      });
      Matter.World.add(engineRef.current.world, body);
    },
    applyForce: (id: string, fx: number = 0, fy: number = 0) => {
      if (!engineRef.current) return;
      const body = engineRef.current.world.bodies.find(b => b.label === id);
      if (body) {
        Matter.Body.applyForce(body, body.position, { x: fx * 0.01, y: fy * 0.01 });
      }
    },
    clear: () => {
      if (!engineRef.current) return;
      const world = engineRef.current.world;
      const bodies = world.bodies.filter(b => b.label !== 'Wall');
      Matter.World.remove(world, bodies);
    }
  }));

  useEffect(() => {
    if (onRegister) onRegister(ref);
  }, [onRegister, ref]);

  // 1.1 Update Gravity dynamically
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.gravity.y = ((currentStep.gravity !== undefined) ? currentStep.gravity : 1) * globalGravity;
    }
  }, [currentStep.gravity, globalGravity]);

  // Update Restitution dynamically
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.world.bodies.forEach(b => {
        if (!b.isStatic) {
          b.restitution = 0.8 * restitutionMult;
        }
      });
    }
  }, [restitutionMult]);

  // 2. Sync Elements to Matter Bodies
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const world = engine.world;

    // Remove old non-wall bodies
    const oldBodies = world.bodies.filter(b => b.label !== 'Wall' && !b.isStatic);
    const oldConstraints = world.constraints.filter(c => c.label !== 'Mouse Constraint');
    Matter.World.remove(world, [...oldBodies, ...oldConstraints]);

    const newBodiesMap = new Map();

    const bodies = (elements || []).map(el => {
      const x = (el.x ?? 0.5) * CW;
      const y = (el.y ?? 0.5) * CH;
      const scale = el.scale || 1;
      const type = (el.type || el.shape || 'circle').toLowerCase();
      
      let body;
      const commonOptions = {
        label: el.id,
        isStatic: el.isStatic || false,
        friction: el.friction ?? 0.1,
        restitution: (el.restitution ?? 0.8) * restitutionMult,
        density: el.density ?? 0.001
      };

      if (type.includes('rect') || type.includes('box') || type.includes('block')) {
        const w = (el.w || 0.15) * CW * scale;
        const h = (el.h || 0.1) * CH * scale;
        body = Matter.Bodies.rectangle(x, y, w, h, commonOptions);
      } else {
        const r = (el.r || 0.04) * CW * scale;
        body = Matter.Bodies.circle(x, y, r, commonOptions);
      }

      newBodiesMap.set(el.id, body);
      return body;
    });

    Matter.World.add(world, bodies);

    // Sync Connections to Constraints
    const constraints = (connections || []).map(conn => {
      const bodyA = newBodiesMap.get(conn.from);
      const bodyB = newBodiesMap.get(conn.to);
      if (!bodyA || !bodyB) return null;

      return Matter.Constraint.create({
        bodyA,
        bodyB,
        stiffness: conn.stiffness || 0.1,
        damping: conn.damping || 0.05,
        length: conn.length ? conn.length * CW : Matter.Vector.magnitude(Matter.Vector.sub(bodyA.position, bodyB.position)),
        label: `${conn.from}-${conn.to}`
      });
    }).filter(Boolean) as Matter.Constraint[];

    Matter.World.add(world, constraints);

  }, [elements, connections, currentStepIndex]);

  // 3. Render Loop
  useEffect(() => {
    let frameId: number;
    const update = () => {
      const engine = engineRef.current;
      if (!engine) return;
      const world = engine.world;
      
      // Update Trails
      world.bodies.filter(b => b.label && !b.isStatic).forEach(b => {
        let trail = trailsRef.current.get(b.label);
        if (!trail) {
          trail = [];
          trailsRef.current.set(b.label, trail);
        }
        if (b.speed > 1) {
          trail.push({ x: b.position.x, y: b.position.y });
          if (trail.length > 25) trail.shift(); // Max trail length
        } else if (trail.length > 0) {
          trail.shift();
        }
      });

      setRenderState({
        bodies: world.bodies.filter(b => b.label && !b.isStatic).map(b => ({
          id: b.label,
          x: b.position.x,
          y: b.position.y,
          angle: b.angle,
          velocity: { x: b.velocity.x, y: b.velocity.y },
          speed: b.speed,
          mass: b.mass,
          type: (elements || []).find(e => String(e.id) === String(b.label))?.type || 'circle'
        })),
        constraints: world.constraints.filter(c => c.label !== 'Mouse Constraint').map(c => {
          const p1 = c.bodyA ? { x: c.bodyA.position.x + (c.pointA?.x || 0), y: c.bodyA.position.y + (c.pointA?.y || 0) } : (c.pointA || { x: 0, y: 0 });
          const p2 = c.bodyB ? { x: c.bodyB.position.x + (c.pointB?.x || 0), y: c.bodyB.position.y + (c.pointB?.y || 0) } : (c.pointB || { x: 0, y: 0 });
          
          return {
            id: c.label,
            x1: p1.x,
            y1: p1.y,
            x2: p2.x,
            y2: p2.y
          };
        }),
        trails: Array.from(trailsRef.current.entries()).map(([id, points]) => ({ id, points }))
      });

      frameId = requestAnimationFrame(update);
    };
    update();
    return () => cancelAnimationFrame(frameId);
  }, [elements, currentStepIndex]);

  return (
    <div 
      ref={sceneRef}
      className="relative w-full h-full overflow-hidden bg-[var(--bg-primary)] rounded-3xl border border-white/10 shadow-2xl"
      style={{ cursor: 'crosshair' }}
    >
      {/* Background Grid */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" 
        style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

      <svg className="absolute inset-0 pointer-events-none" width="100%" height="100%" viewBox={`0 0 ${CW} ${CH}`}>
        {renderState.constraints.map(c => (
          <line 
            key={c.id} 
            x1={c.x1} y1={c.y1} x2={c.x2} y2={c.y2} 
            stroke="rgba(59,130,246,0.5)" 
            strokeWidth="3" 
            strokeDasharray="6 6"
            style={{ filter: 'drop-shadow(0 0 6px rgba(59,130,246,0.6))' }}
          />
        ))}
        {/* Render Trails */}
        {renderState.trails.map(t => {
          if (t.points.length < 2) return null;
          const pathData = `M ${t.points.map((p: any) => `${p.x},${p.y}`).join(' L ')}`;
          return (
            <path key={`trail-${t.id}`} d={pathData} fill="none" stroke="rgba(244, 63, 94, 0.4)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 8px rgba(244,63,94,0.6))' }} />
          );
        })}
        {/* Render Velocity Vectors (SaaS Quality Feedback) */}
        {renderState.bodies.map(b => {
          if (b.speed < 0.5) return null;
          const endX = b.x + b.velocity.x * 10;
          const endY = b.y + b.velocity.y * 10;
          return (
            <g key={`vec-${b.id}`}>
              <line x1={b.x} y1={b.y} x2={endX} y2={endY} stroke="#f43f5e" strokeWidth="2" strokeOpacity="0.8" markerEnd="url(#arrow)" />
            </g>
          );
        })}
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#f43f5e" />
          </marker>
        </defs>
      </svg>

      {renderState.bodies.map(b => {
        const el = elements.find(e => e.id === b.id);
        if (!el) return null;
        const color = el.color || '#3b82f6';
        const isRect = (el.type || '').includes('rect') || (el.type || '').includes('box');
        const scale = el.scale || 1;
        const w = (el.w || 0.15) * CW * scale;
        const h = (el.h || 0.1) * CH * scale;
        const r = (el.r || 0.04) * CW * scale;

        return (
          <div 
            key={b.id}
            className="flex items-center justify-center text-white font-medium select-none overflow-hidden"
            style={{
              position: 'absolute',
              left: b.x,
              top: b.y,
              transform: `translate(-50%, -50%) rotate(${b.angle}rad)`,
              width: isRect ? w : r * 2,
              height: isRect ? h : r * 2,
              backgroundColor: `${color}40`,
              borderRadius: isRect ? '12px' : '50%',
              border: `2px solid ${color}cc`,
              boxShadow: `inset 0 0 15px ${color}80, 0 0 25px ${color}66`,
              backdropFilter: 'blur(8px)',
              fontSize: '14px',
              textShadow: '0 2px 4px rgba(0,0,0,0.5)'
            }}
          >
            {el.label || el.id}
          </div>
        );
      })}

      {/* Narrative Overlay */}
      <AnimatePresence>
        {currentStep.narration && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute bottom-8 left-8 right-8 p-6 bg-black/40 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl z-50"
          >
            <div className="flex items-center mb-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse mr-3" />
              <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Physics Insight</span>
            </div>
            <p className="text-sm text-white/90 leading-relaxed italic">"{currentStep.narration}"</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Interactive Control Panel */}
      <div className="absolute top-6 left-6 p-5 bg-black/60 backdrop-blur-xl rounded-2xl border border-white/10 z-50 min-w-[220px] shadow-[0_8px_32px_rgba(0,0,0,0.5)] pointer-events-auto transition-transform hover:scale-[1.02]">
        <div className="flex items-center space-x-2 mb-4">
          <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" />
          <div className="text-[10px] font-bold text-white/70 uppercase tracking-widest">Environment</div>
        </div>
        
        <div className="mb-4">
          <div className="flex justify-between text-xs font-medium text-white/90 mb-2">
            <span>Gravity</span>
            <span className="text-blue-400 font-mono">{globalGravity.toFixed(1)}x</span>
          </div>
          <input type="range" min="-2" max="5" step="0.1" value={globalGravity} onChange={e => setGlobalGravity(parseFloat(e.target.value))} className="w-full accent-blue-500 h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer" />
        </div>
        
        <div>
          <div className="flex justify-between text-xs font-medium text-white/90 mb-2">
            <span>Bounciness</span>
            <span className="text-purple-400 font-mono">{restitutionMult.toFixed(1)}x</span>
          </div>
          <input type="range" min="0" max="2" step="0.1" value={restitutionMult} onChange={e => setRestitutionMult(parseFloat(e.target.value))} className="w-full accent-purple-500 h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer" />
        </div>
      </div>

      {/* Advanced Telemetry Dashboard */}
      <div className="absolute top-6 right-6 p-5 bg-black/60 backdrop-blur-xl rounded-2xl border border-white/10 z-50 min-w-[240px] shadow-[0_8px_32px_rgba(0,0,0,0.5)] pointer-events-none">
        <div className="flex items-center space-x-2 mb-4">
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
          <div className="text-[10px] font-bold text-white/70 uppercase tracking-widest">Live Telemetry</div>
        </div>
        
        <div className="space-y-3">
          {renderState.bodies.slice(0, 4).map(b => {
            const ke = 0.5 * b.mass * (b.speed * b.speed);
            const maxKe = 500; // arbitrary max for bar
            const kePercent = Math.min(100, (ke / maxKe) * 100);
            return (
              <div key={`hud-${b.id}`} className="bg-white/5 rounded-lg p-2 border border-white/5">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-bold text-white/90">{b.id}</span>
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">v: {b.speed.toFixed(1)}</span>
                </div>
                <div className="w-full bg-black/50 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-gradient-to-r from-emerald-500 to-emerald-300 h-1.5 rounded-full transition-all duration-75" style={{ width: `${kePercent}%` }} />
                </div>
                <div className="mt-1 text-[9px] text-right text-white/40 font-mono uppercase tracking-wider">KE: {ke.toFixed(0)} J</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});

export default MatterRenderer;
