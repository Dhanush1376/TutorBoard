import React from 'react';
import { 
  Share, 
  Link, 
  Download, 
  FileJson,
  QrCode
} from 'lucide-react';
import ActionButtonBase from '../tools/ActionButtonBase';
import useTutorStore from '../../../store/tutorStore';
import { Check, Copy } from 'lucide-react';

const ShareAction = (props) => {
  const { canvasObjects } = useTutorStore();
  const [feedback, setFeedback] = React.useState(null); // 'invite' | 'json' | 'png'

  const showFeedback = (id) => {
    setFeedback(id);
    setTimeout(() => setFeedback(null), 2000);
  };

  const handleCopyInvite = () => {
    navigator.clipboard.writeText(window.location.href);
    showFeedback('invite');
  };

  const handleCopyJSON = () => {
    const data = JSON.stringify(canvasObjects, null, 2);
    navigator.clipboard.writeText(data);
    showFeedback('json');
  };

  const handleDownloadPNG = async () => {
    // L2 FIX: Use a reliable selector — the AgentCanvasRenderer SVG is inside the content layer
    const svg = document.querySelector('svg[viewBox="0 0 800 600"]') || document.querySelector('.origin-top-left svg');
    if (!svg) {
      console.warn('No canvas SVG found for export');
      return;
    }

    try {
      const svgData = new XMLSerializer().serializeToString(svg);
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);
      
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = svg.viewBox.baseVal.width || window.innerWidth;
        canvas.height = svg.viewBox.baseVal.height || window.innerHeight;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#000000'; // Dark background for TutorBoard
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        
        const pngUrl = canvas.toDataURL('image/png');
        const downloadLink = document.createElement('a');
        downloadLink.href = pngUrl;
        downloadLink.download = `tutorboard-export-${Date.now()}.png`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        URL.revokeObjectURL(url);
        
        // ── Camera Snap / Flash Animation ──
        const flash = document.createElement('div');
        flash.style.position = 'fixed';
        flash.style.inset = '0';
        flash.style.backgroundColor = 'white';
        flash.style.zIndex = '99999';
        flash.style.pointerEvents = 'none';
        flash.style.transition = 'opacity 0.5s ease-out';
        flash.style.opacity = '0.85';
        document.body.appendChild(flash);
        
        const mainView = document.querySelector('main') || document.body;
        const originalTransform = mainView.style.transform;
        const originalTransition = mainView.style.transition;
        mainView.style.transition = 'transform 0.15s cubic-bezier(0.4, 0, 0.2, 1)';
        mainView.style.transform = 'scale(0.97)';
        
        // Trigger the flash fade-out and bounce-back
        requestAnimationFrame(() => {
          setTimeout(() => {
            flash.style.opacity = '0';
            mainView.style.transform = originalTransform || 'scale(1)';
            setTimeout(() => {
              if (document.body.contains(flash)) document.body.removeChild(flash);
              mainView.style.transition = originalTransition;
            }, 500);
          }, 50);
        });

        showFeedback('png');
      };
      img.src = url;
    } catch (err) {
      console.error('Export failed:', err);
    }
  };
  const Submenu = (
    <div className="flex flex-col gap-5 p-4 min-w-[280px]">
      {/* Collaboration */}
      <div className="flex flex-col gap-2.5">
        <span className="text-[10px] font-normal text-[var(--text-tertiary)] uppercase tracking-[0.1em] px-1 opacity-70">Collaborate</span>
        <button
          onClick={handleCopyInvite}
          className="flex items-center gap-4 p-3 rounded-2xl border border-[var(--border-color)] hover:bg-[var(--bg-secondary)] transition-all group w-full shadow-sm hover:shadow-md"
        >
          <div className="w-10 h-10 rounded-xl bg-[var(--bg-primary)] border border-transparent group-hover:border-[var(--border-color)] flex items-center justify-center group-hover:scale-105 transition-all">
            {feedback === 'invite' ? <Check size={18} className="text-green-500" /> : <Link size={18} className="text-[var(--text-primary)]" />}
          </div>
          <div className="flex flex-col items-start leading-tight">
            <span className="text-[13px] font-normal text-[var(--text-primary)]">
              {feedback === 'invite' ? 'Link Copied!' : 'Invite Others'}
            </span>
            <span className="text-[10px] text-[var(--text-tertiary)] font-normal">
              {feedback === 'invite' ? 'Ready to share with team' : 'Copy secure session link'}
            </span>
          </div>
        </button>
      </div>

      <div className="h-px bg-[var(--border-color)] opacity-40 mx-1" />

      {/* Export Options */}
      <div className="flex flex-col gap-2.5">
        <span className="text-[10px] font-normal text-[var(--text-tertiary)] uppercase tracking-[0.1em] px-1 opacity-70">Archive & Export</span>
        <div className="flex gap-2">
          <button
            onClick={handleDownloadPNG}
            title="Download as PNG"
            className="flex-1 flex flex-col items-center gap-2 p-3 rounded-2xl border border-[var(--border-color)] hover:bg-[var(--bg-secondary)] transition-all group shadow-sm hover:shadow-md"
          >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[var(--bg-secondary)] group-hover:bg-[var(--bg-primary)] transition-colors">
              {feedback === 'png' ? <Check size={16} className="text-green-500" /> : <Download size={16} className="text-[var(--text-tertiary)] group-hover:text-[var(--text-primary)]" />}
            </div>
            <span className="text-[10px] font-normal uppercase text-[var(--text-tertiary)] group-hover:text-[var(--text-primary)] tracking-wider">
              {feedback === 'png' ? 'Saved' : 'PNG Image'}
            </span>
          </button>
          
          <button
            onClick={handleCopyJSON}
            title="Copy as Canvas JSON"
            className="flex-1 flex flex-col items-center gap-2 p-3 rounded-2xl border border-[var(--border-color)] hover:bg-[var(--bg-secondary)] transition-all group shadow-sm hover:shadow-md"
          >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[var(--bg-secondary)] group-hover:bg-[var(--bg-primary)] transition-colors">
              {feedback === 'json' ? <Check size={16} className="text-green-500" /> : <FileJson size={16} className="text-[var(--text-tertiary)] group-hover:text-[var(--text-primary)]" />}
            </div>
            <span className="text-[10px] font-normal uppercase text-[var(--text-tertiary)] group-hover:text-[var(--text-primary)] tracking-wider">
              {feedback === 'json' ? 'Copied' : 'JSON Data'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <ActionButtonBase 
      {...props}
      icon={Share} 
      label="Share Session" 
      customSubmenu={Submenu}
    />
  );
};

export default ShareAction;
