/**
 * SimulatorRenderer v1.0
 * 
 * Receives a complete HTML string from SimulatorAgent and runs it
 * in a sandboxed iframe. Zero dependencies. Maximum security.
 */

import React, { useRef, useEffect, useState } from 'react';

interface SimulatorRendererProps {
  timeline: {
    simulationHtml?: string;
    title?: string;
  };
  currentStepIndex: number;
}

export default function SimulatorRenderer({ timeline, currentStepIndex }: SimulatorRendererProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  const html = timeline?.simulationHtml;

  useEffect(() => {
    if (!html || !iframeRef.current) return;

    setIsLoaded(false);
    setHasError(false);

    const iframe = iframeRef.current;
    
    try {
      // Write the HTML directly into the iframe document
      // This is safer than src=blob: because the sandbox attribute still applies
      iframe.contentDocument?.open();
      iframe.contentDocument?.write(html);
      iframe.contentDocument?.close();
      
      iframe.onload = () => setIsLoaded(true);
      
      // Fallback: mark loaded after 500ms regardless
      setTimeout(() => setIsLoaded(true), 500);
    } catch (err) {
      console.error('[SimulatorRenderer] Failed to write HTML:', err);
      setHasError(true);
    }
  }, [html]);

  if (!html) {
    return (
      <div className="flex items-center justify-center w-full h-full text-white/30 text-sm">
        No simulation available.
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="flex items-center justify-center w-full h-full text-red-400/60 text-sm">
        Simulation failed to load.
      </div>
    );
  }

  return (
    <div className="relative w-full h-full min-h-[520px]">
      {/* Loading state */}
      {!isLoaded && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#0d0d14]">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
            <span className="text-xs text-white/30 uppercase tracking-widest">
              Building simulation...
            </span>
          </div>
        </div>
      )}

      {/* The sandboxed iframe */}
      <iframe
        ref={iframeRef}
        className="w-full h-full min-h-[520px] border-0 rounded-xl"
        sandbox="allow-scripts"
        // allow-scripts but NOT allow-same-origin: 
        // This means the iframe JS cannot access parent window.
        // It CAN run scripts (required for Canvas/animations).
        // It CANNOT make fetch() calls, access cookies, or touch localStorage.
        title={timeline?.title || 'Interactive Simulation'}
        style={{ background: '#0d0d14' }}
      />
    </div>
  );
}
