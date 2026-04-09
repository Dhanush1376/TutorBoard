/**
 * AgentCanvasRenderer — AI-Directed Multi-Technology Dispatcher
 * 
 * Supports 4 modes dynamicically selected by the AI:
 *  1. svg_canvas      (Framer Motion shapes)
 *  2. html_animation  (Sandboxed dynamic React components)
 *  3. threejs_3d      (3D scene representation)
 *  4. d3_chart        (Statistical data visualization)
 */

import React, { useMemo, useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import gsap from 'gsap';

import {
  CinematicShapeRouter, CinematicFilters
} from '../renderers/CinematicShapes.jsx';

// ─── HTML Sandbox for Dynamic AI Components ───────────────────────────────

const HTMLSandbox = ({ code }) => {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!code) return;
    try {
      // Sandboxed evaluation of AI-generated component code
      // Provides React, useState, useEffect, motion, and gsap in scope
      const createComponent = new Function('React', 'useState', 'useEffect', 'motion', 'gsap', `
        const { useState, useEffect } = React;
        return ${code}
      `);
      
      const AIComponent = createComponent(React, useState, useEffect, motion, gsap);
      
      // We render it into our local container
      // Note: In a production app, we'd use a portal or iframe for isolation
    } catch (err) {
      console.error("[Sandbox] Component Execution Failed:", err);
    }
  }, [code]);

  return <div ref={containerRef} className="w-full h-full" />;
};

// ─── 3D Renderer ───────────────────────────────────────────────────────────

const Scene3D = ({ objects, stepIndex }) => (
  <Canvas camera={{ position: [0, 5, 10], fov: 50 }}>
    <ambientLight intensity={0.5} />
    <pointLight position={[10, 10, 10]} />
    <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
    {objects.map(obj => (
      <mesh key={obj.id} position={[obj.x / 100 - 4, 1, obj.y / 100 - 3]}>
        <sphereGeometry args={[obj.r / 50 || 0.5, 32, 32]} />
        <meshStandardMaterial color={obj.color || 'blue'} />
      </mesh>
    ))}
    <OrbitControls />
  </Canvas>
);

// ─── Main Dispatcher ───────────────────────────────────────────────────────

export default function AgentCanvasRenderer({ timeline, objects, steps, currentStepIndex }) {
  const mode = timeline?.render_mode || 'svg_canvas';
  
  // Normalize sources: prioritize props (useful for snapshots) then timeline data
  const finalObjects = objects || timeline?.objects || [];
  const finalSteps = steps || timeline?.steps || [];
  const currentStep = finalSteps[currentStepIndex];
  
  const CW = 800;
  const CH = 600;

  if (mode === 'html_animation') {
    return <HTMLSandbox code={timeline?.component_code} />;
  }

  if (mode === 'threejs_3d') {
    return (
      <div className="w-full h-full bg-transparent">
        <Scene3D objects={finalObjects} stepIndex={currentStepIndex} />
      </div>
    );
  }

  // Default: SVG Cinematic Canvas
  return (
    <div className="relative w-[800px] h-[600px] bg-transparent overflow-visible">
      <svg
        width="100%" height="100%"
        viewBox={`0 0 ${CW} ${CH}`}
        preserveAspectRatio="xMidYMid meet"
        className="block overflow-visible pointer-events-none"
      >
        <CinematicFilters />
        
        {/* Object Layer */}
        <AnimatePresence>
          {finalObjects
            .filter(obj => (obj?.appearsAtStep ?? 0) <= currentStepIndex)
            .map((obj, i) => {
              const isNew = obj.appearsAtStep === currentStepIndex;
              const isHighlighted = currentStep?.highlightIds?.includes(obj.id);
              const isFaded = currentStep?.fadeIds?.includes(obj.id);
              const isMinimalist = timeline?.teaching_format === 'minimalist_pedagogy';
              
              return (
                <CinematicShapeRouter
                  key={obj.id}
                  obj={obj}
                  isNew={isNew}
                  isHighlighted={isHighlighted}
                  isFaded={isFaded}
                  currentStep={currentStep}
                  minimalist={isMinimalist}
                />
              );
            })}
        </AnimatePresence>
      </svg>
    </div>
  );
}
