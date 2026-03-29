import React, { useState } from 'react';
import PromptInput from './components/PromptInput';
import Whiteboard from './components/Whiteboard';

function App() {
  const [steps, setSteps] = useState([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGenerate = async (prompt) => {
    setIsLoading(true);
    setError('');
    setSteps([]);
    setCurrentStepIndex(0);

    try {
      const response = await fetch('http://localhost:3001/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate response. Check your API key and server.');
      }

      const data = await response.json();
      if (data.steps && data.steps.length > 0) {
        setSteps(data.steps);
      } else {
        throw new Error('Invalid format received from server.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNext = () => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col py-8 px-4 font-sans">
      <header className="mb-8 text-center">
        <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">
          Tutor<span className="text-blue-600">Board</span>
        </h1>
        <p className="text-gray-500 mt-2 text-lg">AI-Powered Interactive Whiteboard</p>
      </header>

      <main className="flex-1 flex flex-col items-center gap-6 w-full max-w-6xl mx-auto">
        <PromptInput onSubmit={handleGenerate} isLoading={isLoading} />
        
        {error && (
          <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-200">
            {error}
          </div>
        )}

        {steps.length > 0 && (
          <div className="w-full flex justify-between items-center max-w-4xl px-2">
            <button
              onClick={handlePrev}
              disabled={currentStepIndex === 0}
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition font-medium text-gray-700 shadow-sm"
            >
              Previous Step
            </button>
            <span className="text-gray-600 font-medium">
              Step {currentStepIndex + 1} of {steps.length}
            </span>
            <button
              onClick={handleNext}
              disabled={currentStepIndex === steps.length - 1}
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition font-medium text-gray-700 shadow-sm"
            >
              Next Step
            </button>
          </div>
        )}

        <Whiteboard currentStepData={steps.length > 0 ? steps[currentStepIndex] : null} />
      </main>
    </div>
  );
}

export default App;
