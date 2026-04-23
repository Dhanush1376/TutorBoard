/**
 * MatterRenderer v5.0 — Premium Physics Visualization Engine
 * 
 * High-fidelity Matter.js implementation with:
 * - Real-time physics simulation (gravity, friction, restitution)
 * - Interactive Mouse Constraints (drag and toss objects)
 * - Link/Spring rendering for connections
 * - Aesthetic Glow Orbs and Glass Blocks
 * - Bounded World (Invisible walls)
 */

import React, { useRef, useEffect, useState, useMemo } from 'react';
import Matter from 'matter-js';
import { motion, AnimatePresence } from 'framer-motion';

const CW = 800;
const CH = 600;

export default function MatterRenderer({ 
  timeline, currentStepIndex, 
  elements: extElements, 
  connections: extConnections, 
  steps: extSteps 
}) {
  const elements = extElements || timeline?.elements || timeline?.objects || [];
  const connections = extConnections || timeline?.connections || [];
  const steps = extSteps || timeline?.timeline || timeline?.steps || [];
  const currentStep = steps[currentStepIndex] || {};

  const sceneRef = useRef(null);
  const engineRef = useRef(Matter.Engine.create());
  const runnerRef = useRef(null);
  const [renderState, setRenderState] = useState({ bodies: [], constraints: [] });

  // 1. Initialize Engine & World Bounds
  useEffect(() => {
    const engine = engineRef.current;
    const world = engine.world;
    engine.gravity.y = (currentStep.gravity !== undefined) ? currentStep.gravity : 1; 

    const runner = Matter.Runner.create();
    runnerRef.current = runner;
    Matter.Runner.run(runner, engine);

    // Create World Bounds
    const wallOptions = { isStatic: true, render: { visible: false }, friction: 0.5, restitution: 0.5 };
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
          stiffness: 0.2,
          render: { visible: false }
        }
      });
      Matter.World.add(world, mouseConstraint);
    }

    return () => {
      Matter.Runner.stop(runner);
      Matter.Engine.clear(engine);
      Matter.World.clear(world);
    };
  }, []);

  // 2. Sync Elements to Matter Bodies
  useEffect(() => {
    const engine = engineRef.current;
    const world = engine.world;

    // Remove old non-wall bodies
    const oldBodies = world.bodies.filter(b => b.label !== 'Rectangle Body' && !b.isStatic);
    const oldConstraints = world.constraints.filter(c => c.label !== 'Mouse Constraint');
    Matter.World.remove(world, [...oldBodies, ...oldConstraints]);

    const newBodiesMap = new Map();

    const bodies = elements.map(el => {
      const x = (el.x ?? 0.5) * CW;
      const y = (el.y ?? 0.5) * CH;
      const scale = el.scale || 1;
      const type = (el.type || el.shape || 'circle').toLowerCase();
      
      let body;
      const commonOptions = {
        label: el.id,
        id: el.id,
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
    const constraints = connections.map(conn => {
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
    }).filter(Boolean);

    Matter.World.add(world, constraints);

  }, [elements, connections]);

  // 3. Render Loop
  useEffect(() => {
    let frameId;
    const update = () => {
      const world = engineRef.current.world;
      
      setRenderState({
        bodies: world.bodies.filter(b => b.id !== undefined && !b.isStatic).map(b => ({
          id: b.label,
          x: b.position.x,
          y: b.position.y,
          angle: b.angle,
          type: elements.find(e => e.id === b.label)?.type || 'circle'
        })),
        constraints: world.constraints.filter(c => c.label !== 'Mouse Constraint').map(c => ({
          id: c.label,
          x1: c.bodyA.position.x + (c.pointA?.x || 0),
          y1: c.bodyA.position.y + (c.pointA?.y || 0),
          x2: c.bodyB.position.x + (c.pointB?.x || 0),
          y2: c.bodyB.position.y + (c.pointB?.y || 0)
        }))
      });

      frameId = requestAnimationFrame(update);
    };
    update();
    return () => cancelAnimationFrame(frameId);
  }, [elements]);

  return (
    <div 
      ref={sceneRef}
      className="relative w-[800px] h-[600px] overflow-hidden bg-[var(--bg-primary)] rounded-3xl border border-white/10 shadow-2xl"
      style={{ cursor: 'crosshair' }}
    >
      {/* Background Grid */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" 
        style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

      <svg className="absolute inset-0 pointer-events-none" width={CW} height={CH}>
        {renderState.constraints.map(c => (
          <line 
            key={c.id} 
            x1={c.x1} y1={c.y1} x2={c.x2} y2={c.y2} 
            stroke="rgba(255,255,255,0.2)" 
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
            style={{
              position: 'absolute',
              left: b.x,
              top: b.y,
              transform: `translate(-50%, -50%) rotate(${b.angle}rad)`,
              width: isRect ? w : r * 2,
              height: isRect ? h : r * 2,
              backgroundColor: `${color}33`,
              borderRadius: isRect ? '8px' : '50%',
              border: `2px solid ${color}`,
              boxShadow: `0 0 15px ${color}44`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: '11px',
              fontWeight: 400,
              userSelect: 'none'
            }}
          >
            {el.label}
          </div>
        );
      })}

      {/* Narrative Overlay */}
      <AnimatePresence>
        {currentStep.narration && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute bottom-6 left-6 right-6 p-4 bg-black/40 backdrop-blur-md rounded-2xl border border-white/10"
          >
            <p className="text-sm text-white/90 italic text-center">"{currentStep.narration}"</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
