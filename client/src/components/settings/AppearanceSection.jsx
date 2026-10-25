import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Sun, Moon, Check, PanelLeft, PanelRight, Magnet, Grid, Sliders, Compass, Footprints } from 'lucide-react';
import useTutorStore from '../../store/tutorStore';
import { useTheme } from '../../context/useTheme';
import { SectionTitle, SettingsGroup, SettingsRow, AppleToggle, RightInlineSelect } from './SettingsShared';



// ─── Theme preview card ──────────────────────────────────────────────────────

const ThemePreviewCard = ({ theme, mode, isSelected, onClick }) => {
  const t = theme.colors[mode] || theme.colors.light;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isSelected}
      className="group relative flex w-full cursor-pointer flex-col gap-1.5 text-left focus:outline-none"
    >
      <div
        className={`relative aspect-[16/10] w-full overflow-hidden rounded-xl border transition-all duration-150 ${
          isSelected
            ? 'border-transparent shadow-[0_0_0_1.5px_var(--text-primary)]'
            : 'border-[var(--st-line-strong)] hover:border-[var(--text-tertiary)]'
        }`}
        style={{ background: t.bg }}
      >
        {/* Window header / mini traffic light dots */}
        <div
          className="absolute inset-x-0 top-0 flex h-3.5 items-center border-b px-2"
          style={{ borderColor: t.border || 'rgba(128,128,128,0.12)', background: t.surface }}
        >
          <div className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: '#ef4444', opacity: 0.75 }} />
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: '#f59e0b', opacity: 0.75 }} />
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: '#10b981', opacity: 0.75 }} />
          </div>
        </div>

        {/* Mini UI Layout */}
        <div className="absolute inset-0 top-3.5 flex">
          {/* Mini Sidebar */}
          <div
            className="flex h-full w-[28%] flex-col gap-1 border-r p-1.5"
            style={{ background: t.surface, borderColor: t.border || 'rgba(128,128,128,0.12)' }}
          >
            <div className="mb-0.5 h-2 w-2 rounded-[3px]" style={{ background: t.userBubble }} />
            <div className="h-[2px] w-[85%] rounded-full opacity-40" style={{ background: t.text }} />
            <div className="h-[2px] w-[60%] rounded-full opacity-25" style={{ background: t.textMuted }} />
            <div className="h-[2px] w-[75%] rounded-full opacity-20" style={{ background: t.textMuted }} />
          </div>

          {/* Mini Canvas */}
          <div
            className="relative flex h-full flex-1 flex-col justify-between p-2"
            style={{
              backgroundImage: `radial-gradient(${t.textMuted}25 0.5px, transparent 0.5px)`,
              backgroundSize: '6px 6px',
            }}
          >
            {/* AI Bubble */}
            <div
              className="w-[72%] rounded-[5px] p-1.5"
              style={{ background: t.aiBubble, border: `1px solid ${t.border || 'rgba(128,128,128,0.1)'}` }}
            >
              <div className="mb-1 h-[2px] w-full rounded-full opacity-60" style={{ background: t.aiBubbleText || t.text }} />
              <div className="h-[2px] w-[55%] rounded-full opacity-35" style={{ background: t.aiBubbleText || t.text }} />
            </div>

            {/* User Bubble */}
            <div
              className="mb-0.5 mt-auto self-end w-[55%] rounded-[5px] p-1.5"
              style={{ background: t.userBubble }}
            >
              <div className="h-[2px] w-full rounded-full opacity-75" style={{ background: t.userBubbleText || t.bg }} />
            </div>
          </div>
        </div>

        {/* Active Selection Checkmark Badge */}
        {isSelected && (
          <motion.span
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            className="absolute right-1.5 top-1.5 z-10 grid h-4 w-4 place-items-center rounded-full bg-[var(--text-primary)] text-[var(--bg-primary)] shadow-xs"
          >
            <Check size={9} strokeWidth={2.8} />
          </motion.span>
        )}
      </div>

      {/* Theme Name Only - No Description */}
      <span
        className={`px-0.5 text-[12px] tracking-[-0.01em] ${
          isSelected
            ? 'font-semibold text-[var(--text-primary)]'
            : 'font-medium text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]'
        }`}
      >
        {theme.name}
      </span>
    </button>
  );
};

// ─── Visual layout position card (minimal and compact) ───────────────────────

