/**
 * NarrativeRenderer v5.0 — High-Fidelity D3 Storytelling
 * 
 * Implements a "Path of Mastery" timeline.
 * Features:
 * - Curved path interpolation
 * - Dynamic camera following
 * - Status-aware node styling
 * - Narrative context integration
 */

import React, { useRef, useEffect, useMemo } from 'react';
import * as d3 from 'd3';
import { motion, AnimatePresence } from 'framer-motion';

const CW = 800;
const CH = 600;

export default function NarrativeRenderer({ 
  timeline, currentStepIndex, 
  elements: extElements, 
  steps: extSteps 
}) {
  const steps = extSteps || timeline?.timeline || timeline?.steps || [];
  const currentStep = steps[currentStepIndex] || {};
  const svgRef = useRef(null);

  // 1. Compute Node Positions (mastery path)
  const nodes = useMemo(() => {
    return steps.map((s, i) => ({
      ...s,
      x: 150 + i * 300, // Wide spacing for storytelling
      y: CH / 2 + (i % 2 === 0 ? -60 : 60), // Sinusoidal flow
      id: s.id || `step-${i}`,
      index: i
    }));
  }, [steps]);

  // 2. Compute Path Links
  const links = useMemo(() => {
    const l = [];
    for (let i = 0; i < nodes.length - 1; i++) {
      l.push({ source: nodes[i], target: nodes[i+1] });
    }
    return l;
  }, [nodes]);

  // 3. D3 Life Cycle
  useEffect(() => {
    if (!svgRef.current || nodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const g = svg.append('g').attr('class', 'mastery-path');

    // Create Gradient for the path
    const defs = svg.append('defs');
    const gradient = defs.append('linearGradient')
      .attr('id', 'path-gradient')
      .attr('x1', '0%').attr('y1', '0%')
      .attr('x2', '100%').attr('y2', '0%');
    
    gradient.append('stop').attr('offset', '0%').attr('stop-color', '#3b82f6');
    gradient.append('stop').attr('offset', '100%').attr('stop-color', '#8b5cf6');

    // Draw the Main Path (Background)
    const lineGenerator = d3.line()
      .x(d => d.x)
      .y(d => d.y)
      .curve(d3.curveCardinal.tension(0.2));

    g.append('path')
      .datum(nodes)
      .attr('d', lineGenerator)
      .attr('fill', 'none')
      .attr('stroke', 'rgba(255,255,255,0.05)')
      .attr('stroke-width', 4);

    // Draw the Progress Path (Animated)
    const progressNodes = nodes.slice(0, currentStepIndex + 1);
    if (progressNodes.length > 1) {
      const progressPath = g.append('path')
        .datum(progressNodes)
        .attr('d', lineGenerator)
        .attr('fill', 'none')
        .attr('stroke', 'url(#path-gradient)')
        .attr('stroke-width', 4)
        .attr('stroke-linecap', 'round');

      const totalLength = progressPath.node().getTotalLength();
      progressPath
        .attr('stroke-dasharray', `${totalLength} ${totalLength}`)
        .attr('stroke-dashoffset', totalLength)
        .transition()
        .duration(1500)
        .ease(d3.easeCubicOut)
        .attr('stroke-dashoffset', 0);
    }

    // Draw Glow Points
    const nodeGroups = g.selectAll('.node-group')
      .data(nodes)
      .enter()
      .append('g')
      .attr('class', 'node-group')
      .attr('transform', d => `translate(${d.x},${d.y})`);

    // Ambient Glow
    nodeGroups.append('circle')
      .attr('r', d => d.index === currentStepIndex ? 25 : 15)
      .attr('fill', d => d.index <= currentStepIndex ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.05)')
      .attr('filter', 'blur(8px)');

    // Inner Point
    nodeGroups.append('circle')
      .attr('r', d => d.index === currentStepIndex ? 10 : 6)
      .attr('fill', d => d.index < currentStepIndex ? '#3b82f6' : d.index === currentStepIndex ? '#fff' : 'rgba(255,255,255,0.2)')
      .attr('stroke', d => d.index === currentStepIndex ? '#3b82f6' : 'none')
      .attr('stroke-width', 4);

    // Labels
    nodeGroups.append('text')
      .attr('dy', d => d.index % 2 === 0 ? -40 : 50)
      .attr('text-anchor', 'middle')
      .attr('fill', d => d.index === currentStepIndex ? '#fff' : 'rgba(255,255,255,0.4)')
      .style('font-size', d => d.index === currentStepIndex ? '14px' : '11px')
      .style('font-weight', d => d.index === currentStepIndex ? 'bold' : 'normal')
      .style('letter-spacing', '1px')
      .text(d => d.title || `Phase ${d.index + 1}`);

    // Camera Focus & Zoom
    const target = nodes[currentStepIndex];
    if (target) {
      const zoom = d3.zoom().on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

      const transform = d3.zoomIdentity
        .translate(CW / 2 - target.x, CH / 2 - target.y)
        .scale(1.1);

      svg.transition()
        .duration(1200)
        .ease(d3.easePolyInOut)
        .call(zoom.transform, transform);
    }

  }, [nodes, currentStepIndex]);

  return (
    <div className="relative w-[800px] h-[600px] overflow-hidden bg-[var(--bg-primary, #0f172a)] rounded-3xl border border-white/10 shadow-2xl">
      {/* Background Ambience */}
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,#1e293b,transparent)]" />
      </div>

      <svg 
        ref={svgRef}
        width="100%" 
        height="100%" 
        viewBox={`0 0 ${CW} ${CH}`}
        className="relative block cursor-grab active:cursor-grabbing"
      />

      {/* Cinematic HUD Overlay */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStepIndex}
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 30 }}
          className="absolute top-10 left-10 p-6 bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl max-w-sm pointer-events-none"
        >
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-[10px] font-normal text-blue-400 uppercase tracking-[0.2em]">Narrative Thread</span>
          </div>
          <h2 className="text-xl font-normal text-white mb-2 leading-tight">
            {currentStep.title || "The Journey Continues"}
          </h2>
          <p className="text-sm text-white/70 leading-relaxed italic">
            "{currentStep.narration || currentStep.explanation || "Observing the flow of logic..."}"
          </p>
        </motion.div>
      </AnimatePresence>

      <div className="absolute bottom-10 right-10 flex items-center space-x-4 opacity-50">
        <span className="text-[10px] font-mono text-white/40">STEP {currentStepIndex + 1} OF {steps.length}</span>
        <div className="w-32 h-[2px] bg-white/10 rounded-full overflow-hidden">
          <motion.div 
            className="h-full bg-blue-500" 
            initial={{ width: 0 }}
            animate={{ width: `${((currentStepIndex + 1) / steps.length) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
