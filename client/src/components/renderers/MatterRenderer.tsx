import React, { useRef, useEffect, useState } from 'react';
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
}

export default function MatterRenderer({ 
  timeline, 
  currentStepIndex 
}: MatterRendererProps) {
  const elements = timeline?.elements || [];
  const connections = timeline?.connections || [];
  const steps = timeline?.timeline || timeline?.steps || [];
  const currentStep = steps[currentStepIndex] || {};

  const sceneRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Matter.Engine | null>(null);
  const runnerRef = useRef<Matter.Runner | null>(null);
  const [renderState, setRenderState] = useState<{ bodies: any[], constraints: any[] }>({ bodies: [], constraints: [] });

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

  // 1.1 Update Gravity dynamically
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.gravity.y = (currentStep.gravity !== undefined) ? currentStep.gravity : 1;
    }
  }, [currentStep.gravity]);

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
        restitution: el.restitution ?? 0.8,
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
      
      setRenderState({
        bodies: world.bodies.filter(b => b.label && !b.isStatic).map(b => ({
          id: b.label,
          x: b.position.x,
          y: b.position.y,
          angle: b.angle,
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
        })
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
            stroke="rgba(59,130,246,0.4)" 
            strokeWidth="2" 
            strokeDasharray="4 4"
          />
        ))}
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
              backgroundColor: `${color}33`,
              borderRadius: isRect ? '12px' : '50%',
              border: `2px solid ${color}`,
              boxShadow: `0 0 20px ${color}33`,
              backdropFilter: 'blur(4px)',
              fontSize: '12px'
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
    </div>
  );
}
