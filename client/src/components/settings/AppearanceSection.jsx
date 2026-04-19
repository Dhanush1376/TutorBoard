import React, { useEffect } from 'react';
import { Sun, Moon, TableProperties, Grid3X3, PanelLeft, PanelRight, Check } from 'lucide-react';
import useTutorStore from '../../store/tutorStore';
import { useTheme } from '../../context/ThemeContext';
import { SectionTitle, SettingsGroup, SettingsRow } from './SettingsLayout';

const GridPreview = ({ type, isActive }) => {
  const isDots = type === 'dots';
  return (
    <div style={{
      width: '40px', height: '40px', borderRadius: '12px',
      border: '1px solid var(--border-color)', overflow: 'hidden',
      background: 'var(--bg-secondary)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: '6px',
      boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
      opacity: isActive ? 1 : 0.4, transition: 'all 0.2s',
    }}>
      {isDots ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', opacity: 0.6 }}>
          {[...Array(16)].map((_, i) => (
            <div key={i} style={{
              width: '2px', height: '2px', borderRadius: '50%',
              background: i === 10 ? 'var(--text-primary)' : 'var(--text-tertiary)',
              transform: i === 10 ? 'scale(1.5)' : 'none',
              boxShadow: i === 10 ? '0 0 4px var(--text-primary)' : 'none',
            }} />
          ))}
        </div>
      ) : (
        <div style={{ width: '100%', height: '100%', position: 'relative', opacity: 0.4 }}>
          <div style={{ position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)' }}>
            {[...Array(3)].map((_, i) => <div key={i} style={{ borderRight: '1px solid var(--text-tertiary)', height: '100%' }} />)}
          </div>
          <div style={{ position: 'absolute', inset: 0, display: 'grid', gridTemplateRows: 'repeat(4, 1fr)' }}>
            {[...Array(3)].map((_, i) => <div key={i} style={{ borderBottom: '1px solid var(--border-color)', width: '100%' }} />)}
          </div>
          <div style={{
            position: 'absolute', top: '50%', left: '50%', width: '6px', height: '6px',
            background: 'var(--text-primary)', borderRadius: '50%', transform: 'translate(-50%, -50%)',
            boxShadow: '0 0 4px var(--text-primary)',
          }} />
        </div>
      )}
    </div>
  );
};

