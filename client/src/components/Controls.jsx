import React from 'react';
import { Play, Pause, RotateCcw, FastForward } from 'lucide-react';
import { cn } from '../lib/utils';

const Controls = ({ isPlaying, onPlayPause, onReset, speed, onSpeedChange }) => {
  return (
    <div className="flex flex-col gap-3 p-3 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-2xl w-[60px] items-center transition-all duration-200 shadow-sm">
      {/* Play/Pause Button */}
      <button
        onClick={onPlayPause}
        className="p-2.5 rounded-xl bg-[var(--text-primary)] text-[var(--bg-primary)] hover:opacity-90 transition-all duration-200 active:scale-95"
        title={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
      </button>

      {/* Reset Button */}
      <button
        onClick={onReset}
        className="p-2.5 rounded-xl text-[var(--text-secondary)] hover:bg-[var(--accent)] hover:text-[var(--text-primary)] transition-all duration-200"
        title="Reset Board"
      >
        <RotateCcw size={18} />
      </button>

      <div className="w-8 h-[1px] bg-[var(--border-color)] my-1" />

      {/* Speed Control */}
      <div className="flex flex-col items-center gap-1 group relative">
        <button
          onClick={onSpeedChange}
          className="p-2.5 rounded-xl text-[var(--text-secondary)] hover:bg-[var(--accent)] hover:text-[var(--text-primary)] transition-all duration-200"
          title="Speed"
        >
          <FastForward size={18} />
        </button>
        <span className="text-[10px] font-medium text-[var(--text-secondary)]">
          {speed}x
        </span>
      </div>
    </div>
  );
};

export default Controls;
