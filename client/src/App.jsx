import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home';

function App() {
  // Theme state is now managed globally by ThemeProvider/ThemeContext
  return (
    <div className="h-screen w-full bg-[var(--bg-primary)] text-[var(--text-primary)] flex overflow-hidden font-sans transition-colors duration-250">
      <main className="w-full h-full flex flex-col overflow-hidden">
        <Routes>
          <Route path="/" element={<Home />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
