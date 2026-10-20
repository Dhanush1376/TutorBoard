import React, { useEffect } from 'react';
import { Sun, Moon, Check, PanelLeft, PanelRight, Magnet } from 'lucide-react';
import useTutorStore from '../../store/tutorStore';
import { useTheme } from '../../context/useTheme';
import { SectionTitle, SettingsGroup, SettingsRow, AppleToggle } from './SettingsShared';

// ─── Theme preview card ──────────────────────────────────────────────────────

const ThemePreviewCard = ({ theme, mode, isSelected, onClick }) => {
  const t = theme.colors[mode] || theme.colors.light;
  return (
    <button type="button" onClick={onClick} aria-pressed={isSelected} className="group flex w-full cursor-pointer flex-col gap-2.5 text-left">
      <div
        className={`relative aspect-[16/10] w-full overflow-hidden rounded-xl transition-shadow duration-200 ${
          isSelected
            ? 'shadow-[0_0_0_2px_var(--text-primary)]'
            : 'shadow-[0_0_0_1px_var(--st-line-strong)] group-hover:shadow-[0_0_0_1px_var(--text-tertiary)]'
        }`}
        style={{ background: t.bg }}
      >
        <div className="absolute inset-y-0 left-0 flex w-[28%] flex-col gap-1 p-2" style={{ background: t.surface, borderRight: `1px solid ${t.border}` }}>
          <div className="mb-1 h-2 w-2 rounded-[3px]" style={{ background: t.text, opacity: 0.5 }} />
          {[0.6, 0.4, 0.3].map((op, i) => (
            <div key={i} className="h-[3px] w-full rounded-sm" style={{ background: t.textMuted, opacity: op * 0.35 }} />
          ))}
        </div>
        <div
          className="absolute inset-y-0 left-[28%] right-0 p-2"
          style={{ backgroundImage: `radial-gradient(${t.textMuted}22 0.6px, transparent 0.6px)`, backgroundSize: '6px 6px' }}
        >
          <div className="mb-1.5 w-[60%] rounded-[6px_6px_6px_2px] px-[7px] py-[5px]" style={{ background: t.aiBubble }}>
            <div className="mb-[3px] h-[2px] w-full rounded-sm" style={{ background: t.textMuted, opacity: 0.3 }} />
            <div className="h-[2px] w-[70%] rounded-sm" style={{ background: t.textMuted, opacity: 0.2 }} />
          </div>
          <div className="ml-auto w-[45%] rounded-[6px_6px_2px_6px] px-[7px] py-[5px]" style={{ background: t.userBubble }}>
            <div className="h-[2px] w-full rounded-sm" style={{ background: t.userBubbleText, opacity: 0.4 }} />
          </div>
        </div>
        {isSelected && (
          <span className="absolute right-2 top-2 grid h-5 w-5 place-items-center rounded-full bg-[var(--text-primary)] text-[var(--bg-primary)]">
            <Check size={11} strokeWidth={3} />
          </span>
        )}
      </div>
      <span className={`px-0.5 text-[13px] tracking-[-0.01em] ${isSelected ? 'font-medium text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
        {theme.name}
      </span>
    </button>
  );
};

// ─── Visual option tile ──────────────────────────────────────────────────────

const OptionTile = ({ id, label, icon: Icon, isActive, onClick, children }) => (
  <button
    type="button"
    aria-pressed={isActive}
    onClick={() => onClick(id)}
    className={`flex flex-1 cursor-pointer flex-col gap-2.5 rounded-2xl border p-2.5 text-left transition-[border-color,background-color,box-shadow] ${
      isActive
        ? 'border-transparent bg-[var(--st-surface)] shadow-[0_0_0_2px_var(--text-primary)]'
        : 'border-[var(--st-line-strong)] hover:bg-[var(--st-fill)]'
    }`}
  >
    <div className="h-14 w-full overflow-hidden rounded-[10px] border border-[var(--st-line)] bg-[var(--bg-primary)]">{children}</div>
    <div className="flex items-center justify-between px-0.5">
      <span className={`flex items-center gap-2 text-[12.5px] ${isActive ? 'font-medium text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
        <Icon size={13} strokeWidth={1.9} />
        {label}
      </span>
      {isActive && <span className="h-1.5 w-1.5 rounded-full bg-[var(--mk-accent)]" />}
    </div>
  </button>
);

// ─── Main component ──────────────────────────────────────────────────────────

export default function AppearanceSection({ syncSettings }) {
  const store = useTutorStore();
  const { themes, currentThemeId, setCurrentThemeId, mode, toggleMode } = useTheme();

  // Persist changes with debounce
  useEffect(() => {
    const timeout = setTimeout(() => {
      syncSettings({
        appearance: {
          theme: mode, // Map 'mode' to 'theme' for DB
          themeId: currentThemeId,
          showGrid: store.showGrid,
          layoutView: store.layoutView,
        },
      });
    }, 300);
    return () => clearTimeout(timeout);
  }, [currentThemeId, mode, store.showGrid, store.layoutView]);

  return (
    <div className="flex flex-col gap-8">
      {/* ── Mode + theme ─────────────────────────────────────────── */}
      <section>
        <SectionTitle
          action={
            <div role="radiogroup" aria-label="Colour mode" className="flex rounded-full border border-[var(--st-line-strong)] p-0.5">
              {[
                { id: 'light', icon: Sun, label: 'Light' },
                { id: 'dark', icon: Moon, label: 'Dark' },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  role="radio"
                  aria-checked={mode === m.id}
                  onClick={() => mode !== m.id && toggleMode()}
                  className={`inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-full px-3 text-[12px] transition-colors ${
                    mode === m.id ? 'bg-[var(--text-primary)] font-medium text-[var(--bg-primary)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <m.icon size={12} strokeWidth={2} />
                  {m.label}
                </button>
              ))}
            </div>
          }
        >
          Theme
        </SectionTitle>

        <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-4">
          {themes.map((theme) => (
            <ThemePreviewCard
              key={theme.id}
              theme={theme}
              mode={mode}
              isSelected={currentThemeId === theme.id}
              onClick={() => setCurrentThemeId(theme.id)}
            />
          ))}
        </div>
      </section>

      {/* ── Panel position ────────────────────────────────────────── */}
      <section>
        <SectionTitle>Panel position</SectionTitle>
        <div className="flex gap-2.5">
          <OptionTile id="left" label="Left" icon={PanelLeft} isActive={store.layoutView === 'left'} onClick={store.setLayoutView}>
            <div className="flex h-full w-full">
              <div className="h-full w-[30%] border-r border-[var(--st-line)] bg-[var(--st-fill-strong)]" />
            </div>
          </OptionTile>
          <OptionTile id="right" label="Right" icon={PanelRight} isActive={store.layoutView === 'right'} onClick={store.setLayoutView}>
            <div className="flex h-full w-full justify-end">
              <div className="h-full w-[30%] border-l border-[var(--st-line)] bg-[var(--st-fill-strong)]" />
            </div>
          </OptionTile>
        </div>
      </section>

      {/* ── Workspace ─────────────────────────────────────────────── */}
      <section>
        <SectionTitle>Workspace</SectionTitle>
        <SettingsGroup>
          <SettingsRow
            icon={Magnet}
            label="Snap to grid"
            rightElement={<AppleToggle label="Snap to grid" value={store.isSnapToGrid} onChange={store.setSnapToGrid} />}
          />
        </SettingsGroup>
      </section>
    </div>
  );
}
