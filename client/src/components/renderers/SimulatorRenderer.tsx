/**
 * SimulatorRenderer v1.0
 * 
 * Receives a complete HTML string from SimulatorAgent and runs it
 * in a sandboxed iframe. Zero dependencies. Maximum security.
 */

import React, { useRef, useEffect, useState } from 'react';
import DOMPurify from 'dompurify';

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

    // SEC-03: Sanitize AI-generated HTML before rendering
    // We allow scripts and styles because they are necessary for the simulations,
    // but we rely on the strict CSP and 'sandbox' (without allow-same-origin) 
    // to prevent those scripts from doing anything malicious.
    const sanitizedHtml = DOMPurify.sanitize(html, {
      ADD_TAGS: ['script', 'style'],
      ADD_ATTR: ['onclick', 'onerror'], // Some simulations use these for interaction
      WHOLE_DOCUMENT: true,
      RETURN_TRUSTED_TYPE: false,
    });

    // SEC-25: Content Security Policy + srcDoc Isolation
    // We wrap the AI-generated HTML with a strict CSP and use srcDoc
    // which is more reliable for sandboxing than document.write.
    const secureHtml = `
      <meta http-equiv="Content-Security-Policy" 
        content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data: https:;">
      ${sanitizedHtml}
    `;

    try {
      const iframe = iframeRef.current;
      iframe.srcdoc = secureHtml;
      
      iframe.onload = () => setIsLoaded(true);
      
      // Fallback: mark loaded after 500ms regardless
      setTimeout(() => setIsLoaded(true), 500);
    } catch (err) {
      console.error('[SimulatorRenderer] Failed to load simulation:', err);
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
        sandbox="allow-scripts allow-forms allow-modals"
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
