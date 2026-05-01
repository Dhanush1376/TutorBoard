import React from 'react';
import useTutorStore from '../../store/tutorStore';
import { useShallow } from 'zustand/react/shallow';
import { Settings2, FastForward, Play, Pause, Activity } from 'lucide-react';

export default function SimulationHUD() {
  const { 
    playbackSpeed, setPlaybackSpeed,
    isPlaying, isPaused, play, pause 
  } = useTutorStore(useShallow(s => ({
    playbackSpeed: s.playbackSpeed,
    setPlaybackSpeed: s.setPlaybackSpeed,
    isPlaying: s.isPlaying,
    isPaused: s.isPaused,
    play: s.play,
    pause: s.pause
  })));

  const SPEEDS = [0.5, 1, 1.5, 2];

  return (
    <div className="absolute top-6 left-6 z-50 flex flex-col gap-3">
      {/* Playback Controls */}
      <div className="flex items-center bg-black/60 backdrop-blur-md rounded-xl border border-white/10 p-1.5 shadow-2xl">
        <button 
          onClick={isPlaying ? pause : play}
          className="p-2 rounded-lg hover:bg-white/10 text-white transition-colors"
          title={isPlaying ? "Pause Simulation" : "Play Simulation"}
        >
          {isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
        </button>
        
        <div className="w-px h-6 bg-white/10 mx-2" />

        <div className="flex items-center gap-1">
          {SPEEDS.map(speed => (
            <button
              key={speed}
              onClick={() => setPlaybackSpeed(speed)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono transition-all ${
                playbackSpeed === speed 
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' 
                  : 'text-white/60 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              {speed}x
            </button>
          ))}
        </div>
      </div>

      {/* Global Status Pill */}
      <div className="flex items-center gap-2 px-3 py-2 bg-black/40 backdrop-blur-sm rounded-lg border border-white/5 w-max">
        <div className={`w-2 h-2 rounded-full ${isPlaying ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
        <span className="text-[10px] uppercase tracking-widest text-white/70 font-bold">
          {isPlaying ? 'Simulation Active' : 'Simulation Paused'}
        </span>
      </div>
    </div>
  );
}
