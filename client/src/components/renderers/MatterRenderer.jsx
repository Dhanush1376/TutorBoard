/**
 * MatterRenderer v4.0 — High-Performance Physics Visualization Engine
 * 
 * Replaces the stub PhysicsRenderer with a real Matter.js engine.
 * Handles gravity, collisions, and constrained motion for educational visuals.
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
  const elements = extElements || timeline?.elements || [];
  const steps = extSteps || timeline?.timeline || timeline?.steps || [];
  const currentStep = steps[currentStepIndex] || {};

  const sceneRef = useRef(null);
  const engineRef = useRef(Matter.Engine.create());
  const renderRef = useRef(null);
  const runnerRef = useRef(null);
  const [bodies, setBodies] = useState([]);

  // 1. Initialize Engine
  useEffect(() => {
    const engine = engineRef.current;
    engine.gravity.y = 0; // Default to zero-G for most educational diagrams

    const runner = Matter.Runner.create();
    runnerRef.current = runner;
    Matter.Runner.run(runner, engine);

    return () => {
      Matter.Runner.stop(runner);
      Matter.Engine.clear(engine);
    };
  }, []);

  // 2. Synchronize Elements to Matter Bodies
  useEffect(() => {
    const engine = engineRef.current;
    const world = engine.world;

    // Clear existing bodies
    Matter.World.clear(world);

    const newBodies = elements.map(el => {
      const x = (el.x ?? 0.5) * CW;
      const y = (el.y ?? 0.5) * CH;
      const scale = el.scale || 1;
      
      let body;
      const type = (el.type || el.shape || 'circle').toLowerCase();

      if (type.includes('rect') || type.includes('block') || type.includes('box')) {
        const w = (el.w || 0.2) * CW * scale;
        const h = (el.h || 0.1) * CH * scale;
        body = Matter.Bodies.rectangle(x, y, w, h, {
          label: el.id,
          id: el.id, // String ID as extra prop
          isStatic: el.isStatic || false,
          friction: 0.1,
          restitution: 0.8
        });
      } else {
        const r = (el.r || 0.05) * CW * scale;
        body = Matter.Bodies.circle(x, y, r, {
          label: el.id,
          id: el.id,
          isStatic: el.isStatic || false,
          friction: 0.1,
          restitution: 0.8
        });
      }

      // Physics logic for specific types
      if (type === 'planet' || type === 'orbit') {
        body.isStatic = false;
        // Gravity logic handled in tick
      }

      return body;
    });

    Matter.World.add(world, newBodies);
    
    // Add ground if needed
    const ground = Matter.Bodies.rectangle(CW / 2, CH + 50, CW, 100, { isStatic: true });
    Matter.World.add(world, ground);

    setBodies(newBodies);
  }, [elements]);

  // 3. Animation Loop Sync
  const [renderState, setRenderState] = useState([]);
  useEffect(() => {
    let frameId;
    const update = () => {
      const engine = engineRef.current;
      
      // Apply custom forces for orbits/waves
      bodies.forEach(body => {
        const el = elements.find(e => e.id === body.id || e.id === body.label);
        if (!el) return;

        const type = (el.type || el.shape || '').toLowerCase();
        
        if (type === 'planet' || type === 'orbit') {
          const sunPos = { x: CW / 2, y: CH / 2 };
          const dist = Matter.Vector.magnitude(Matter.Vector.sub(sunPos, body.position));
          const force = Matter.Vector.mult(Matter.Vector.normalise(Matter.Vector.sub(sunPos, body.position)), 0.0005 * body.mass);
          Matter.Body.applyForce(body, body.position, force);
        }

        if (type === 'wave') {
          const t = performance.now() / 1000;
          const yOffset = Math.sin(t * 5 + body.position.x * 0.05) * 2;
          Matter.Body.translate(body, { x: 0, y: yOffset });
        }
      });

      setRenderState(bodies.map(b => ({
        id: b.id || b.label,
        x: b.position.x,
        y: b.position.y,
        angle: b.angle
      })));

      frameId = requestAnimationFrame(update);
    };

    update();
    return () => cancelAnimationFrame(frameId);
  }, [bodies, elements]);

  // 4. Viewport Logic
  const { camera } = useMemo(() => {
    const cam = currentStep.cameraFocus || { x: 0.5, y: 0.5, zoom: 1 };
    return { camera: cam };
  }, [currentStep]);

  const Z = Math.min(2.0, Math.max(0.5, camera.zoom || 1));
  const tx = CW / 2 - (camera.x || 0.5) * CW * Z;
  const ty = CH / 2 - (camera.y || 0.5) * CH * Z;

  return (
    <div className="relative w-[800px] h-[600px] overflow-hidden bg-[var(--bg-primary)] rounded-xl border border-[var(--border-color)]">
      <motion.div 
        className="absolute inset-0 origin-top-left"
        animate={{ x: tx, y: ty, scale: Z }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      >
        {renderState.map(rs => {
          const el = elements.find(e => e.id === rs.id);
          if (!el) return null;

          const type = (el.type || el.shape || 'circle').toLowerCase();
          const isBlock = type.includes('rect') || type.includes('block') || type.includes('box');
          const scale = el.scale || 1;
          const w = (el.w || 0.2) * CW * scale;
          const h = (el.h || 0.1) * CH * scale;
          const r = (el.r || 0.05) * CW * scale;

          return (
            <div 
              key={rs.id}
              style={{
                position: 'absolute',
                left: rs.x,
                top: rs.y,
                transform: `translate(-50%, -50%) rotate(${rs.angle}rad)`,
                width: isBlock ? w : r * 2,
                height: isBlock ? h : r * 2,
                backgroundColor: el.color || '#3b82f6',
                borderRadius: isBlock ? '8px' : '50%',
                boxShadow: `0 0 20px ${el.color || '#3b82f6'}44`,
                border: '2px solid rgba(255,255,255,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '10px',
                fontWeight: 'bold',
                textAlign: 'center'
              }}
            >
              {el.label}
            </div>
          );
        })}
      </motion.div>
    </div>
  );
}
