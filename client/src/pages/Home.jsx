import React, { useState, useEffect } from 'react';
import Board from '../components/Board';
import InputBox from '../components/InputBox';
import Controls from '../components/Controls';

const Home = () => {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [steps, setSteps] = useState([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!prompt.trim()) return;
    
    setIsGenerating(true);
    setError('');
    setSteps([]);
    setCurrentStep(0);
    setIsPlaying(false);
    
    try {
      const response = await fetch('http://localhost:3001/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate. Please check your API key and server connection.');
      }

      const data = await response.json();
      if (data.steps && data.steps.length > 0) {
        setSteps(data.steps);
      } else {
        throw new Error('AI returned an unexpected format.');
      }
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleReset = () => {
    setSteps([]);
    setIsGenerating(false);
    setIsPlaying(false);
    setPrompt('');
    setError('');
    setCurrentStep(0);
  };

  const handleNext = () => {
    setCurrentStep(prev => prev < steps.length - 1 ? prev + 1 : prev);
  };

  const handlePrev = () => {
    setCurrentStep(prev => prev > 0 ? prev - 1 : prev);
  };

  const handleSpeedChange = () => {
    setSpeed(prev => prev === 1 ? 1.5 : prev === 1.5 ? 2 : 1);
  };

  // Playback Engine Hook
  useEffect(() => {
    let interval;
    if (isPlaying) {
      const displayDuration = 2500 / speed; // Dynamic duration based on speed
      
      interval = setInterval(() => {
        setCurrentStep((prev) => {
          if (prev >= steps.length - 1) {
            setIsPlaying(false); // Stop when hitting the end
            return prev;
          }
          return prev + 1;
        });
      }, displayDuration);
    }
    return () => clearInterval(interval);
  }, [isPlaying, speed, steps.length]);

  return (
    <div className="flex-1 w-full flex flex-col relative animate-in fade-in duration-300">
      
      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm rounded-xl text-center">
          {error}
        </div>
      )}

      {/* Main Board Area */}
      <div className="flex-1 w-full flex relative z-10 mb-6 mt-2">
        <Board 
          isGenerating={isGenerating} 
          stepData={steps.length > 0 ? steps[currentStep] : null} 
          currentStep={currentStep}
          totalSteps={steps.length}
        />
        
        {/* Navigation Controls */}
        <div className={`absolute left-[-16px] xl:left-[-24px] top-1/2 -translate-y-1/2 -translate-x-full transition-all duration-300 ${steps.length > 0 && !isGenerating ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
          <div className="flex flex-col gap-2">
            <Controls 
              isPlaying={isPlaying} 
              onPlayPause={() => setIsPlaying(!isPlaying)}
              onReset={handleReset}
              speed={speed}
              onSpeedChange={handleSpeedChange}
            />
            
            {/* Simple Step Nav */}
            <div className="flex flex-col gap-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] p-2 rounded-2xl shadow-sm">
              <button 
                onClick={handlePrev} 
                className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-[var(--accent)] disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                disabled={currentStep === 0}
              >
                ←
              </button>
              <button 
                onClick={handleNext} 
                className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-[var(--accent)] disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                disabled={currentStep === steps.length - 1}
              >
                →
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Input Area */}
      <div className="w-full z-20 mt-auto bg-[var(--bg-primary)] pb-4 pt-2">
        <InputBox 
          value={prompt}
          onChange={setPrompt}
          onSubmit={handleSubmit}
          isGenerating={isGenerating}
        />
      </div>
    </div>
  );
};

export default Home;
