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
    <button
      onClick={onClick}
      style={{
        width: '100%', display: 'flex', flexDirection: 'column', gap: '8px',
        background: 'none', border: 'none', padding: '4px',
        cursor: 'pointer', textAlign: 'left', borderRadius: '14px',
      }}
    >
      {/* Miniature UI Preview */}
      <div style={{
        position: 'relative', width: '100%', aspectRatio: '16/10',
        borderRadius: '12px', overflow: 'hidden', background: t.bg,
        border: `1.5px solid ${isSelected ? 'var(--text-primary)' : 'var(--border-color)'}`,
        transition: 'all 0.15s ease',
      }}>
        {/* Sidebar */}
        <div style={{
          position: 'absolute', top: 0, left: 0, width: '28%', height: '100%',
          background: t.surface, borderRight: `1px solid ${t.border}`,
          padding: '8px 6px', display: 'flex', flexDirection: 'column', gap: '4px',
          boxSizing: 'border-box',
        }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '3px', background: t.text, opacity: 0.4, marginBottom: '4px' }} />
          {[0.6, 0.4, 0.3].map((op, i) => (
            <div key={i} style={{ width: '100%', height: '3px', borderRadius: '2px', background: t.textMuted, opacity: op * 0.3 }} />
          ))}
        </div>

        {/* Canvas Area */}
        <div style={{
          position: 'absolute', top: 0, left: '28%', right: 0, bottom: 0, padding: '8px',
          backgroundImage: `radial-gradient(${t.textMuted}22 0.6px, transparent 0.6px)`,
          backgroundSize: '6px 6px',
        }}>
          {/* AI bubble */}
          <div style={{
            width: '60%', padding: '5px 7px', borderRadius: '6px 6px 6px 2px',
            background: t.aiBubble, marginBottom: '5px',
          }}>
            <div style={{ width: '100%', height: '2px', borderRadius: '1px', background: t.textMuted, opacity: 0.3, marginBottom: '3px' }} />
            <div style={{ width: '70%', height: '2px', borderRadius: '1px', background: t.textMuted, opacity: 0.2 }} />
          </div>
          {/* User bubble */}
          <div style={{
            width: '45%', padding: '5px 7px', borderRadius: '6px 6px 2px 6px',
            background: t.userBubble, marginLeft: 'auto',
          }}>
            <div style={{ width: '100%', height: '2px', borderRadius: '1px', background: t.userBubbleText, opacity: 0.4 }} />
          </div>
        </div>
      </div>

      {/* Label */}
      <div style={{ padding: '0 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{
          fontSize: '12px', fontWeight: isSelected ? 500 : 400,
          color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
          transition: 'color 0.12s',
          letterSpacing: '-0.01em',
        }}>
          {theme.name}
        </span>
        {isSelected && (
          <div style={{
            width: '14px', height: '14px', borderRadius: '50%',
            background: 'var(--text-primary)', color: 'var(--bg-primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Check size={8} strokeWidth={4} />
          </div>
        )}
      </div>
    </button>
  );
};

// ─── Layout Option Button ────────────────────────────────────────────────────