const PanelPositionCard = ({ id, label, icon: Icon, isSelected, onClick }) => (
  <button
    type="button"
    aria-pressed={isSelected}
    onClick={() => onClick(id)}
    className={`group relative flex flex-1 cursor-pointer flex-col gap-1.5 rounded-xl border p-2.5 text-left transition-all duration-150 ${
      isSelected
        ? 'border-transparent bg-[var(--st-surface)] shadow-[0_0_0_1.5px_var(--text-primary)]'
        : 'border-[var(--st-line-strong)] bg-[var(--st-fill)]/30 hover:border-[var(--text-tertiary)] hover:bg-[var(--st-fill-strong)]'
    }`}
  >
    {/* Minimal layout wireframe glyph */}
    <div className="relative h-8 w-full overflow-hidden rounded-lg border border-[var(--st-line)] bg-[var(--bg-primary)]">
      {id === 'left' ? (
        <div className="flex h-full w-full">
          <div className="h-full w-[32%] border-r border-[var(--st-line)] bg-[var(--text-primary)]/15" />
          <div className="flex flex-1 items-center justify-center">
            <span className="h-[2px] w-4 rounded-full bg-[var(--text-tertiary)]/25" />
          </div>
        </div>
      ) : (
        <div className="flex h-full w-full">
          <div className="flex flex-1 items-center justify-center">
            <span className="h-[2px] w-4 rounded-full bg-[var(--text-tertiary)]/25" />
          </div>
          <div className="h-full w-[32%] border-l border-[var(--st-line)] bg-[var(--text-primary)]/15" />
        </div>
      )}
    </div>

    {/* Label & Active State */}
    <div className="flex items-center justify-between px-0.5">
      <span
        className={`flex items-center gap-1.5 text-[12px] ${
          isSelected ? 'font-semibold text-[var(--text-primary)]' : 'font-medium text-[var(--text-secondary)]'
        }`}
      >
        <Icon size={12} strokeWidth={2} />
        {label}
      </span>

      {isSelected && (
        <span className="grid h-3.5 w-3.5 place-items-center rounded-full bg-[var(--text-primary)] text-[var(--bg-primary)]">
          <Check size={8} strokeWidth={3} />
        </span>
      )}
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
  }, [currentThemeId, mode, store.showGrid, store.layoutView, syncSettings]);

  return (
    <div className="flex flex-col gap-7 sm:gap-9 pt-1 sm:pt-4">
      {/* ── Theme ─────────────────────────────────────────── */}
      <section>
        <SectionTitle>
          Theme
        </SectionTitle>

        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
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
        <div className="flex max-w-[320px] gap-2.5">
          <PanelPositionCard
            id="left"
            label="Left"
            icon={PanelLeft}
            isSelected={store.layoutView === 'left'}
            onClick={store.setLayoutView}
          />
          <PanelPositionCard
            id="right"
            label="Right"
            icon={PanelRight}
            isSelected={store.layoutView === 'right'}
            onClick={store.setLayoutView}
          />
        </div>
      </section>

      {/* ── Workspace ─────────────────────────────────────────────── */}
      <section>
        <SectionTitle>Workspace</SectionTitle>
        <SettingsGroup className="rounded-2xl">
          <SettingsRow
            icon={Magnet}
            iconTone="purple"
            label="Snap to grid"
            rightElement={
              <AppleToggle
                label="Snap to grid"
                value={store.isSnapToGrid}
                onChange={store.setSnapToGrid}
              />
            }
          />
          <SettingsRow
            icon={Grid}
            iconTone="blue"
            label="Canvas grid"
            rightElement={
              <AppleToggle
                label="Canvas grid"
                value={store.showGrid}
                onChange={store.setShowGrid}
              />
            }
          />
          {store.showGrid && (
            <SettingsRow
              icon={Sliders}
              iconTone="amber"
              label="Grid pattern"
              rightElement={
                <RightInlineSelect
                  value={store.gridType || 'dots'}
                  onChange={store.setGridType}
                  options={[
                    { value: 'dots', label: 'Dot matrix' },
                    { value: 'lines', label: 'Grid graph' },
                  ]}
                />
              }
            />
          )}
          <SettingsRow
            icon={Compass}
            iconTone="emerald"
            label="Minimap overview"
            rightElement={
              <AppleToggle
                label="Minimap overview"
                value={store.showMinimap}
                onChange={store.setShowMinimap}
              />
            }
          />
          <SettingsRow
            icon={Footprints}
            iconTone="amber"
            label="Open code walkthroughs automatically"
            description="When you ask to step through or trace code, its walkthrough opens by itself. Off: the answer's Step through button is highlighted instead."
            rightElement={
              <AppleToggle
                label="Open code walkthroughs automatically"
                value={store.alertPrefs?.codeWalkthrough === 'auto'}
                onChange={(on) => store.setAlertPref('codeWalkthrough', on ? 'auto' : 'suggest')}
              />
            }
          />
        </SettingsGroup>
      </section>
    </div>
  );
}
