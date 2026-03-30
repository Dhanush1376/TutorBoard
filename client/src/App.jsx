import React, { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Auth from './pages/Auth';
import Loader from './components/Loader';

function App() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 4000); // 4 seconds initial loader delay to let logo animation play

    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return (
      <div className="h-screen w-full bg-[var(--bg-primary)] text-[var(--text-primary)] flex overflow-hidden font-sans transition-colors duration-250">
        <Loader autoFade={true} />
      </div>
    );
  }

  // Theme state is now managed globally by ThemeProvider/ThemeContext
  return (
    <div className="h-screen w-full bg-[var(--bg-primary)] text-[var(--text-primary)] flex overflow-hidden font-sans transition-colors duration-250">
      <main className="w-full h-full flex flex-col overflow-hidden animate-fade-in">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/auth" element={<Auth />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
