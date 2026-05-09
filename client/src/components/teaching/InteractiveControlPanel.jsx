import React, { useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Sliders, Zap, RefreshCw } from 'lucide-react';
import useTutorStore from '../../store/tutorStore';

/**
 * InteractiveControlPanel — Slider controls for formula variables.
 * All colors via CSS variables.
 */

function evaluateFormula(formula, vars) {
  if (!formula) return null;
  let expr = formula;
  const sortedKeys = Object.keys(vars).sort((a, b) => b.length - a.length);
  sortedKeys.forEach(k => { expr = expr.replace(new RegExp(`\\b${k}\\b`, 'g'), vars[k]); });
  expr = expr.replace(/\^/g, '**');
  const fns = ['sqrt', 'sin', 'cos', 'tan', 'log', 'exp', 'abs', 'round', 'ceil', 'floor', 'PI', 'E'];
  fns.forEach(fn => { expr = expr.replace(new RegExp(`\\b${fn}\\b`, 'g'), `Math.${fn}`); });
  try { return new Function(`return ${expr}`)(); } catch { return null; }
}

const InteractiveControlPanel = ({ data }) => {
  const { formula, controls = [] } = data || {};
  const values = useTutorStore(s => s.interactiveValues);
  const setVal = useTutorStore(s => s.setInteractiveValue);
  const resetVals = useTutorStore(s => s.resetInteractiveValues);

  useEffect(() => {
    controls.forEach(c => {
      const id = c.formula_var || c.id;
      if (values[id] === undefined) setVal(id, c.initial ?? c.min ?? 0);
    });
  }, [controls, values, setVal]);

  const result = useMemo(() => evaluateFormula(formula, values), [formula, values]);

  const handleReset = () => {
    resetVals();
    controls.forEach(c => setVal(c.formula_var || c.id, c.initial ?? c.min ?? 0));
  };

  if (!controls.length) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}
      className="w-full rounded-xl overflow-hidden liquid-glass"
      style={{ boxShadow: '0 4px 16px -4px rgba(0,0,0,0.08)' }}>

      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between"
        style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--bg-tertiary)' }}>
        <div className="flex items-center gap-2">
          <Sliders size={14} style={{ color: 'var(--text-tertiary)' }} />
          <div>
            <h3 className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>Try it yourself</h3>
            <p className="text-[9px] uppercase tracking-widest" style={{ color: 'var(--text-tertiary)' }}>Interactive</p>
          </div>
        </div>
        <button onClick={handleReset} className="p-1.5 rounded-lg transition-all hover:bg-[var(--bg-tertiary)] active:scale-90"
          style={{ color: 'var(--text-tertiary)' }} title="Reset values">
          <RefreshCw size={13} />
        </button>
      </div>

      {/* Sliders */}
      <div className="p-4 flex flex-col gap-5">
        {controls.map(ctrl => {
          const id = ctrl.formula_var || ctrl.id;
          const val = values[id] !== undefined ? values[id] : (ctrl.initial ?? ctrl.min ?? 0);
          return (
            <div key={ctrl.id} className="flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-medium uppercase tracking-wider"
                  style={{ color: 'var(--text-tertiary)' }}>{ctrl.label}</label>
                <span className="text-xs font-mono px-1.5 py-0.5 rounded"
                  style={{ color: 'var(--text-primary)', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)' }}>
                  {val.toFixed(ctrl.step < 1 ? 2 : 0)}
                </span>
              </div>
              <input type="range" min={ctrl.min} max={ctrl.max} step={ctrl.step || 1} value={val}
                onChange={(e) => setVal(id, parseFloat(e.target.value))}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer playback-scrubber"
                style={{ background: 'var(--bg-tertiary)' }} />
            </div>
          );
        })}
      </div>

      {/* Result */}
      {formula && (
        <div className="px-4 py-4 flex flex-col gap-3"
          style={{ borderTop: '1px solid var(--border-color)', background: 'var(--bg-primary)' }}>
          <div className="flex items-center gap-1.5 text-[9px] font-medium uppercase tracking-widest"
            style={{ color: 'var(--text-tertiary)' }}>
            <Zap size={11} /> Result
          </div>
          <div className="text-[10px] font-mono truncate" style={{ color: 'var(--text-tertiary)' }}>
            {formula}
          </div>
          <div className="text-2xl font-mono" style={{ color: 'var(--text-primary)' }}>
            {result !== null ? (
              <motion.span key={result} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
                {typeof result === 'number' ? result.toFixed(2) : String(result)}
              </motion.span>
            ) : (
              <span className="text-sm italic" style={{ color: 'var(--text-tertiary)' }}>Invalid</span>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default InteractiveControlPanel;
