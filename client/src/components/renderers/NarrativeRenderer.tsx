import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { motion, AnimatePresence } from 'framer-motion';

interface NarrativeRendererProps {
  timeline: {
    title?: string;
    topic?: string;
    elements?: any[];
    timeline?: any[];
    steps?: any[];
  };
  currentStepIndex: number;
}

export default function NarrativeRenderer({ timeline, currentStepIndex }: NarrativeRendererProps) {
  const steps = timeline?.timeline || timeline?.steps || [];
  const currentStep = steps[currentStepIndex] || {};

  // NEW: Prioritize VisualScript 'timeline' commands over legacy 'steps'
  const timelineCommands = (currentStep.actions || []).filter((a: any) => a.cmd === 'timeline' || a.type === 'timeline');
  const displaySteps = timelineCommands.length > 0 ? timelineCommands : steps;
  const activeStep = displaySteps[currentStepIndex] || displaySteps[0] || {};
  
  const d3Container = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!d3Container.current || displaySteps.length === 0) return;

    const svg = d3.select(d3Container.current);
    svg.selectAll("*").remove();

    const width = 800;
    const height = 400;
    const margin = { top: 50, right: 100, bottom: 50, left: 100 };

    const x = d3.scaleLinear()
      .domain([0, Math.max(1, displaySteps.length - 1)])
      .range([margin.left, width - margin.right]);

    // Draw Main Axis Line
    svg.append("line")
      .attr("x1", margin.left)
      .attr("y1", height / 2)
      .attr("x2", width - margin.right)
      .attr("y2", height / 2)
      .attr("stroke", "rgba(255,255,255,0.1)")
      .attr("stroke-width", 2);

    // Draw Progress Line
    svg.append("line")
      .attr("x1", margin.left)
      .attr("y1", height / 2)
      .attr("x2", x(currentStepIndex))
      .attr("y2", height / 2)
      .attr("stroke", "#3b82f6")
      .attr("stroke-width", 3)
      .attr("stroke-linecap", "round");

    // Draw Event Markers
    const markers = svg.selectAll(".marker")
      .data(displaySteps)
      .enter()
      .append("g")
      .attr("class", "marker")
      .attr("transform", (d, i) => `translate(${x(i)}, ${height / 2})`);

    markers.append("circle")
      .attr("r", (d, i) => i <= currentStepIndex ? 6 : 4)
      .attr("fill", (d, i) => i === currentStepIndex ? "#3b82f6" : i < currentStepIndex ? "rgba(59, 130, 246, 0.5)" : "rgba(255,255,255,0.1)")
      .attr("stroke", (d, i) => i === currentStepIndex ? "rgba(59,130,246,0.3)" : "none")
      .attr("stroke-width", 10);

    // Add Date/Title Labels for markers
    markers.append("text")
      .attr("y", (d, i) => i % 2 === 0 ? -25 : 35)
      .attr("text-anchor", "middle")
      .attr("fill", (d, i) => i <= currentStepIndex ? "white" : "rgba(255,255,255,0.2)")
      .attr("font-size", "10px")
      .attr("font-weight", (d, i) => i === currentStepIndex ? "600" : "400")
      .text((d: any) => d.label || d.date || `Event ${displaySteps.indexOf(d) + 1}`);

  }, [displaySteps, currentStepIndex]);

  return (
    <div className="relative w-full h-full flex flex-col bg-[var(--bg-primary)] p-8 rounded-3xl border border-white/10 shadow-2xl overflow-hidden">
      {/* Background Decor */}
      <div className="absolute inset-0 opacity-[0.02] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />
      
      {/* Subject Header */}
      <div className="mb-12">
        <h2 className="text-3xl font-bold text-white tracking-tight mb-2">
          {timeline.title || "Historical Narrative"}
        </h2>
        <div className="flex items-center space-x-2">
          <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 text-[10px] font-bold uppercase tracking-wider border border-blue-500/20">
            Timeline Mode
          </span>
          <span className="text-white/30 text-[10px]">///</span>
          <span className="text-white/50 text-[10px] font-mono">{timeline.topic}</span>
        </div>
      </div>

      {/* D3 Timeline Visual */}
      <div className="flex-1 flex items-center justify-center">
        <svg 
          ref={d3Container} 
          width="800" 
          height="400" 
          viewBox="0 0 800 400"
          className="w-full h-full"
        />
      </div>

      {/* Current Event Detail Card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStepIndex}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="p-8 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-xl shadow-2xl"
        >
          <div className="flex justify-between items-start mb-4">
            <div>
              <h4 className="text-blue-400 text-xs font-bold uppercase tracking-[0.2em] mb-1">Current Focus</h4>
              <h3 className="text-xl font-semibold text-white">{activeStep.label || activeStep.title || "Key Event"}</h3>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-mono text-white/30 uppercase">Temporal Index</span>
              <p className="text-lg font-bold text-white/50">{currentStepIndex + 1} / {displaySteps.length}</p>
            </div>
          </div>
          <p className="text-lg text-white/80 leading-relaxed font-light">
            {activeStep.narration || activeStep.explanation || activeStep.text || currentStep.narration || currentStep.explanation}
          </p>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
