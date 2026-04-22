import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Sun, Moon, Check, TableProperties, 
  Grid3X3, PanelLeft, PanelRight, Eye, 
  PenTool, Layers, LayoutGrid, Zap 
} from 'lucide-react';
import useTutorStore from '../../store/tutorStore';
import { useTheme } from '../../context/ThemeContext';
import { 
  SettingsGroup, SettingsRow, AppleToggle, 
  RightInlineSelect 
} from './SettingsShared';

const ThemePreviewCard = ({ theme, mode, isSelected, onClick }) => {
  const t = theme.colors[mode];
  return (
    <motion.button
      whileHover={{ scale: 1.02, y: -2, background: 'var(--bg-secondary)' }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      style={{
        width: '100%', display: 'flex', flexDirection: 'column', gap: '8px',
        background: 'none', border: 'none', padding: '4px', cursor: 'pointer',
        textAlign: 'left', borderRadius: '16px', transition: 'background 0.2s ease',
      }}
    >
      <div style={{
        position: 'relative', width: '100%', aspectRatio: '16/10', borderRadius: '12px', overflow: 'hidden',
        background: t.bg, border: `1px solid ${isSelected ? 'var(--text-primary)' : 'var(--border-color)'}`,
        transition: 'all 0.2s ease', boxShadow: isSelected ? '0 12px 24px rgba(0,0,0,0.12)' : '0 4px 12px rgba(0,0,0,0.04)',
      }}>
        <div style={{ position: 'absolute', top: 0, left: 0, width: '25%', height: '100%', background: t.surface, borderRight: `1px solid ${t.border}` }} />
        {isSelected && (
          <div style={{ position: 'absolute', top: '8px', right: '8px', width: '18px', height: '18px', borderRadius: '50%', background: 'var(--text-primary)', color: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Check size={12} strokeWidth={4} />
          </div>
        )}
      </div>
      <div style={{ padding: '0 4px' }}>
        <div style={{ fontSize: '12px', fontWeight: 600, color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{theme.name}</div>
      </div>
    </motion.button>
  );
};

const VisualOption = ({ id, label, icon: Icon, isActive, onClick, preview }) => (
  <motion.button whileHover={{ y: -1, background: 'var(--bg-tertiary)' }} whileTap={{ scale: 0.98 }} onClick={() => onClick(id)}
    style={{
      flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px', borderRadius: '16px', border: '1px solid',
      borderColor: isActive ? 'var(--text-primary)' : 'var(--border-color)', background: isActive ? 'var(--bg-secondary)' : 'transparent',
      cursor: 'pointer', transition: 'all 0.2s ease', position: 'relative', overflow: 'hidden'
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
        <Icon size={16} strokeWidth={2.5} />
        <span style={{ fontSize: '13px', fontWeight: 600 }}>{label}</span>
      </div>
      {isActive && <Check size={14} strokeWidth={3} style={{ color: 'var(--text-primary)' }} />}
    </div>
    {preview && <div style={{ height: '40px', width: '100%', borderRadius: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: isActive ? 1 : 0.6 }}>{preview}</div>}
  </motion.button>
);

export default function AppearanceSection({ syncSettings }) {
  const store = useTutorStore();
  const { themes, currentThemeId, setCurrentThemeId, mode, toggleMode } = useTheme();

  useEffect(() => {
    const timeout = setTimeout(() => {
      syncSettings('appearance', {
        themeId: currentThemeId, mode, showMinimap: store.showMinimap, showGrid: store.showGrid,
        layoutView: store.layoutView, gridType: store.gridType, globalFont: store.globalFont,
        glassIntensity: store.glassIntensity, canvasTone: store.canvasTone, motionMode: store.motionMode
      });
    }, 1000);
    return () => clearTimeout(timeout);
  }, [currentThemeId, mode, store.showMinimap, store.showGrid, store.layoutView, store.gridType, store.globalFont, store.glassIntensity, store.canvasTone, store.motionMode, syncSettings]);

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '40px' }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <h3 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Interface Style</h3>
          <div style={{ display: 'flex', background: 'var(--bg-secondary)', borderRadius: '12px', padding: '4px', border: '1px solid var(--border-color)' }}>
            {[{ id: 'light', icon: Sun, label: 'Light' }, { id: 'dark', icon: Moon, label: 'Dark' }].map(m => (
              <button key={m.id} onClick={() => mode !== m.id && toggleMode()} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: mode === m.id ? 'var(--bg-primary)' : 'transparent', color: mode === m.id ? 'var(--text-primary)' : 'var(--text-tertiary)', fontSize: '12px', fontWeight: 600, transition: 'all 0.2' }}>
                <m.icon size={14} />{m.label}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
          {themes.map((theme) => <ThemePreviewCard key={theme.id} theme={theme} mode={mode} isSelected={currentThemeId === theme.id} onClick={() => setCurrentThemeId(theme.id)} />)}
        </div>
      </div>

      <div style={{ marginBottom: '24px' }}>
        <h3 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Canvas Workspace</h3>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div style={{ display: 'flex', gap: '12px' }}>
          <VisualOption id="dots" label="Dots" icon={TableProperties} isActive={store.gridType === 'dots'} onClick={store.setGridType} preview={<div style={{ width: '100%', height: '100%', backgroundImage: 'radial-gradient(var(--text-tertiary) 1px, transparent 1px)', backgroundSize: '8px 8px', opacity: 0.3 }} />} />
          <VisualOption id="lines" label="Lines" icon={Grid3X3} isActive={store.gridType === 'lines'} onClick={store.setGridType} preview={<div style={{ width: '100%', height: '100%', backgroundImage: 'linear-gradient(var(--text-tertiary) 0.5px, transparent 0.5px), linear-gradient(90deg, var(--text-tertiary) 0.5px, transparent 0.5px)', backgroundSize: '10px 10px', opacity: 0.2 }} />} />
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <VisualOption id="left" label="Left" icon={PanelLeft} isActive={store.layoutView === 'left'} onClick={store.setLayoutView} />
          <VisualOption id="right" label="Right" icon={PanelRight} isActive={store.layoutView === 'right'} onClick={store.setLayoutView} />
        </div>
        <SettingsGroup>
          <SettingsRow icon={Eye} label="Mini-Map" rightElement={<AppleToggle value={store.showMinimap} onChange={store.setShowMinimap} />} />
          <SettingsRow icon={Grid3X3} label="Snap-to-Grid" borderBottom={false} rightElement={<AppleToggle value={store.isSnapToGrid} onChange={store.toggleSnap} />} />
        </SettingsGroup>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
          {['geist', 'inter', 'outfit', 'mono'].map(f => <VisualOption key={f} id={f} label={f.charAt(0).toUpperCase() + f.slice(1)} icon={PenTool} isActive={store.globalFont === f} onClick={store.setGlobalFont} />)}
        </div>
        <SettingsGroup>
          <SettingsRow icon={Layers} label="Glass Intensity" rightElement={<input type="range" min="0" max="100" value={store.glassIntensity} onChange={e => store.setGlassIntensity(parseInt(e.target.value))} style={{ width: '120px' }} />} />
          <SettingsRow icon={LayoutGrid} label="Tone" borderBottom={false} rightElement={<RightInlineSelect value={store.canvasTone} onChange={store.setCanvasTone} options={[{ value: 'neutral', label: 'Neutral' }, { value: 'warm', label: 'Warm' }, { value: 'cool', label: 'Cool' }]} />} />
        </SettingsGroup>
        <SettingsGroup>
          <SettingsRow icon={Zap} label="Motion" borderBottom={false} rightElement={<RightInlineSelect value={store.motionMode} onChange={store.setMotionMode} options={[{ value: 'fluid', label: 'Fluid' }, { value: 'snappy', label: 'Snappy' }, { value: 'minimal', label: 'Minimal' }]} />} />
        </SettingsGroup>
      </div>
    </div>
  );
}