const AppearanceSection = ({ syncSettings }) => {
  const store = useTutorStore();
  const { themes, currentThemeId, setCurrentThemeId, mode, toggleMode } = useTheme();

  useEffect(() => {
    const timeout = setTimeout(() => {
      syncSettings('appearance', {
        themeId: currentThemeId,
        mode,
        showMinimap: store.showMinimap,
        showGrid: store.showGrid,
        layoutView: store.layoutView,
        gridType: store.gridType
      });
    }, 1000);
    return () => clearTimeout(timeout);
  }, [currentThemeId, mode, store.showMinimap, store.showGrid, store.layoutView, store.gridType, syncSettings]);

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Theme</h3>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Appearance</span>
          </div>
          <button
            onClick={toggleMode}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 12px',
              background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)',
              borderRadius: '20px', cursor: 'pointer', transition: 'all 0.2s'
            }}
          >
            <div style={{
              padding: '6px', borderRadius: '50%',
              background: mode === 'light' ? 'var(--text-primary)' : 'transparent',
              color: mode === 'light' ? 'var(--bg-primary)' : 'var(--text-tertiary)',
              display: 'flex', alignItems: 'center'
            }}>
              <Sun size={14} />
            </div>
            <div style={{
              padding: '6px', borderRadius: '50%',
              background: mode === 'dark' ? 'var(--text-primary)' : 'transparent',
              color: mode === 'dark' ? 'var(--bg-primary)' : 'var(--text-tertiary)',
              display: 'flex', alignItems: 'center'
            }}>
              <Moon size={14} />
            </div>
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
          {themes.map((theme) => {
            const isSelected = currentThemeId === theme.id;
            const displayColors = theme.colors[mode];
            const nameParts = theme.name.split(' & ');

            return (
              <button
                key={`theme-opt-${theme.id}`}
                onClick={() => setCurrentThemeId(theme.id)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  padding: '16px 12px', borderRadius: '16px', border: '1px solid',
                  borderColor: isSelected ? 'var(--text-primary)' : 'var(--border-color)',
                  background: isSelected ? 'var(--bg-tertiary)' : 'transparent',
                  cursor: 'pointer', transition: 'all 0.2s', position: 'relative'
                }}
              >
                <span style={{
                  fontSize: '10px', fontWeight: 700, textAlign: 'center', lineHeight: 1.2,
                  marginBottom: '12px', color: isSelected ? 'var(--text-primary)' : 'var(--text-tertiary)'
                }}>
                  {nameParts[0]}<br />& {nameParts[1]}
                </span>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {[displayColors.bg, displayColors.surface, displayColors.text, displayColors.aiBubble].map((color, i) => (
                    <div key={i} style={{
                      width: '10px', height: '10px', borderRadius: '50%',
                      background: color, border: '1px solid rgba(0,0,0,0.1)'
                    }} />
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 16px 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Grid Settings</h3>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>Live Preview</span>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              {store.gridType.charAt(0).toUpperCase() + store.gridType.slice(1)} • {store.gridSize || 20}px
            </span>
          </div>
          <GridPreview type={store.gridType} isActive={true} />
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          {[
            { id: 'dots', label: 'Dots', icon: TableProperties },
            { id: 'lines', label: 'Lines', icon: Grid3X3 }
          ].map(type => {
            const isActive = store.gridType === type.id;
            return (
              <button
                key={type.id}
                onClick={() => store.setGridType(type.id)}
                style={{
                  flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  gap: '12px', padding: '20px', borderRadius: '20px', border: '1px solid',
                  borderColor: isActive ? 'var(--text-primary)' : 'var(--border-color)',
                  background: isActive ? 'var(--text-primary)' : 'var(--bg-tertiary)',
                  color: isActive ? 'var(--bg-primary)' : 'var(--text-secondary)',
                  cursor: 'pointer', transition: 'all 0.2s', position: 'relative'
                }}
              >
                {isActive && (
                  <div style={{
                    position: 'absolute', top: '10px', right: '10px',
                    width: '18px', height: '18px', borderRadius: '50%',
                    background: 'var(--bg-primary)', color: 'var(--text-primary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    <Check size={12} strokeWidth={4} />
                  </div>
                )}
                <type.icon size={24} strokeWidth={2.5} />
                <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{type.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 16px 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Layout View</h3>
        <div style={{ display: 'flex', gap: '12px' }}>
          {[
            { id: 'left', label: 'Standard (Left)', icon: PanelLeft },
            { id: 'right', label: 'Right Hand (Right)', icon: PanelRight }
          ].map(pos => {
            const isActive = store.layoutView === pos.id;
            return (
              <button
                key={`layout-pos-${pos.id}`}
                onClick={() => store.setLayoutView(pos.id)}
                style={{
                  flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  gap: '12px', padding: '20px', borderRadius: '20px', border: '1px solid',
                  borderColor: isActive ? 'var(--text-primary)' : 'var(--border-color)',
                  background: isActive ? 'var(--text-primary)' : 'var(--bg-tertiary)',
                  color: isActive ? 'var(--bg-primary)' : 'var(--text-secondary)',
                  cursor: 'pointer', transition: 'all 0.2s', position: 'relative'
                }}
              >
                {isActive && (
                  <div style={{
                    position: 'absolute', top: '10px', right: '10px',
                    width: '18px', height: '18px', borderRadius: '50%',
                    background: 'var(--bg-primary)', color: 'var(--text-primary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    <Check size={12} strokeWidth={4} />
                  </div>
                )}
                <pos.icon size={24} strokeWidth={2.5} />
                <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{pos.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default AppearanceSection;
