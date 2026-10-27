import React, { useCallback, useRef, useState } from 'react';
import { ChevronLeft, RotateCcw, SlidersHorizontal } from 'lucide-react';

/** "m/s^2" → "m/s²", "deg" → "°" — units as they are read, not typed. */
const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
const prettyUnit = (u = '') => (u === 'deg' ? '°' : u.replace(/\^(-?\d+)/g, (_, p) => [...p].map((c) => SUP[c]).join('')).replace(/\*/g, '·').replace(/\bohm\b/g, 'Ω'));

/** 3 significant figures, or the quantity's own decimals. */
const show = (v, digits) => {
  if (!Number.isFinite(v)) return '–';
  if (digits !== undefined) return v.toFixed(digits);
  const a = Math.abs(v);
  return a !== 0 && (a >= 1e5 || a < 1e-3) ? v.toExponential(2) : String(Number(v.toPrecision(3)));
};
const withUnit = (v, unit) => (unit === 'deg' ? `${v}°` : unit ? `${v} ${prettyUnit(unit)}` : v);
/** Decimals a slider value needs for its step (0.5 → 1, 0.01 → 2). */
const stepDigits = (step) => (step && step < 1 ? Math.min(4, Math.ceil(-Math.log10(step) - 1e-9)) : 0);

/**
 * Sliders for a lesson's parameters (Scene Language `params`), with the
 * derived quantities they give. Moving a slider redraws the board at the same
 * moment of the lesson; updates are coalesced so a fast drag never queues
 * more than one rebuild behind the one running. `onChange` gets the values
 * once the board shows them (to keep them with the lesson).
 */
export default function ParamPanel({ engine, style, open = true, onToggle, onChange }) {
  // the stage remounts this per lesson build (key), so the initial read is always current
  const [state, setState] = useState(() => engine?.paramState ?? null);
  const pending = useRef(null);
  const running = useRef(false);

  const flush = useCallback(async () => {
    if (running.current || !engine) return;
    running.current = true;
    try {
      while (pending.current) {
        const values = pending.current;
        pending.current = null;
        await engine.setParams(values);
      }
    } finally { running.current = false; }
    const next = engine.paramState;
    setState(next);
    onChange?.(next.values);
  }, [engine, onChange]);

  const change = (id, value) => {
    setState((s) => (s ? { ...s, values: { ...s.values, [id]: value } } : s));
    pending.current = { ...(pending.current ?? {}), [id]: value };
    flush();
  };

  const sliders = (state?.params ?? []).filter((p) => p.max > p.min);
  if (!engine || !sliders.length) return null;
  const constants = state.params.filter((p) => p.max === p.min);
  const atDefaults = sliders.every((p) => state.values[p.id] === p.value);

  if (!open) {
    return (
      <button
        type="button"
        data-no-pan
        onClick={onToggle}
        aria-expanded="false"
        className="absolute z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-full liquid-glass shadow-premium text-[12px] font-semibold text-[var(--text-primary)] hover:brightness-110 transition"
        style={style}
      >
        <SlidersHorizontal size={13} className="text-amber-400" /> Try it · {sliders.length} slider{sliders.length > 1 ? 's' : ''}
      </button>
    );
  }

  return (
    <div
      data-no-pan
      role="group"
      aria-label="Lesson parameters"
      className="absolute z-20 w-[min(256px,calc(100%-32px))] rounded-2xl liquid-glass shadow-premium px-4 py-3 select-none text-[var(--text-primary)]"
      style={{ cursor: 'default', ...style }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-tertiary)]">Try it</span>
        <span className="flex items-center gap-1">
        <button
          type="button"
          disabled={atDefaults}
          onClick={() => sliders.forEach((p) => change(p.id, p.value))}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[11px] font-medium text-[var(--text-tertiary)] enabled:hover:text-[var(--text-primary)] enabled:hover:bg-white/10 disabled:opacity-40 transition-colors"
          title="Back to the lesson's values"
        >
          <RotateCcw size={11} /> Reset
        </button>
        {onToggle && (
          <button
            type="button"
            onClick={onToggle}
            aria-expanded="true"
            aria-label="Hide the sliders"
            className="p-1 rounded-full text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-white/10 transition-colors"
          >
            <ChevronLeft size={13} />
          </button>
        )}
        </span>
      </div>
      {sliders.map((p) => {
        const v = state.values[p.id];
        const text = withUnit(show(v, stepDigits(p.step)), p.unit);
        return (
          <label key={p.id} className="block mb-2.5 last:mb-1">
            <span className="flex items-baseline justify-between text-[12px] mb-1">
              <span className="text-[var(--text-secondary)]">{p.label ?? p.id}</span>
              <span className="font-mono font-semibold tabular-nums">{text}</span>
            </span>
            <input
              type="range"
              className="w-full h-6 accent-amber-400 cursor-pointer"
              min={p.min}
              max={p.max}
              step={p.step ?? (p.max - p.min) / 100}
              value={v}
              aria-valuetext={String(text)}
              onChange={(e) => change(p.id, Number(e.target.value))}
            />
          </label>
        );
      })}
      {(state.derived.length > 0 || constants.length > 0) && (
        <dl className="mt-1 pt-2 border-t border-white/10 grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 text-[12px]" aria-live="polite">
          {state.derived.map((d) => (
            <React.Fragment key={d.id}>
              <dt className="text-[var(--text-secondary)]">{d.label ?? d.id}</dt>
              <dd className="font-mono font-semibold tabular-nums text-right">{withUnit(show(d.value, d.digits), d.unit)}</dd>
            </React.Fragment>
          ))}
          {constants.map((p) => (
            <React.Fragment key={p.id}>
              <dt className="text-[var(--text-tertiary)]">{p.label ?? p.id}</dt>
              <dd className="font-mono tabular-nums text-right text-[var(--text-tertiary)]">{withUnit(show(p.value), p.unit)}</dd>
            </React.Fragment>
          ))}
        </dl>
      )}
    </div>
  );
}
