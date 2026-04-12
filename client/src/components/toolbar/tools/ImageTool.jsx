import React, { useRef } from 'react';
import { 
  Image as ImageIcon, 
  Upload, 
  Search,
  Check,
  FolderOpen,
  Plus
} from 'lucide-react';
import useTutorStore from '../../../store/tutorStore';
import ToolButtonBase from '../components/ToolButtonBase';

const ImageTool = (props) => {
  const { canvasObjects, setCanvasObjectsWithHistory } = useTutorStore();
  const fileInputRef = useRef(null);

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const newImg = {
        id: `img-${Date.now()}`,
        type: 'image',
        url: event.target.result,
        x: 0.5,
        y: 0.5,
        scale: 0.4,
      };
      setCanvasObjectsWithHistory([...canvasObjects, newImg]);
      props.onMouseLeave?.(); // Close menu
    };
    reader.readAsDataURL(file);
  };

  const Submenu = (
    <div className="flex flex-col gap-4 p-3.5 min-w-[210px]">
      {/* Primary Actions */}
      <div className="flex flex-col gap-2">
        <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest px-1">Import Media</span>
        <div className="flex flex-col gap-1">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-3 p-3 rounded-xl border border-[var(--border-color)] hover:bg-[var(--bg-secondary)] transition-all group text-left"
          >
            <div className="w-8 h-8 rounded-lg bg-[var(--bg-primary)] flex items-center justify-center group-hover:scale-110 transition-transform">
              <Upload size={15} className="text-[var(--text-primary)]" />
            </div>
            <div className="flex flex-col items-start leading-tight">
              <span className="text-xs font-bold text-[var(--text-primary)]">Upload Image</span>
              <span className="text-[9px] text-[var(--text-tertiary)]">JPG, PNG, WebP</span>
            </div>
          </button>

          <button
            disabled
            className="flex items-center gap-3 p-3 rounded-xl border border-dashed border-[var(--border-color)] opacity-60 cursor-not-allowed group text-left"
          >
            <div className="w-8 h-8 rounded-lg bg-[var(--bg-primary)] flex items-center justify-center">
              <FolderOpen size={15} className="text-[var(--text-tertiary)]" />
            </div>
            <div className="flex flex-col items-start leading-tight">
              <span className="text-xs font-bold text-[var(--text-tertiary)]">Asset Library</span>
              <span className="text-[9px] text-[var(--text-tertiary)]">Coming Soon</span>
            </div>
          </button>
        </div>
      </div>

      <div className="h-px bg-[var(--border-color)] opacity-40 mx-1" />

      {/* Stock Content Section */}
      <div className="flex flex-col gap-2">
        <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest px-1">Discovery</span>
        <div className="relative group">
          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
            <Search size={12} className="text-[var(--text-tertiary)]" />
          </div>
          <input 
            type="text"
            placeholder="Search stock photos..."
            disabled
            className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg py-2 pl-9 pr-3 text-[10px] text-[var(--text-secondary)] placeholder:text-[var(--text-tertiary)] outline-none"
          />
        </div>
      </div>
    </div>
  );

  return (
    <>
      <input 
        type="file" 
        ref={fileInputRef} 
        style={{ display: 'none' }} 
        accept="image/*" 
        onChange={handleImageUpload} 
      />
      <ToolButtonBase 
        {...props}
        id="image" 
        icon={ImageIcon} 
        label="Image Tool" 
        shortcut="I" 
        customSubmenu={Submenu}
      />
    </>
  );
};

export default ImageTool;