const LayoutOption = ({ id, label, icon: Icon, isActive, onClick, children }) => (
  <button
    onClick={() => onClick(id)}
    style={{
      flex: 1, display: 'flex', flexDirection: 'column', gap: '6px',
      padding: '8px', borderRadius: '10px',
      border: `1px solid ${isActive ? 'var(--text-primary)' : 'var(--border-color)'}`,
      background: isActive ? 'var(--bg-secondary)' : 'transparent',
      cursor: 'pointer', transition: 'all 0.12s ease',
    }}
  >
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: isActive ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
        <Icon size={13} strokeWidth={2} />
        <span style={{ fontSize: '12px', fontWeight: isActive ? 500 : 400 }}>{label}</span>
      </div>
      {isActive && <Check size={11} strokeWidth={3} style={{ color: 'var(--text-primary)' }} />}
    </div>
    {children && (
      <div style={{
        height: '28px', width: '100%', borderRadius: '6px',
        background: 'var(--bg-primary)', border: '1px solid var(--border-color)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity: isActive ? 1 : 0.5, transition: 'opacity 0.12s',
        overflow: 'hidden',
      }}>
        {children}
      </div>
    )}
  </button>
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* ── Interface Style ─────────────────────────────────────────── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <SectionTitle style={{ margin: 0 }}>Theme</SectionTitle>

          {/* Light / Dark toggle */}
          <div style={{
            display: 'flex', background: 'var(--bg-secondary)',
            borderRadius: '8px', padding: '3px',
            border: '1px solid var(--border-color)', gap: '2px',
          }}>
            {[
              { id: 'light', icon: Sun, label: 'Light' },
              { id: 'dark', icon: Moon, label: 'Dark' },
            ].map(m => (
              <button
                key={m.id}
                onClick={() => mode !== m.id && toggleMode()}
                style={{
                  display: 'flex', alignItems: 'center', gap: '4px',
                  padding: '4px 10px', borderRadius: '6px', border: 'none',
                  cursor: 'pointer',
                  background: mode === m.id ? 'var(--bg-primary)' : 'transparent',
                  color: mode === m.id ? 'var(--text-primary)' : 'var(--text-tertiary)',
                  fontSize: '11px', fontWeight: mode === m.id ? 500 : 400,
                  transition: 'all 0.12s ease',
                }}
              >
                <m.icon size={11} strokeWidth={2} />
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Theme Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
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
        <SectionTitle>Canvas</SectionTitle>

        {/* Grid type */}
        <div style={{ marginBottom: '12px' }}>
          <p style={{ fontSize: '10px', fontWeight: 500, color: 'var(--text-tertiary)', marginBottom: '6px', opacity: 0.6, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            Background
          </p>
          <div style={{ display: 'flex', gap: '8px' }}>
            <LayoutOption id="dots" label="Dots" icon={TableProperties} isActive={store.gridType === 'dots'} onClick={store.setGridType}>
              <div style={{
                width: '100%', height: '100%',
                backgroundImage: 'radial-gradient(var(--text-tertiary) 1px, transparent 1px)',
                backgroundSize: '8px 8px', opacity: 0.25,
              }} />
            </LayoutOption>
            <LayoutOption id="lines" label="Lines" icon={Grid3X3} isActive={store.gridType === 'lines'} onClick={store.setGridType}>
              <div style={{
                width: '100%', height: '100%',
                backgroundImage: 'linear-gradient(var(--text-tertiary) 0.5px, transparent 0.5px), linear-gradient(90deg, var(--text-tertiary) 0.5px, transparent 0.5px)',
                backgroundSize: '10px 10px', opacity: 0.12,
              }} />
            </LayoutOption>
            <LayoutOption id="none" label="None" icon={Eye} isActive={store.gridType === 'none'} onClick={store.setGridType}>
              <div style={{ width: '100%', height: '100%', background: 'var(--bg-primary)' }} />
            </LayoutOption>
          </div>
        </div>

        {/* Panel side */}
        <div style={{ marginBottom: '16px' }}>
          <p style={{ fontSize: '10px', fontWeight: 500, color: 'var(--text-tertiary)', marginBottom: '6px', opacity: 0.6, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            Panel Position
          </p>
          <div style={{ display: 'flex', gap: '8px' }}>
            <LayoutOption id="left" label="Left" icon={PanelLeft} isActive={store.layoutView === 'left'} onClick={store.setLayoutView}>
              <div style={{ width: '100%', height: '100%', display: 'flex' }}>
                <div style={{ width: '30%', height: '100%', background: 'var(--bg-tertiary)', borderRight: '1px solid var(--border-color)' }} />
                <div style={{ flex: 1 }} />
              </div>
            </LayoutOption>
            <LayoutOption id="right" label="Right" icon={PanelRight} isActive={store.layoutView === 'right'} onClick={store.setLayoutView}>
              <div style={{ width: '100%', height: '100%', display: 'flex' }}>
                <div style={{ flex: 1 }} />
                <div style={{ width: '30%', height: '100%', background: 'var(--bg-tertiary)', borderLeft: '1px solid var(--border-color)' }} />
              </div>
            </LayoutOption>
          </div>
        </div>

        {/* Workspace Controls */}
        <SettingsGroup>
          <SettingsRow
            icon={Eye}
            label="Mini-Map"
            description="Canvas overview in corner"
            rightElement={<AppleToggle value={store.showMinimap} onChange={store.setShowMinimap} />}
          />
          <SettingsRow
            icon={Grid3X3}
            label="Snap to Grid"
            description="Align elements precisely"
            borderBottom={false}
            rightElement={<AppleToggle value={store.isSnapToGrid} onChange={store.setSnapToGrid} />}
          />
        </SettingsGroup>

        <SettingsGroup>
          <SettingsRow
            icon={Zap}
            label="Motion"
            description="Animation speed preference"
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
