import React, { useRef, useEffect, useMemo } from 'react';
import * as d3 from 'd3';
import { motion, AnimatePresence } from 'framer-motion';

const CW = 800;
const CH = 600;

/**
 * D3Renderer v2.0 — Production Data Visualization Engine
 * 
 * Supports: circles, rects, bars, lines, connections, arrays, trees.
 * Full enter/update/exit lifecycle with step-aware highlighting.
 */
export default function D3Renderer({ timeline, currentStepIndex }) {
  const svgRef = useRef(null);
  const elements = timeline?.elements || timeline?.objects || [];
  const connections = timeline?.connections || [];
  const steps = timeline?.timeline || timeline?.steps || [];
  const currentStep = steps[currentStepIndex] || {};
  const highlightIds = new Set(currentStep.highlight || currentStep.highlightIds || []);
  const fadeIds = new Set(currentStep.fade || currentStep.fadeIds || []);
  const stepObjectIds = new Set(currentStep.objectIds || currentStep.elements || []);

  // Filter visible elements for this step
  const visibleElements = useMemo(() => {
    if (stepObjectIds.size === 0) return elements;
    return elements.filter(el => stepObjectIds.has(el.id));
  }, [elements, stepObjectIds]);

  // Camera
  const camera = useMemo(() => {
    const cf = currentStep.cameraFocus || {};
    return {
      x: (cf.x ?? 0.5) * CW,
      y: (cf.y ?? 0.5) * CH,
      zoom: Math.min(2, Math.max(0.5, cf.zoom ?? 1))
    };
  }, [currentStep]);

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);

    let g = svg.select('g.d3-main');
    if (g.empty()) {
      g = svg.append('g').attr('class', 'd3-main');
    }

    // ─── Camera Transform ───
    const Z = camera.zoom;
    const tx = CW / 2 - camera.x * Z;
    const ty = CH / 2 - camera.y * Z;

    g.transition().duration(800).ease(d3.easeCubicOut)
      .attr('transform', `translate(${tx},${ty}) scale(${Z})`);

    // ─── Connections (Links) ───
    const linkSel = g.selectAll('.d3-link').data(connections, d => `${d.from}-${d.to}`);

    linkSel.exit().transition().duration(400).style('opacity', 0).remove();

    const linkEnter = linkSel.enter().append('g').attr('class', 'd3-link').style('opacity', 0);

    linkEnter.append('line')
      .attr('stroke', 'rgba(148,163,184,0.4)')
      .attr('stroke-width', 2);

    linkEnter.append('text')
      .attr('fill', 'rgba(148,163,184,0.6)')
      .attr('font-size', 10)
      .attr('text-anchor', 'middle');

    const linkUpdate = linkEnter.merge(linkSel);
    linkUpdate.transition().duration(600).style('opacity', 1);

    linkUpdate.each(function(d) {
      const fromEl = elements.find(e => e.id === d.from);
      const toEl = elements.find(e => e.id === d.to);
      if (!fromEl || !toEl) return;

      const x1 = (fromEl.x ?? 0.5) * CW;
      const y1 = (fromEl.y ?? 0.5) * CH;
      const x2 = (toEl.x ?? 0.5) * CW;
      const y2 = (toEl.y ?? 0.5) * CH;

      const group = d3.select(this);
      group.select('line')
        .transition().duration(600)
        .attr('x1', x1).attr('y1', y1)
        .attr('x2', x2).attr('y2', y2);

      group.select('text')
        .attr('x', (x1 + x2) / 2)
        .attr('y', (y1 + y2) / 2 - 8)
        .text(d.label || '');
    });

    // ─── Elements (Nodes) ───
    const nodeSel = g.selectAll('.d3-node').data(visibleElements, d => d.id);

    // EXIT
    nodeSel.exit().transition().duration(400)
      .style('opacity', 0)
      .attr('transform', d => `translate(${(d.x ?? 0.5) * CW}, ${(d.y ?? 0.5) * CH}) scale(0.5)`)
      .remove();

    // ENTER
    const nodeEnter = nodeSel.enter()
      .append('g')
      .attr('class', 'd3-node')
      .attr('data-element-id', d => d.id)
      .attr('transform', d => `translate(${(d.x ?? 0.5) * CW}, ${(d.y ?? 0.5) * CH})`)
      .style('opacity', 0);

    // UPDATE
    const nodeUpdate = nodeEnter.merge(nodeSel);
    nodeUpdate.transition().duration(600).ease(d3.easeCubicOut)
      .attr('transform', d => `translate(${(d.x ?? 0.5) * CW}, ${(d.y ?? 0.5) * CH})`)
      .style('opacity', d => fadeIds.has(d.id) ? 0.2 : 1);

    // Render/Update shape based on type
    nodeUpdate.each(function(d) {
      const group = d3.select(this);
      const type = (d.type || d.shape || 'circle').toLowerCase();
      const color = d.color || '#3b82f6';
      
      // Clear previous shapes to allow type-switching/content-refreshing
      group.selectAll(':not(text.d3-label)').remove();

      if (type === 'array') {
        const values = d.values || [];
        const cellW = 40, cellH = 36;
        const totalW = values.length * cellW;
        values.forEach((val, i) => {
          const cx = i * cellW - totalW / 2 + cellW / 2;
          group.append('rect')
            .attr('x', cx - cellW / 2 + 1).attr('y', -cellH / 2 + 1)
            .attr('width', cellW - 2).attr('height', cellH - 2)
            .attr('rx', 4)
            .attr('fill', 'rgba(30,41,59,0.9)')
            .attr('stroke', color).attr('stroke-width', 1.5);
          group.append('text')
            .attr('x', cx).attr('y', 0)
            .attr('text-anchor', 'middle').attr('dominant-baseline', 'central')
            .attr('fill', '#f8fafc').attr('font-size', 12).attr('font-weight', 900)
            .attr('font-family', 'monospace')
            .text(val);
        });
      } else if (type === 'pointer') {
        // A classic algorithm pointer (e.g. "i", "j", "head")
        const s = (d.scale || 1) * 20;
        group.append('path')
          .attr('d', `M0,${-s} L${s/2},0 L${-s/2},0 Z`)
          .attr('fill', color)
          .attr('stroke', '#fff').attr('stroke-width', 1);
        group.append('text')
          .attr('y', 15).attr('text-anchor', 'middle')
          .attr('fill', color).attr('font-size', 14).attr('font-weight', 800)
          .text(d.label || '');
      } else if (type === 'comparator') {
        // A visual for A < B or similar
        const w = 80, h = 40;
        group.append('rect')
          .attr('x', -w/2).attr('y', -h/2).attr('width', w).attr('height', h).attr('rx', 20)
          .attr('fill', 'rgba(15,23,42,0.9)').attr('stroke', color).attr('stroke-width', 2);
        group.append('text')
          .attr('text-anchor', 'middle').attr('dominant-baseline', 'central')
          .attr('fill', '#fff').attr('font-size', 14).attr('font-weight', 700)
          .text(d.value || d.label || '?');
      } else if (type === 'tree_node' || type === 'circle') {
        const r = (d.scale || 1) * 20;
        group.append('circle')
          .attr('r', r)
          .attr('fill', 'rgba(30,41,59,0.9)')
          .attr('stroke', color).attr('stroke-width', 2);
        group.append('text')
          .attr('text-anchor', 'middle').attr('dominant-baseline', 'central')
          .attr('fill', '#fff').attr('font-size', 12).attr('font-weight', 700)
          .text(d.value || '');
      } else if (type.includes('rect') || type === 'bar') {
        const w = (d.w || 0.1) * CW;
        const h = (d.h || 0.08) * CH;
        group.append('rect')
          .attr('x', -w/2).attr('y', -h/2).attr('width', w).attr('height', h).attr('rx', 6)
          .attr('fill', color + '33').attr('stroke', color).attr('stroke-width', 2);
      }

      // Re-append label if not already handled by specialized types
      if (d.label && type !== 'pointer') {
        group.append('text')
          .attr('class', 'd3-label')
          .attr('y', (d.scale || 1) * 30)
          .attr('text-anchor', 'middle')
          .attr('fill', '#94a3b8').attr('font-size', 11).attr('font-weight', 600)
          .text(d.label);
      }
    });

    // Highlight pulse
    nodeUpdate.each(function(d) {
      const group = d3.select(this);
      if (highlightIds.has(d.id)) {
        group.style('filter', 'brightness(1.3) saturate(1.2) drop-shadow(0 0 12px rgba(59,130,246,0.5))');
      } else {
        group.style('filter', 'none');
      }
    });

  }, [visibleElements, connections, currentStepIndex, camera, highlightIds, fadeIds]);

  return (
    <div className="relative w-[800px] h-[600px] overflow-hidden bg-[var(--bg-primary,#0f172a)] rounded-3xl border border-white/10 shadow-2xl">
      {/* Background Ambience */}
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <div className="absolute top-0 left-1/3 w-[50%] h-[50%] bg-[radial-gradient(circle,#3b82f6,transparent_70%)] blur-[80px]" />
        <div className="absolute bottom-0 right-1/4 w-[40%] h-[40%] bg-[radial-gradient(circle,#8b5cf6,transparent_70%)] blur-[80px]" />
      </div>

      <svg ref={svgRef} width={CW} height={CH} viewBox={`0 0 ${CW} ${CH}`} className="relative block" />

      {/* Cinematic Narration Bar */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStepIndex}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
          className="absolute bottom-6 left-6 right-6 p-5 bg-black/50 backdrop-blur-xl rounded-2xl border border-white/10"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-[9px] font-normal text-blue-400 uppercase tracking-[0.2em]">
              {currentStep.title || 'Data Visualization'}
            </span>
          </div>
          <p className="text-sm text-white/80 leading-relaxed italic">
            "{currentStep.narration || currentStep.explanation || 'Analyzing the data structure...'}"
          </p>
        </motion.div>
      </AnimatePresence>

      {/* Step Counter */}
      <div className="absolute top-5 right-5 flex items-center gap-3 opacity-40">
        <span className="text-[10px] font-mono text-white/50">STEP {currentStepIndex + 1} / {steps.length}</span>
      </div>
    </div>
  );
}
