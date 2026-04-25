import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Sun, Moon, Check, TableProperties,
  Grid3X3, PanelLeft, PanelRight, Eye,
  Zap
} from 'lucide-react';
import useTutorStore from '../../store/tutorStore';
import { useTheme } from '../../context/ThemeContext';
import {
  SectionTitle, SettingsGroup, SettingsRow,
  AppleToggle, RightInlineSelect
} from './SettingsShared';

// ─── Theme Preview Card ──────────────────────────────────────────────────────

const ThemePreviewCard = ({ theme, mode, isSelected, onClick }) => {
  const t = theme.colors[mode] || theme.colors['light'];
  return (
    <motion.button
      whileHover={{ scale: 1.02, y: -4 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      style={{
        width: '100%', display: 'flex', flexDirection: 'column', gap: '10px',
        background: 'none', border: 'none', padding: '6px',
        cursor: 'pointer', textAlign: 'left', borderRadius: '20px',
      }}
    >
      {/* Miniature UI Preview — Premium Glassmorphism */}
      <div style={{
        position: 'relative', width: '100%', aspectRatio: '16/10',
        borderRadius: '18px', overflow: 'hidden', background: t.bg,
        border: `2px solid ${isSelected ? 'var(--accent-primary)' : 'var(--border-color)'}`,
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        boxShadow: isSelected ? `0 12px 32px ${t.text}15` : '0 4px 12px rgba(0,0,0,0.02)',
      }}>
        {/* Sidebar */}
        <div style={{
          position: 'absolute', top: 0, left: 0, width: '28%', height: '100%',
          background: t.surface, borderRight: `1px solid ${t.border}`,
          padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: '6px',
          boxSizing: 'border-box',
        }}>
          <div style={{ width: '10px', height: '10px', borderRadius: '4px', background: t.text, opacity: 0.5, marginBottom: '6px' }} />
          {[0.7, 0.5, 0.4].map((op, i) => (
            <div key={i} style={{ width: '100%', height: '4px', borderRadius: '3px', background: t.textMuted, opacity: op * 0.4 }} />
          ))}
          <div style={{ marginTop: 'auto', width: '100%', height: '8px', borderRadius: '4px', background: t.surface2, opacity: 0.6 }} />
        </div>

        {/* Canvas Area */}
        <div style={{
          position: 'absolute', top: 0, left: '28%', right: 0, bottom: 0, padding: '10px',
          backgroundImage: `radial-gradient(${t.textMuted}33 0.8px, transparent 0.8px)`,
          backgroundSize: '8px 8px',
        }}>
          {/* AI bubble */}
          <div style={{
            width: '65%', padding: '6px 8px', borderRadius: '8px 8px 8px 2px',
            background: t.aiBubble, marginBottom: '6px',
            boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
          }}>
            <div style={{ width: '100%', height: '3px', borderRadius: '2px', background: t.textMuted, opacity: 0.4, marginBottom: '4px' }} />
            <div style={{ width: '75%', height: '3px', borderRadius: '2px', background: t.textMuted, opacity: 0.25 }} />
          </div>
          {/* User bubble */}
          <div style={{
            width: '50%', padding: '6px 8px', borderRadius: '8px 8px 2px 8px',
            background: t.userBubble, marginLeft: 'auto',
            boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
          }}>
            <div style={{ width: '100%', height: '3px', borderRadius: '2px', background: t.userBubbleText, opacity: 0.5 }} />
          </div>
        </div>

        {/* Selection Glow */}
        {isSelected && (
          <div style={{
            position: 'absolute', inset: 0,
            boxShadow: `inset 0 0 0 1px var(--accent-primary)`,
            pointerEvents: 'none', borderRadius: '16px',
          }} />
        )}
      </div>

      {/* Label & Meta */}
      <div style={{ padding: '0 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{
            fontSize: '13px', fontWeight: 500,
            color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
            transition: 'color 0.2s',
            letterSpacing: '-0.01em',
          }}>
            {theme.name}
          </span>
          <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em', opacity: 0.6 }}>
            {mode.charAt(0).toUpperCase() + mode.slice(1)}
          </span>
        </div>
        {isSelected && (
          <div style={{
            width: '16px', height: '16px', borderRadius: '50%',
            background: 'var(--accent-primary)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px var(--accent-primary)33',
          }}>
            <Check size={10} strokeWidth={4} />
          </div>
        )}
      </div>
    </motion.button>
  );
};

// ─── Layout Option Button ────────────────────────────────────────────────────

const LayoutOption = ({ id, label, icon: Icon, isActive, onClick, children }) => (
  <motion.button
    whileHover={{ y: -3, background: isActive ? 'var(--bg-secondary)' : 'var(--bg-tertiary)44' }}
    whileTap={{ scale: 0.97 }}
    onClick={() => onClick(id)}
    style={{
      flex: 1, display: 'flex', flexDirection: 'column', gap: '8px',
      padding: '10px', borderRadius: '12px',
      border: `1.2px solid ${isActive ? 'var(--accent-primary)' : 'var(--border-color)'}`,
      background: isActive ? 'var(--bg-secondary)' : 'transparent',
      cursor: 'pointer', transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
      boxShadow: isActive ? '0 4px 10px rgba(0,0,0,0.02)' : 'none',
      position: 'relative', overflow: 'hidden',
    }}
  >
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
      zIndex: 1,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
        <div style={{
          width: '24px', height: '24px', borderRadius: '6px',
          background: isActive ? 'var(--accent-primary)15' : 'var(--bg-tertiary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: isActive ? 'var(--accent-primary)' : 'var(--text-tertiary)',
        }}>
          <Icon size={14} strokeWidth={2.5} />
        </div>
        <span style={{ fontSize: '13px', fontWeight: isActive ? 500 : 400, letterSpacing: '-0.01em' }}>{label}</span>
      </div>
      {isActive && (
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
          <Check size={13} strokeWidth={4} style={{ color: 'var(--accent-primary)' }} />
        </motion.div>
      )}
    </div>
    {children && (
      <div style={{
        height: '32px', width: '100%', borderRadius: '8px',
        background: 'var(--bg-primary)', border: '1px solid var(--border-color)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity: isActive ? 1 : 0.6, transition: 'all 0.3s',
        overflow: 'hidden', zIndex: 1,
        boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.02)',
      }}>
        {children}
      </div>
    )}
  </motion.button>
);

// ─── Main Component ──────────────────────────────────────────────────────────

export default function AppearanceSection({ syncSettings }) {
  const store = useTutorStore();
  const { themes, currentThemeId, setCurrentThemeId, mode, toggleMode } = useTheme();

  // Persist changes with debounce
  useEffect(() => {
    const timeout = setTimeout(() => {
      syncSettings('appearance', {
        themeId: currentThemeId, mode,
        showMinimap: store.showMinimap,
        showGrid: store.showGrid,
        layoutView: store.layoutView,
        gridType: store.gridType,
        motionMode: store.motionMode,
      });
    }, 300);
    return () => clearTimeout(timeout);
  }, [currentThemeId, mode, store.showMinimap, store.showGrid, store.layoutView, store.gridType, store.motionMode]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      style={{ maxWidth: '640px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px', paddingBottom: '20px' }}
    >

      {/* ── Interface Style ─────────────────────────────────────────── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <SectionTitle style={{ margin: 0 }}>Interface Style</SectionTitle>

          {/* Light / Dark toggle — Premium Segmented Control */}
          <div style={{
            display: 'flex', background: 'var(--bg-secondary)',
            borderRadius: '14px', padding: '5px',
            border: '1px solid var(--border-color)', gap: '4px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
          }}>
            {[
              { id: 'light', icon: Sun, label: 'Light' },
              { id: 'dark', icon: Moon, label: 'Dark' },
            ].map(m => (
              <motion.button
                key={m.id}
                whileTap={{ scale: 0.96 }}
                onClick={() => mode !== m.id && toggleMode()}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '6px 12px', borderRadius: '8px', border: 'none',
                  cursor: 'pointer',
                  background: mode === m.id ? 'var(--bg-primary)' : 'transparent',
                  color: mode === m.id ? 'var(--text-primary)' : 'var(--text-tertiary)',
                  fontSize: '11px', fontWeight: mode === m.id ? 600 : 400,
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: mode === m.id ? '0 4px 12px rgba(0,0,0,0.08)' : 'none',
                }}
              >
                <m.icon size={13} strokeWidth={mode === m.id ? 2.5 : 2} />
                {m.label}
              </motion.button>
            ))}
          </div>
        </div>

        {/* Theme Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
          {themes.map(theme => (
            <ThemePreviewCard
              key={theme.id}
              theme={theme}
              mode={mode}
              isSelected={currentThemeId === theme.id}
              onClick={() => setCurrentThemeId(theme.id)}
            />
          ))}
        </div>
      </div>

      {/* ── Canvas Workspace ─────────────────────────────────────────── */}
      <div>
        <SectionTitle>Canvas Workspace</SectionTitle>

        {/* Grid type */}
        <div style={{ marginBottom: '16px' }}>
          <p style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-tertiary)', marginBottom: '8px', opacity: 0.8, letterSpacing: '0.02em' }}>
            BACKGROUND PATTERN
          </p>
          <div style={{ display: 'flex', gap: '14px' }}>
            <LayoutOption
              id="dots"
              label="Dots"
              icon={TableProperties}
              isActive={store.gridType === 'dots'}
              onClick={store.setGridType}
            >
              <div style={{
                width: '100%', height: '100%',
                backgroundImage: 'radial-gradient(var(--text-tertiary) 1.2px, transparent 1.2px)',
                backgroundSize: '10px 10px', opacity: 0.3,
              }} />
            </LayoutOption>
            <LayoutOption
              id="lines"
              label="Lines"
              icon={Grid3X3}
              isActive={store.gridType === 'lines'}
              onClick={store.setGridType}
            >
              <div style={{
                width: '100%', height: '100%',
                backgroundImage: 'linear-gradient(var(--text-tertiary) 0.6px, transparent 0.6px), linear-gradient(90deg, var(--text-tertiary) 0.6px, transparent 0.6px)',
                backgroundSize: '12px 12px', opacity: 0.15,
              }} />
            </LayoutOption>
            <LayoutOption
              id="none"
              label="None"
              icon={Eye}
              isActive={store.gridType === 'none'}
              onClick={store.setGridType}
            >
              <div style={{ width: '100%', height: '100%', background: 'var(--bg-primary)', position: 'relative' }}>
                <div style={{ position: 'absolute', inset: 0, opacity: 0.05, backgroundImage: 'linear-gradient(45deg, var(--text-tertiary) 25%, transparent 25%, transparent 50%, var(--text-tertiary) 50%, var(--text-tertiary) 75%, transparent 75%, transparent)' }} />
              </div>
            </LayoutOption>
          </div>
        </div>

        {/* Panel side */}
        <div style={{ marginBottom: '24px' }}>
          <p style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-tertiary)', marginBottom: '8px', opacity: 0.8, letterSpacing: '0.02em' }}>
            CHAT PANEL POSITION
          </p>
          <div style={{ display: 'flex', gap: '14px' }}>
            <LayoutOption id="left" label="Left Side" icon={PanelLeft} isActive={store.layoutView === 'left'} onClick={store.setLayoutView}>
              <div style={{ width: '100%', height: '100%', display: 'flex' }}>
                <div style={{ width: '30%', height: '100%', background: 'var(--bg-tertiary)', borderRight: '1px solid var(--border-color)' }} />
                <div style={{ flex: 1 }} />
              </div>
            </LayoutOption>
            <LayoutOption id="right" label="Right Side" icon={PanelRight} isActive={store.layoutView === 'right'} onClick={store.setLayoutView}>
              <div style={{ width: '100%', height: '100%', display: 'flex' }}>
                <div style={{ flex: 1 }} />
                <div style={{ width: '30%', height: '100%', background: 'var(--bg-tertiary)', borderLeft: '1px solid var(--border-color)' }} />
              </div>
            </LayoutOption>
          </div>
        </div>

        {/* Workspace Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <SettingsGroup>
            <SettingsRow
              icon={Eye}
              label="Mini-Map Navigation"
              description="Overview of your canvas in the corner"
              rightElement={<AppleToggle value={store.showMinimap} onChange={store.setShowMinimap} />}
            />
            <SettingsRow
              icon={Grid3X3}
              label="Intelligent Snap"
              description="Shapes align precisely to grid intersections"
              borderBottom={false}
              rightElement={<AppleToggle value={store.isSnapToGrid} onChange={store.setSnapToGrid} />}
            />
          </SettingsGroup>

          <SettingsGroup>
            <SettingsRow
              icon={Zap}
              label="Motion Fidelity"
              description="Controls interaction speed across the workspace"
              borderBottom={false}
              rightElement={
                <RightInlineSelect
                  value={store.motionMode}
                  onChange={store.setMotionMode}
                  options={[
                    { value: 'fluid', label: 'Fluid (60fps)' },
                    { value: 'snappy', label: 'Snappy' },
                    { value: 'minimal', label: 'Reduced Motion' },
                  ]}
                />
              }
            />
          </SettingsGroup>
        </div>
      </div>

    </motion.div>
  );
}
