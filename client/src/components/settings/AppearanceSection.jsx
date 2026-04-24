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

// ─── Theme Preview Card ───────────────────────────────────────────────────────

const ThemePreviewCard = ({ theme, mode, isSelected, onClick }) => {
  const t = theme.colors[mode] || theme.colors['light'];
  return (
    <motion.button
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      style={{
        width: '100%', display: 'flex', flexDirection: 'column', gap: '10px',
        background: 'none', border: 'none', padding: '4px',
        cursor: 'pointer', textAlign: 'left', borderRadius: '16px',
      }}
    >
      {/* Miniature UI Preview */}
      <div style={{
        position: 'relative', width: '100%', aspectRatio: '16/10',
        borderRadius: '14px', overflow: 'hidden', background: t.bg,
        border: `2.5px solid ${isSelected ? t.text : t.border}`,
        transition: 'all 0.2s ease',
      }}>
        {/* Sidebar */}
        <div style={{
          position: 'absolute', top: 0, left: 0, width: '26%', height: '100%',
          background: t.surface, borderRight: `1px solid ${t.border}`,
          padding: '7px 6px', display: 'flex', flexDirection: 'column', gap: '5px',
          boxSizing: 'border-box',
        }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: t.text, opacity: 0.4, marginBottom: '5px' }} />
          {[0.65, 0.45, 0.35].map((op, i) => (
            <div key={i} style={{ width: '100%', height: '4px', borderRadius: '3px', background: t.textMuted, opacity: op * 0.5 }} />
          ))}
          <div style={{ marginTop: 'auto', width: '100%', height: '7px', borderRadius: '4px', background: t.surface2 }} />
        </div>

        {/* Canvas */}
        <div style={{
          position: 'absolute', top: 0, left: '26%', right: 0, bottom: 0, padding: '7px',
          backgroundImage: `radial-gradient(${t.textMuted}44 1px, transparent 1px)`,
          backgroundSize: '8px 8px',
        }}>
          {/* AI bubble */}
          <div style={{
            width: '62%', padding: '4px 6px', borderRadius: '6px 6px 6px 2px',
            background: t.aiBubble, marginBottom: '5px',
          }}>
            <div style={{ width: '100%', height: '3px', borderRadius: '2px', background: t.textMuted, opacity: 0.5, marginBottom: '3px' }} />
            <div style={{ width: '70%', height: '3px', borderRadius: '2px', background: t.textMuted, opacity: 0.3 }} />
          </div>
          {/* User bubble */}
          <div style={{
            width: '48%', padding: '4px 6px', borderRadius: '6px 6px 2px 6px',
            background: t.userBubble, marginLeft: 'auto',
          }}>
            <div style={{ width: '100%', height: '3px', borderRadius: '2px', background: t.userBubbleText, opacity: 0.55 }} />
          </div>
        </div>

        {/* Selection indicator */}
        {isSelected && (
          <div style={{
            position: 'absolute', top: '8px', right: '8px',
            width: '18px', height: '18px', borderRadius: '50%',
            background: t.text, color: t.bg,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Check size={10} strokeWidth={4} />
          </div>
        )}
      </div>

      {/* Label */}
      <div style={{ padding: '0 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{
          fontSize: '12px', fontWeight: isSelected ? 500 : 400,
          color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
          transition: 'color 0.2s',
        }}>
          {theme.name}
        </span>
        {isSelected && (
          <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', opacity: 0.7 }}>Active</span>
        )}
      </div>
    </motion.button>
  );
};

// ─── Layout Option Button ────────────────────────────────────────────────────

const LayoutOption = ({ id, label, icon: Icon, isActive, onClick, children }) => (
  <motion.button
    whileHover={{ y: -1 }}
    whileTap={{ scale: 0.97 }}
    onClick={() => onClick(id)}
    style={{
      flex: 1, display: 'flex', flexDirection: 'column', gap: '10px',
      padding: '14px', borderRadius: '14px',
      border: `1.5px solid ${isActive ? 'var(--text-primary)' : 'var(--border-color)'}`,
      background: isActive ? 'var(--bg-secondary)' : 'transparent',
      cursor: 'pointer', transition: 'all 0.2s ease',
    }}
  >
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '7px', color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
        <Icon size={15} strokeWidth={2} />
        <span style={{ fontSize: '13px', fontWeight: isActive ? 500 : 400 }}>{label}</span>
      </div>
      {isActive && <Check size={13} strokeWidth={3} style={{ color: 'var(--text-primary)' }} />}
    </div>
    {children && (
      <div style={{
        height: '36px', width: '100%', borderRadius: '8px',
        background: 'var(--bg-primary)', border: '1px solid var(--border-color)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity: isActive ? 1 : 0.5, transition: 'opacity 0.2s',
        overflow: 'hidden',
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
    <div style={{ maxWidth: '640px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '36px' }}>

      {/* ── Interface Style ─────────────────────────────────────────── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <SectionTitle style={{ margin: 0 }}>Interface Style</SectionTitle>

          {/* Light / Dark toggle */}
          <div style={{
            display: 'flex', background: 'var(--bg-secondary)',
            borderRadius: '12px', padding: '4px',
            border: '1px solid var(--border-color)', gap: '2px',
          }}>
            {[
              { id: 'light', icon: Sun, label: 'Light' },
              { id: 'dark', icon: Moon, label: 'Dark' },
            ].map(m => (
              <motion.button
                key={m.id}
                whileTap={{ scale: 0.95 }}
                onClick={() => mode !== m.id && toggleMode()}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '6px 14px', borderRadius: '9px', border: 'none',
                  cursor: 'pointer',
                  background: mode === m.id ? 'var(--bg-primary)' : 'transparent',
                  color: mode === m.id ? 'var(--text-primary)' : 'var(--text-tertiary)',
                  fontSize: '12px', fontWeight: mode === m.id ? 500 : 400,
                  transition: 'all 0.18s ease',
                  boxShadow: mode === m.id ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                }}
              >
                <m.icon size={13} />
                {m.label}
              </motion.button>
            ))}
          </div>
        </div>

        {/* Theme Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px' }}>
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
        <div style={{ marginBottom: '14px' }}>
          <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '10px', opacity: 0.8 }}>
            Background Pattern
          </p>
          <div style={{ display: 'flex', gap: '10px' }}>
            <LayoutOption
              id="dots"
              label="Dots"
              icon={TableProperties}
              isActive={store.gridType === 'dots'}
              onClick={store.setGridType}
            >
              <div style={{
                width: '100%', height: '100%',
                backgroundImage: 'radial-gradient(var(--text-tertiary) 1px, transparent 1px)',
                backgroundSize: '8px 8px', opacity: 0.35,
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
                backgroundImage: 'linear-gradient(var(--text-tertiary) 0.5px, transparent 0.5px), linear-gradient(90deg, var(--text-tertiary) 0.5px, transparent 0.5px)',
                backgroundSize: '10px 10px', opacity: 0.2,
              }} />
            </LayoutOption>
            <LayoutOption
              id="none"
              label="None"
              icon={Eye}
              isActive={store.gridType === 'none'}
              onClick={store.setGridType}
            >
              <div style={{ width: '100%', height: '100%', background: 'var(--bg-primary)' }} />
            </LayoutOption>
          </div>
        </div>

        {/* Panel side */}
        <div style={{ marginBottom: '14px' }}>
          <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '10px', opacity: 0.8 }}>
            Chat Panel Position
          </p>
          <div style={{ display: 'flex', gap: '10px' }}>
            <LayoutOption id="left" label="Left" icon={PanelLeft} isActive={store.layoutView === 'left'} onClick={store.setLayoutView} />
            <LayoutOption id="right" label="Right" icon={PanelRight} isActive={store.layoutView === 'right'} onClick={store.setLayoutView} />
          </div>
        </div>

        {/* Toggles */}
        <SettingsGroup>
          <SettingsRow
            icon={Eye}
            label="Mini-Map"
            description="Overview of your canvas in the corner"
            rightElement={<AppleToggle value={store.showMinimap} onChange={store.setShowMinimap} />}
          />
          <SettingsRow
            icon={Grid3X3}
            label="Snap to Grid"
            description="Shapes align to grid intersections"
            borderBottom={false}
            rightElement={<AppleToggle value={store.isSnapToGrid} onChange={store.setSnapToGrid} />}
          />
        </SettingsGroup>

        {/* Motion */}
        <SettingsGroup>
          <SettingsRow
            icon={Zap}
            label="Motion Style"
            description="Controls animation speed across the app"
            borderBottom={false}
            rightElement={
              <RightInlineSelect
                value={store.motionMode}
                onChange={store.setMotionMode}
                options={[
                  { value: 'fluid', label: 'Fluid' },
                  { value: 'snappy', label: 'Snappy' },
                  { value: 'minimal', label: 'Reduced' },
                ]}
              />
            }
          />
        </SettingsGroup>
      </div>

    </div>
  );
}