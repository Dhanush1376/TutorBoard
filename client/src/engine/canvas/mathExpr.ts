/**
 * mathExpr.ts — safe evaluator for plot expressions in x.
 *
 * The implementation lives with the scene validator so the server checks a
 * plot with exactly the evaluator that later draws it.
 */
export { compileExpr, exprError, samplePlot } from '../../../../server/engine/scene/expr';
export type { PlotSample } from '../../../../server/engine/scene/expr';
