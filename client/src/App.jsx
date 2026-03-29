import React, { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import { Moon, Sun } from 'lucide-react';

function App() {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] transition-colors duration-200 flex flex-col font-sans">
      {/* Top Navbar - Minimal and Clean */}
      <header className="sticky top-0 z-50 w-full bg-[var(--bg-primary)]/80 backdrop-blur-md border-b border-[var(--border-color)] px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[var(--text-primary)] flex items-center justify-center text-[var(--bg-primary)] font-semibold text-lg">
            T
          </div>
          <h1 className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">
            TutorBoard
          </h1>
        </div>

        <button
          onClick={() => setIsDark(!isDark)}
          className="p-2 rounded-full hover:bg-[var(--accent)] transition-colors duration-200 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          aria-label="Toggle Theme"
        >
          {isDark ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </header>

      {/* Main Content Areas via Routing */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<div className="text-center mt-20 text-[var(--text-secondary)]">About TutorBoard</div>} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
