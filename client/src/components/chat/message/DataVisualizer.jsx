import React from 'react';
import { List, Sparkles, Activity, Layers, Network, CornerDownRight } from 'lucide-react';

const DataVisualizer = ({ type, data, onLaunchImmersive }) => {
  const isSmall = type === 'array' ? data.length <= 4 : Object.keys(data).length <= 3;
  const isCongested = type === 'array' ? data.length > 8 : Object.keys(data).length > 6;

  if (type === 'array') {
    return (
      <div className={`flex flex-col gap-3.5 ${isSmall ? 'p-3' : 'p-4'}`}>
        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-2 shrink-0">
            <List size={11} className="opacity-30" />
            <span className="text-[9px] font-bold uppercase tracking-[0.15em] opacity-40">Array · {data.length}</span>
          </div>
          <button 
            onClick={() => onLaunchImmersive?.(type, data)}
            className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest opacity-30 hover:opacity-100 transition-all hover:translate-x-0.5"
          >
            <Sparkles size={11} /> 
            <span>Visualize</span>
          </button>
        </div>
        
        {isCongested ? (
          <div className="py-8 px-6 rounded-[24px] border border-dashed border-white/10 bg-white/[0.02] flex flex-col items-center text-center gap-4">
            <Activity size={24} className="text-[var(--info)] opacity-40" />
            <div className="flex flex-col gap-1">
              <p className="text-[13px] font-semibold text-white/90">Dataset is large</p>
              <p className="text-[11px] text-white/40 max-w-[220px]">This array contains {data.length} elements. Launch the canvas for the full interactive view.</p>
            </div>
            <button 
              onClick={() => onLaunchImmersive?.(type, data)}
              className="mt-1 px-5 py-2 rounded-xl bg-[var(--info)] text-[var(--bg-primary)] text-[10px] font-bold uppercase tracking-widest hover:brightness-110 transition-all shadow-lg"
            >
              Launch Visualizer
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3 overflow-x-auto no-scrollbar pb-1 pt-1 px-1">
            {data.slice(0, 15).map((item, idx) => (
              <div key={idx} className="flex flex-col items-center gap-2 group/node shrink-0">
                <span className="text-[8px] font-bold opacity-20 uppercase tracking-widest">{idx}</span>
                <div 
                  className="w-11 h-11 rounded-full border flex items-center justify-center transition-all group-hover/node:border-[var(--theme-color)]/50 group-hover/node:scale-110 shadow-sm"
                  style={{ 
                    background: 'rgba(var(--text-primary-rgb), 0.05)', 
                    borderColor: 'rgba(var(--text-primary-rgb), 0.1)',
                    color: 'var(--text-primary)',
                    fontSize: '14px',
                    fontWeight: 700,
                    fontFamily: 'var(--font-mono)'
                  }}
                >
                  {String(item)}
                </div>
              </div>
            ))}
            {data.length > 15 && <span className="text-[12px] opacity-20 font-mono self-center px-2">...</span>}
          </div>
        )}
      </div>
    );
  }

  if (type === 'object') {
    return (
      <div className={`flex flex-col gap-4 ${isSmall ? 'p-3.5' : 'p-5'}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-[var(--text-primary)]/5 border border-[var(--text-primary)]/10 shrink-0">
            <Layers size={11} className="opacity-40" />
            <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">Object · {Object.keys(data).length}</span>
          </div>
          <button 
            onClick={() => onLaunchImmersive?.(type, data)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--info)]/10 text-[var(--info)] hover:bg-[var(--info)]/20 transition-all hover:scale-105 active:scale-95"
          >
            <Sparkles size={11} /> 
            <span className="text-[10px] font-bold uppercase tracking-widest">Visualize</span>
          </button>
        </div>

        {isCongested ? (
          <div className="py-8 px-6 rounded-[24px] border border-dashed border-white/10 bg-white/[0.02] flex flex-col items-center text-center gap-4">
            <Network size={24} className="text-[var(--info)] opacity-40" />
            <div className="flex flex-col gap-1">
              <p className="text-[13px] font-semibold text-white/90">Complex Data Structure</p>
              <p className="text-[11px] text-white/40 max-w-[220px]">This object contains many nested properties. Open the visualizer for a better representation.</p>
            </div>
            <button 
              onClick={() => onLaunchImmersive?.(type, data)}
              className="mt-1 px-5 py-2 rounded-xl bg-[var(--info)] text-[var(--bg-primary)] text-[10px] font-bold uppercase tracking-widest hover:brightness-110 transition-all shadow-lg"
            >
              Launch Visualizer
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Object.entries(data).map(([key, val], idx) => (
              <div key={idx} className="flex items-center gap-3 p-3 rounded-2xl border bg-white/[0.02] hover:border-[var(--info)]/50 transition-all group/item" style={{ borderColor: 'var(--border-color)' }}>
                <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                  <span className="text-[9px] font-bold opacity-40 uppercase tracking-widest">{key}</span>
                  <span className="text-[13px] font-mono font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{String(val)}</span>
                </div>
                <CornerDownRight size={12} className="opacity-10 group-hover/item:opacity-30 transition-opacity" />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }
  return null;
};

export default DataVisualizer;
