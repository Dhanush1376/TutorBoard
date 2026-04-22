import React, { useRef, useEffect, useMemo } from 'react';
import * as d3 from 'd3';
import { motion } from 'framer-motion';

const CW = 800;
const CH = 600;

/**
 * D3Renderer v1.0
 * 
 * Production-grade D3 implementation with enter/update/exit lifecycle.
 */
export default function D3Renderer({ timeline, currentStepIndex }) {
  const svgRef = useRef(null);
  const elements = timeline?.elements || [];
  const steps = timeline?.timeline || [];
  const currentStep = steps[currentStepIndex] || {};

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    
    let g = svg.select('g.main-container');
    if (g.empty()) {
      g = svg.append('g').attr('class', 'main-container');
    }

    // ── Data Binding ──
    const nodeSelection = g.selectAll('.d3-node').data(elements, d => d.id);

    // ENTER
    const nodeEnter = nodeSelection.enter()
      .append('g')
      .attr('class', 'd3-node')
      .attr('transform', d => `translate(${(d.x ?? 0.5) * CW}, ${(d.y ?? 0.5) * CH})`)
      .style('opacity', 0);

    nodeEnter.append('circle').attr('r', 20).attr('fill', d => d.color || '#3b82f6');
    nodeEnter.append('text').attr('text-anchor', 'middle').attr('dy', '.35em').attr('fill', '#fff').text(d => d.label || '');

    // UPDATE
    const nodeUpdate = nodeEnter.merge(nodeSelection);
    nodeUpdate.transition().duration(800)
      .attr('transform', d => `translate(${(d.x ?? 0.5) * CW}, ${(d.y ?? 0.5) * CH})`)
      .style('opacity', 1);

    nodeUpdate.select('circle').attr('fill', d => d.color || '#3b82f6');

    // EXIT
    nodeSelection.exit().transition().duration(500).style('opacity', 0).remove();

  }, [elements, currentStepIndex]);

  return (
    <div className="relative w-[800px] h-[600px] bg-[var(--bg-primary)] rounded-xl border border-[var(--border-color)]">
      <svg ref={svgRef} width={CW} height={CH} viewBox={`0 0 ${CW} ${CH}`} />
      
      {/* Overlay Narration */}
      <div className="absolute bottom-6 left-6 right-6 p-4 bg-black/40 backdrop-blur-md rounded-lg border border-white/10">
        <p className="text-sm text-white/90 italic">"{currentStep.narration || 'Visualizing data...'}"</p>
      </div>
    </div>
  );
}
