import React from 'react';
import { Play, Pause, SkipBack, SkipForward, Gauge } from 'lucide-react';

const StepController = ({ 
  isPlaying, 
  onPlayPause, 
  onPrev, 
  onNext, 
  canPrev, 
  canNext, 
  speed, 
  onSpeedChange 
}) => {
  const speeds = [0.5, 1, 1.5, 2];

  return (
    <div className="flex items-center gap-1 bg-[var(--bg-secondary)]/90 backdrop-blur-2xl border border-[var(--border-color)] rounded-2xl px-2 py-1.5 shadow-2xl">
      
      {/* Prev */}
      <button
        onClick={onPrev}
        disabled={!canPrev}
        className="p-2 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] disabled:opacity-20 disabled:cursor-not-allowed transition-all"
      >
        <SkipBack size={16} />
      </button>

      {/* Play / Pause */}
      <button
        onClick={onPlayPause}
        className="p-2.5 rounded-xl bg-[var(--text-primary)] text-[var(--bg-primary)] hover:opacity-90 transition-all shadow-lg"
      >
        {isPlaying ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
      </button>

      {/* Next */}
      <button
        onClick={onNext}
        disabled={!canNext}
        className="p-2 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] disabled:opacity-20 disabled:cursor-not-allowed transition-all"
      >
        <SkipForward size={16} />
      </button>

      {/* Divider */}
      <div className="w-px h-5 bg-[var(--border-color)] mx-1" />

      {/* Speed Selector */}
      <div className="flex items-center gap-1">
        <Gauge size={12} className="text-[var(--text-tertiary)]" />
        {speeds.map((s) => (
          <button
            key={s}
            onClick={() => onSpeedChange(s)}
            className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${
              speed === s 
                ? 'bg-[var(--text-primary)] text-[var(--bg-primary)]' 
                : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
            }`}
          >
            {s}x
          </button>
        ))}
      </div>
    </div>
  );
};

export default StepController;
