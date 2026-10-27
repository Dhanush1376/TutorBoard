# Universal Visual Engine — audit, plan and phase reports

Brief: make the maths visual quality the floor for every subject, with visuals
generated from the question, validated, deterministic to render and persisted.
This file records what the code actually does (2026-10-26), the plan built on
it, and a report per phase. Day-to-day engine progress stays in
[`VISUAL_ENGINE_CHECKLIST.md`](VISUAL_ENGINE_CHECKLIST.md); the format is
[`SCENE_LANGUAGE.md`](SCENE_LANGUAGE.md).

---

## Phase 0 — Audit

### The main finding

**There is no separate "maths engine" to extend.** Since 2026-10-10 every lesson,
in every subject, goes through one cross-domain pipeline, Engine v2: the model
writes a **Scene Language v1** scene (typed JSON: entities, layout relations,
cartesian spaces, beats of actions), the server validates and repairs it, and
the client engine draws and animates it deterministically. Maths looks best
because its primitives (`plot`, `polygon`, `angle`, `point`, spaces with ticks)
are the most complete and geometry is computed by intent, not because it has its
own pipeline.

So the brief's target architecture (intent → plan → structured spec → schema
validation → domain validation → deterministic render → persistence) **already
exists in this shape**, minus one stage: *domain validation*. Structural
validation is strong (ids, references, data-structure simulation, geometry
agreement); scientific truth was checked only for geometry (stated angles vs the
drawing). Phase 1 adds that stage as a registry. Rewriting the pipeline, or
adding parallel per-subject engines, would duplicate a working system.

### Pipeline map (question → pixels → saved)

| Stage | Where |
|---|---|
| Question in (chat) | `client/src/store/slices/conversationSlice.js` → `POST /api/chat/stream` → `server/services/chat/orchestrator.ts` |
| Question in (Deep Visual Dive) | socket `session:start` → `server/sockets/handlers/session.js` → `server/engine/scene/lesson.ts` |
| Subject guess / learner level | `guessDomain`, `buildPlannerMessages` in `server/engine/scene/prompt.ts` (picks one golden example per domain) |
| Model call | `requestCompletion` in `server/utils/ai/llmClient.ts`; routing in `modelRegistry.ts` (Gemini flash default, Groq/OpenRouter fallback, circuit breaker) |
| Structured output | JSON mode; streamed, partial scenes emitted as beats close (`progressive.ts`) |
| Parse + deterministic repair | `coerce.ts` (synonyms, escaping, LaTeX), `plainMath.ts` |
| Geometry by intent | `resolveGeometry.ts` (shared with the client) |
| Schema | `schema.ts` (Zod, discriminated unions, hard limits: 60 entities, 12 beats, 24 actions/beat) |
| Semantic validation | `validate.ts` (refs, sim of data structures, use-before-create autofix) |
| **Domain validation (new)** | `domainChecks.ts` → `chem.ts`, `expr.ts` |
| Repair loop | `planner.ts`: ≤ 2 repair rounds with `formatIssuesForRepair`; cut-off replies restart compact |
| Client contract | `client/src/scene/types.ts` (type-only import of the server schema), `normalize.ts` |
| Render | `client/src/scene/`: `simulate` → `measure` → `layout` (relation solver, no overlaps) → `render/board.ts` + `render/spatial.ts` (SVG) → `compile.ts` (one seekable GSAP timeline) |
| Lesson UI | `client/src/components/canvas/SceneV2Stage.jsx` in `TeachingSession.jsx` (play/pause/step/seek/replay, reduced motion, click-to-ask) |
| Follow-ups | doubts as branches of the lesson: `server/engine/scene/doubt.ts` |
| Persistence | chat message saves `visuals` + `canvasSnapshot` (`chat.service.ts`); restored via `artifactSlice.js` / `Home.jsx`; covered by `server/tests/visualArtifactPersistence.test.ts` (save/reload, refresh hydration with sceneV2, session isolation, payload integrity, legacy messages) |
| Code tracing (separate, real execution) | `client/src/visualizer/` (JS worker, Pyodide), `server/visualizer/` (C/C++/Java instrumented) |

### Baseline (before any change, 2026-10-26)

| Check | Result |
|---|---|
| Server tests (vitest) | 317 passed, 1 failed, 23 skipped — the failure, `scenePlanner › streams valid partial scenes`, is a 5 s timeout under load; it passes alone (and in the later full run) |
| Client tests (vitest) | 209 passed, 1 failed — `traceModel › Python tracer … stops endless loops`, 5 s timeout under load (Pyodide); passes in the later full run |
| Server typecheck (`tsc --noEmit`) | clean |
| Engine typecheck (`tsconfig.scene.json`) | clean |
| Working tree | ~138 files already modified by other in-progress work; none of the files this phase touches had uncommitted edits |

Both baseline failures are pre-existing timing flakes, not regressions.

### Capability matrix (verified against code, not docs)

✅ verified (code + test or render) · 🟡 partial · ❌ missing · — n/a

| Capability | State | Evidence / gap |
|---|---|---|
| Cartesian plots of f(x) | ✅ | `plot` + safe evaluator; goldens |
| Several series in one space | 🟡 → ✅ | labels were silently dropped; now drawn in the series colour at a spot clear of other labels (Phases 1–2). `primary` and `warning` tones are the same amber by palette design |
| Discontinuities / asymptotes | ❌ → ✅ | fixed 200 samples, poles joined by a straight line; now adaptive sampling + breaks (Phase 1) |
| Parametric / polar curves | ❌ → ✅ | `curve` (Phase 2) |
| Implicit curves | ❌ | not started |
| Log axes | ❌ → ✅ | `xScale`/`yScale: "log"` (Phase 2) |
| Shading, reference lines | ❌ → ✅ | `area`, `refline` (Phase 2) |
| Point-on-curve / root / extremum checks | ❌ → ✅ | `point-on-curve` domain check (Phase 2) |
| Error bars, histograms, heatmaps, vector fields | ❌ | not started |
| Coordinate geometry, polygons, angles | ✅ | geometry by intent, angle agreement check |
| Vectors / free-body diagrams | ✅ | `vector` with along/perp, common force scale (`incline-forces.json`) |
| Projectile / simulation with sliders | 🟡 → ✅ | `params` + `derived` + bindings; sliders in the lesson UI (Phase 3) |
| Units / dimensional checks | ❌ → ✅ | SI units on parameters and axes, dimension of every bound expression checked (Phase 3) |
| Circuits (connectivity, KCL/KVL) | ❌ → ✅ | `circuit` entity, schematic layout, nodal-analysis solve, RC transients (Phase 8) |
| Digital logic, truth tables | ❌ → ✅ | `logic` entity, evaluation, truth-table checking (Phase 8) |
| Beams: reactions, SFD, BMD | ❌ → ✅ | `beam` computed trace (Phase 8) |
| AC circuits, op-amps, transistors, timing diagrams, mechanisms, stress–strain models | ❌ | not started |
| Molecules — small, acyclic | ✅ | VSEPR placement, lone pairs |
| Molecules — rings / aromatics | ❌ → ✅ | BFS tree layout stretched the ring-closing bond; now regular polygons, fused rings, substituents outward (Phase 1) |
| Valence / charge / formula checks | ❌ → ✅ | none; now valence per formal charge, duplicate bonds, formula label vs atoms (Phase 1) |
| Stereo (wedge/dash) | ❌ → ✅ | bond style + stereocentre projection (Phase 4) |
| Curved-arrow mechanisms | ❌ → ✅ | `curly` anchored to lone pairs, bonds and atoms, with electron-flow rules (Phase 4) |
| Reactions with atom balance | ❌ → ✅ | `reaction` with coefficients, element + charge balance (Phase 4) |
| Reaction intermediates / transition states, CIP (R/S) labels, skeletal display | ❌ | not started |
| Reaction-coordinate / titration plots | 🟡 | drawable as `plot`, no chemistry-specific checks |
| Biology structures (cells, organs) | 🟡 → ✅ | `compartment`: nested regions, leader-line labels, structure rules (Phase 5) |
| Anatomical drawings (true shapes of organs, cross-sections) | ❌ | compartments are schematic; no organ outlines or flow paths yet |
| Processes / flows / state machines | 🟡 | `graph` (directed, layered) + connectors with routing |
| Arrays, stacks, queues, lists, trees, heaps, graphs, tables | ✅ | simulated beat by beat for bounds |
| Algorithm traces | 🟡 → ✅ | computed by reference implementations for 12 algorithms (Phase 6); other algorithms are still model-written (bounds-checked) |
| Neural nets | ✅ | `network` from the requested `layers` — sizes come from the question |
| Gradient descent, k-means, confusion matrix, least squares, perceptron boundary | 🟡 → ✅ | computed from the objective / data / labels (Phase 7); generated data marked illustrative |
| Training curves of real models, attention maps, embeddings | ❌ | no model is run; not started |
| Animation, step, seek, replay, reduced motion | ✅ | `compile.ts`, `SceneV2Stage` |
| Persistence / restore / reopen | ✅ | `visualArtifactPersistence.test.ts` (8 cases); every golden stored and reopened (`scenePersistence.test.ts`); step and slider values restored after refresh, checked live for all 33 goldens (Phase 9) |
| Malformed output | ✅ | repair loop, coercion, "no placeholder scenes"; render now also survives a bad plot expression |
| Responsive / camera fit | ✅ | fit-to-content, insets; mobile layout not re-verified in this phase |

### Risks and debt found

1. **Plot expression contract was inconsistent.** The schema's own example used
   `tan(45deg)`, which the evaluator rejected — and the renderer called it with
   no `try`, so a model that followed the example could crash a lesson. Fixed.
2. **Scientific truth wasn't checked.** A five-bonded carbon or a formula label
   that disagrees with the atoms passed validation. Fixed for molecules;
   physics units and circuit laws remain.
3. **Plot cut-off at the frame edge** left the curve stopping one sample short,
   and the top-margin test used `y1 * 1.05` (wrong for negative ranges). Fixed.
4. **Highlighting a hydrogen erased its letter** (light text on the white ball). Fixed.
5. **Free-tier AI quota** is the limiting factor for live evals (Groq ≈ 25
   lessons/day); 30 of 48 eval questions have never been measured on v2.
6. The god files (`Home.jsx`, `conversationSlice.js`) are being edited by other
   work right now; this plan doesn't touch them.

### Dependencies

Reuse: Zod (schemas), GSAP (timeline), KaTeX (maths), the existing SVG layer,
Playwright (headless shots). **Added: none.** RDKit (RDKit.js, ~7 MB wasm, BSD)
was considered for chemistry; the checks needed now (valence, rings, formula)
are a few hundred lines and run identically on server and client, so it is
deferred until stereochemistry or name → structure resolution needs it.

---

## Plan

Phases follow the brief's order but are cut to what the code lacks. Each phase
must keep every golden scene valid with zero warnings and the full server and
client suites green.

| Phase | Scope | Exit gate |
|---|---|---|
| **1 — Domain validation foundation** ✅ | `domainChecks.ts` registry wired into `validateScene` (errors feed the existing repair loop); shared safe evaluator with discontinuity-aware sampling; chemistry checks + ring layout; formal charges | Goldens valid; new checks tested; benzene → toluene renders as true hexagons; tan x breaks at poles |
| **2 — Plotting** ✅ | `curve` (parametric, polar), log axes, `area`, `refline`, point-on-curve / root / turning-point checks, collision-aware labels | Maths goldens unchanged; new goldens for area under a curve, decay on linear + log axes, parametric + polar |
| **3 — Physics parameters** ✅ | `params`/`derived` with SI units, bindings, sliders, dimensional analysis, range sweep | Changing v0 changes range/apex exactly; changing amplitude leaves the period alone (metamorphic tests) |
| **4 — Chemistry** ✅ | Wedge/dash bonds, `reaction` with balance, `curly` electron-pushing arrows, bond/lone-pair parts, case-correct formula labels | Atom balance enforced; arrows only start at a lone pair or bond and end at an atom or bond |
| **5 — Biology** ✅ | `compartment` (nested labelled regions), leader-line labels, label-coverage and structure checks | Plant cell and prokaryote/eukaryote goldens with no label overlaps or crossing leaders |
| **6 — Computed algorithm traces** ✅ | `compute` beats → traces from reference implementations; DP table cells; callout fixes | Traces equal hand-computed results; goldens for binary search, sliding window, BFS, Dijkstra, LCS |
| **7 — ML computed data** ✅ | Gradient descent, k-means, confusion matrix, linear regression, perceptron via `compute`; illustrative marker + provenance | No metric shown that wasn't computed |
| **8 — Engineering** ✅ | `circuit` + nodal solve + RC, `logic` + truth-table checks, beam SFD/BMD | Computed currents, τ, truth tables and moments match hand solutions |
| **9 — Persistence** ✅ | Slider values saved with the lesson position; reopen restores step and sliders; round-trip for every golden; live refresh/reopen for every domain | Every golden reopens at the step and slider values it was left at |
| 10–11 | Full 48-question eval rerun when quota allows, mobile viewport suite, perf + security review, readiness report | Per the brief |

---

## Phase 1 report — domain validation foundation (2026-10-26)

**Objective.** Add the missing pipeline stage — deterministic domain checks
whose errors go back to the model like any other validation error — and fix the
two places where maths and chemistry drawings could be wrong while looking right.

**Decisions.**
- Domain checks are a registry keyed by entity type (`DOMAIN_CHECKS`), run once
  at the end of `validateScene`. New subjects add an entry; the validator, the
  repair loop, streaming and doubts need no change.
- The plot evaluator moved to `server/engine/scene/expr.ts` and the client
  re-exports it, so the server checks a plot with exactly the code that draws it.
- No new dependency (see above).
- Only additive schema change: optional `charge` on molecule atoms. Saved
  scenes without it load unchanged.

**Files.**

| File | Change |
|---|---|
| `server/engine/scene/expr.ts` (new) | Safe evaluator (moved from the client) + `45deg`/`°`/`π`, inverse/hyperbolic trig, floor/ceil/sign, operand-count check; `samplePlot`: adaptive bisection, breaks at poles and jumps, cut at the frame edge, visible share |
| `server/engine/scene/chem.ts` (new) | `maxBonds` from group electrons and formal charge (octet for period 2, expanded above), `checkMolecule`, Hill `formulaOf`, `parseFormula` (subscripts, `^2-`, `²⁻`, parentheses), `formulaMismatch`, `findRings` (smallest rings, fused envelope dropped) |
| `server/engine/scene/domainChecks.ts` (new) | Registry: `plot-on-screen` (evaluates; error if never inside the space, warning if < 15 % visible), `molecule-valence` (valence, duplicates, formula label) |
| `server/engine/scene/validate.ts` | Runs domain checks; allows `°` in plot expressions |
| `server/engine/scene/schema.ts` | Optional atom `charge`; bond description asks for every ring bond in Kekulé form |
| `server/engine/scene/prompt.ts` | Molecule line: charges, draw every H, Kekulé rings, valence is checked |
| `server/engine/scene/fixtures/benzene-to-toluene.json` (new) | Golden: benzene → toluene with the methyl on C2 |
| `client/src/engine/canvas/mathExpr.ts` | Re-exports the shared evaluator |
| `client/src/scene/render/spatial.ts` | Plots use `samplePlot`; bad expression draws nothing instead of throwing; plot labels drawn |
| `client/src/scene/geometry.ts` | Ring-aware `moleculeLayout` (regular polygons, fused rings across the shared edge, substituents radially out, CH₂ hydrogens fanned); acyclic molecules keep the VSEPR path |
| `client/src/scene/render/board.ts` | Formal charge badges; highlighted hydrogens keep their letter |
| `server/tests/sceneDomain.test.ts` (new) | 16 tests: evaluator, sampling, valence, rings, formulas, validator integration |
| `client/src/scene/__tests__/molecule.test.ts` (new) | 5 tests: benzene, toluene, naphthalene, cyclohexane (bond lengths ±2 %, no atom overlaps), water unchanged |
| `server/tests/scene.test.ts` | Golden list includes the new scene |

**Results.**

| Check | Result |
|---|---|
| Server tests | 339 passed, 19 skipped, 0 failed |
| Client tests | 217 passed, 0 failed (engine subset re-run after the last render edits: 41/41) |
| Server + engine typecheck | 0 errors |
| Goldens | 11/11 valid, zero warnings; all build and play in the jsdom render test |
| Headless renders (Scene Lab, Playwright) | benzene/toluene: regular hexagons, H radial, CH₃ on C2; `tan x` + `1/(x-1)`: separate branches, no line across any pole, labels in series colours; NH₄⁺ / OH⁻ charges shown; projectile golden unchanged |
| Client production build | `vite build` succeeds (11.96 s; the existing >500 kB chunk warning only) |

**Not verified.** No live AI run (quota); whether models now write Kekulé rings
and charges unprompted is unmeasured. Mobile viewport not re-checked. 4-coordinate
centres (NH₄⁺, CH₄) are still drawn as a flat cross, not a tetrahedron projection.

**Next: Phase 2** (plotting) — parametric/polar forms, log axes, shading,
reference lines, and "this point lies on that curve" checks.

---

## Phase 2 report — plotting (2026-10-26)

**Objective.** The plotting forms the audit found missing, each with a check
that the drawing agrees with the maths: parametric and polar curves, log axes,
shaded regions, reference lines, and points that claim to be on a curve.

**Decisions.**
- New entity types rather than options on `plot` (`curve`, `area`, `refline`):
  the schema stays a discriminated union, so each type's fields are required
  where they matter and invalid mixes can't be written. Coercion repairs the
  common mix-ups (`curve` with `expr` → `plot`; `plot` with `x`/`y` or `r` → `curve`;
  `asymptote`, `threshold`, `shading`, `parametric`, `polar` aliases).
- Log scales live on the space (`xScale`/`yScale`); every entity in it maps
  through the same `toPx`, so points, vectors and labels follow automatically.
  Sampling on a log axis happens in log units (smooth curves, exact values).
- Point-on-curve is checked against what is drawn (the sampled curve), with
  label keywords ("root", "vertex", "max", "half-life"…) or an explicit `on`
  marking the claim. Unlabelled points are never checked, so free annotation
  stays free. The repair message carries the computed answer
  (`f(1.5) = -0.75`, `it turns at x ≈ 2.4, y ≈ -1`), so one repair round fixes it.
- Found while rendering: highlighting a point, polygon vertex or shaded region
  painted it with the dark card fill used for boxes, so a highlighted point
  vanished (pre-existing; affected every lesson that highlights a point). Spatial
  fills now take the state's accent colour (`Paint.accentFill`).
- Labels in a space now take the first clear spot from a list of candidates
  (curve end, curve top, back along the curve; around a point; along a
  reference line), avoiding other labels, axis titles, dots and bodies. This
  also fixed the projectile golden's "range 40.8 m" sitting on the "x (m)" title.

**Files.**

| File | Change |
|---|---|
| `server/engine/scene/expr.ts` | Variable `t`/`θ`/`theta`; log-aware `samplePlot`; `sampleCurve` (adaptive, clipped to the frame with Liang–Barsky); `frameDistance`; `constantOf` ("2pi"); `curveFns` (parametric/polar → x(t), y(t)) |
| `server/engine/scene/schema.ts` | `xScale`/`yScale`; `point.on`; `curve`, `area`, `refline` entities |
| `server/engine/scene/validate.ts` | Log range > 0; curve form; area bounds are plots in the same space; refline needs one of x/y; `on` target; trace along a curve |
| `server/engine/scene/domainChecks.ts` | `curve-on-screen`, `area-bounds`, `refline-inside`, `point-on-curve` (on-curve, root, turning point with exact location); plot check honours log axes |
| `server/engine/scene/coerce.ts` | plot ↔ curve repairs, new aliases, `t` from `domain`/`theta`/`range` |
| `server/engine/scene/prompt.ts` | Lines for log scales, `on`, `curve`, `area`, `refline` (≈150 tokens) |
| `server/engine/scene/fixtures/area-under-curve.json`, `radioactive-decay.json`, `parametric-polar.json` (new) | Goldens |
| `client/src/scene/geometry.ts` | Log `makeSpace` + `logTicks`; `SpaceMap.log` |
| `client/src/scene/render/spatial.ts` | Renderers for `curve`, `area` (behind its space's curves), `refline`; log tick labels (10⁴…); `freeSpot` label placement; axis titles, dots and bodies reserve their space |
| `client/src/scene/render/types.ts`, `compile.ts` | `accentFill` highlight; draw-on for curves/reflines |
| `client/src/scene/normalize.ts` | New types known to the client |
| `server/tests/sceneDomain.test.ts` | +13 tests (sampling, curves, log axes, every new check and coercion) |
| `client/src/scene/__tests__/spaces.test.ts` (new) | Log spacing, ticks, linear unchanged |

**Results.**

| Check | Result |
|---|---|
| Server tests | 355 passed, 19 skipped, 0 failed |
| Client tests | 226 passed, 0 failed |
| Server + engine typecheck | 0 errors |
| Goldens | 14/14 valid with zero warnings (the new point-on-curve check passes the existing projectile "max height" and "range" points); all build and play in the jsdom render test |
| Client production build | succeeds (11.67 s) |
| Headless renders | area under x² shaded and highlighted; decay crosses N₀/2 at t = 10 with the half-life point on the curve, straight line on the log axis with 2–5–10 ticks; unit circle traced, cardioid closed; projectile and triangle goldens unchanged except the fixed label overlap |

**Not verified.** No live AI run (quota). Nothing measures yet whether models
pick `curve`/`area`/log axes unprompted. Labels avoid each other but not every
curve stroke (a label can still sit on a line it isn't attached to). Area
shading is bounded by plots only, not curves.

**Next: Phase 3** (physics) — parameters with units on a scene, evaluated
inside expressions, so one slider moves every dependent curve, point and
vector; dimensional checks.

---

## Phase 3 report — physics parameters, sliders, dimensional checks (2026-10-27)

**Objective.** Let a lesson expose its inputs (launch speed, angle, spring
constant, mass…) as sliders; recompute every dependent curve, point, vector
and number when one moves; and check the physics' units before the learner
sees anything.

**Decisions.**
- **Parameters are a layer in front of validation**, like geometry by intent.
  The model writes `params`, `derived`, and uses them in expressions,
  `"=expr"` numeric fields and `{{id}}` text. `validateScene` resolves them to
  numbers, validates that ordinary scene, and returns it with `params`,
  `derived` and the **bindings** (entity id + field + source). Saved lessons
  are therefore plain Scene Language: every existing renderer, the doubt
  pipeline and persistence keep working unchanged, and the client re-applies
  bindings to move a slider. A validated scene validates again with its
  bindings (doubt branches do this).
- **Validated across the slider range**, not just at the default: each slider
  at its minimum and maximum, and all at once. This catches the real failure
  mode — a scene sized for v₀ = 20 m/s whose apex leaves the axes at 25.
  A new domain check (`point`/`body` inside its space) gives those sweeps a
  precise message.
- **Dimensional analysis on the RPN** of every bound expression: parameters in
  SI (non-SI units are rejected with a reason, so no silent km/h ↔ m/s mix-ups),
  derived units checked, sums of unlike quantities and `sin(length)` caught,
  plots checked against their axis units. Literal numbers are dimensionless,
  which is why constants such as g are written as fixed parameters
  (`min = max`, shown as a constant, no slider).
- **Angles**: a `deg` parameter is shown in degrees, enters `sin`/`cos` in
  radians, and stays in degrees in degree-valued fields (`angleDeg`).
- **Slider redraw** reuses `SceneEngine.extend` (same beat, same time, same play
  state); a drag never queues more than one rebuild behind the running one.
  Rebuild time per slider move was not measured.
- **Panel placement**: on stages ≥ 1200 px wide the panel is open and the board
  is fitted beside it (an extra left inset); narrower stages show a
  "Try it · n sliders" pill that opens it. Drags on the panel never pan the board.

**Files.**

| File | Change |
|---|---|
| `server/engine/scene/units.ts` (new) | Unit parser (SI + common derived units, superscripts), `dimOf` over expression RPN, readable dimension names |
| `server/engine/scene/params.ts` (new) | `prepareParams` (shape, ids, SI units, derived, bindings, dimension checks), `evaluateParams`, `applyBindings` (incl. recomputing a polar vector's tip), `resolveParams`, `sweepValues` |
| `server/engine/scene/expr.ts` | Identifiers as tokens (`parseExpr` exposes the RPN; `compileExpr(src, v, env)`) |
| `server/engine/scene/validate.ts` | `validateScene` = resolve → validate → sweep; previous body is `validateResolved` |
| `server/engine/scene/schema.ts` | `params`, `derived`, `bindings` (optional), space `xUnit`/`yUnit` |
| `server/engine/scene/domainChecks.ts` | `point`/`body` inside their space; point-on-curve defers off-frame points to it |
| `server/engine/scene/prompt.ts` | PARAMS section and physics rule (≈ 250 tokens) |
| `server/engine/scene/fixtures/projectile-sliders.json`, `spring-oscillator.json` (new) | Goldens with sliders |
| `client/src/scene/normalize.ts`, `engine.ts` | Resolve parameters at the learner's values; `setParams`, `paramState`; values kept across rebuilds of the same lesson, reset for a new one |
| `client/src/components/canvas/ParamPanel.jsx` (new) | Slider panel: labelled range inputs with units, derived read-outs, constants, Reset, fold/unfold, keyboard accessible, `aria-live` read-outs |
| `client/src/components/canvas/SceneV2Stage.jsx` | Mounts the panel, reserves room for it on wide stages, no panning from the panel |
| `client/src/dev/sceneLab.ts` | Sliders in the Scene Lab |
| `server/tests/sceneParams.test.ts` (new) | 14 tests: units, dimensions, golden at defaults and sweep, metamorphic, clamping, round trip, every error message |
| `client/src/scene/__tests__/params.test.ts`, `client/src/components/canvas/__tests__/ParamPanel.test.jsx` (new) | Engine redraw on `setParams` (same beat, label rewritten, values kept/reset); panel behaviour |

**Live checks (headless Chromium, real app in guest mode, lesson injected through the dev store handle):**
- 1920×1080: panel open, board beside it; keyboard on the v₀ slider → 10 m/s, board label "range 10.2 m", read-outs range 10.2 m / height 2.6 m / time 1.44 s; mouse drag → 21.5 m/s, range 47.2 m; the board did not pan; no page errors.
- 1440×900 (stage ≈ 1090 px with the chat panel): folded pill, full-size board; opening it gives the same results.
- Scene Lab: spring k/m/A sliders — 4× the mass doubles T (1.40 → 2.81 s); keyboard on the lab's θ slider 45° → 60° moves the projectile at the same beat.

**Results.**

| Check | Result |
|---|---|
| Server tests | 371 passed, 19 skipped, 0 failed |
| Client tests | 236 passed, 0 failed |
| Server + engine typecheck | 0 errors; eslint on `server/engine/scene`: 0 errors |
| Goldens | 16/16 valid with zero warnings; the two slider goldens also valid at every slider extreme; all build and play in the jsdom render test |
| Client production build | succeeds (14.31 s) |

**Not verified / limits.**
- Phone layout: in the injected state the mobile app shows the chat, not the board, so the panel wasn't exercised at 390 px (its width rule is `min(256px, 100% − 32px)`).
- Slider values are not persisted: reopening a lesson starts at the defaults (Phase 9). *(Done in Phase 9.)*
- No live AI run (quota) — whether models write good parameterised scenes is unmeasured; the prompt grew by ≈ 250 tokens, which matters on Groq's 8k-token-per-minute tier.
- On very small trajectories, labels crowd each other (they never overlap other labels, but can sit on the curve).
- Dimensional checks can't see units hidden in literal numbers ("9.8*x^2"); the prompt asks for constants as parameters.

**Next: Phase 4** (chemistry) — bond styles (wedge/dash), reactions with atom balance, curved electron-pushing arrows anchored to atoms, bonds and lone pairs.

---

## Phase 4 report — chemistry: stereo bonds, reactions, curly arrows (2026-10-27)

**Objective.** Draw what organic chemistry teaching actually uses — wedge and
dash bonds, balanced reactions, electron-pushing arrows — and refuse the
versions that are chemically meaningless.

**Decisions.**
- **Stereo bonds are a 4th field on a bond** (`[0, 3, 1, "wedge"]`), so every
  existing molecule stays valid. A centre with four bonds and a wedge or dash
  is drawn as a tetrahedral projection (two plain bonds in a V, wedge and dash
  below) instead of the flat cross; centres without stereo bonds are unchanged.
- **Bonds and lone pairs are parts**, addressed like atoms: `m.C1-Br` (either
  order) and `m.lp-O`. Highlights work on them (a bond can be shown breaking),
  and they are the anchors for curly arrows. An atom id that contains a hyphen
  wins over the bond reading.
- **`curly` is an attached entity** (like a connector): drawn after the
  molecules, from anchor to anchor, bowed away from the molecule the
  electrons leave, stopping short of an atom's ball. The rules it enforces are
  the ones mechanism teaching depends on: electrons leave a lone pair or a
  bond (an anion's charge implies a pair), arrive at an atom or a bond, and
  only a fishhook (one electron) may start at an atom.
- **`reaction` composes existing molecules** instead of drawing its own: it is
  the arrow (with conditions) and it writes `+` signs and coefficients into the
  gaps that layout left between the molecules. Model output without a layout
  for them gets a left-to-right row automatically. Balance is checked per
  element and for charge, and the message names the difference
  (`O: 2 on the left, 4 on the right`), so a repair round fixes coefficients.
- **Found in passing:** board labels were upper-cased, which changes a formula's
  meaning (Br → BR, Co (cobalt) → CO). Molecule and reaction labels now keep
  their case and render formulas with sub/superscripts (C₆H₆, SO₄²⁻).
- **Planner examples:** mechanism questions now get the SN2 golden and
  equation questions the combustion golden (one example per prompt, as before);
  "wedge" no longer pulls the physics ramp example into chemistry questions;
  organic terms (SN1/SN2, nucleophile, chiral…) are recognised as chemistry.

**Files.**

| File | Change |
|---|---|
| `server/engine/scene/schema.ts` | Bond style; `reaction`, `curly` entities |
| `server/engine/scene/chem.ts` | Stereo-bond checks, `moleculePart`, `lonePairsOn`, `reactionBalance` |
| `server/engine/scene/validate.ts` | Molecule parts include bonds and lone pairs (with a helpful list); reaction/curly references |
| `server/engine/scene/domainChecks.ts` | `reaction-balance`, `curly-arrow-semantics` |
| `server/engine/scene/coerce.ts` | Aliases (`curved_arrow`, `chemical_reaction`…), automatic reaction row |
| `server/engine/scene/prompt.ts` | Syntax for stereo bonds, reactions, curly arrows, part refs; example selection |
| `server/engine/scene/fixtures/sn2-mechanism.json`, `methane-combustion.json` (new) | Goldens |
| `client/src/scene/geometry.ts` | Stereocentre projection |
| `client/src/scene/render/board.ts` | Wedge/hash bonds; bond and lone-pair parts; reaction arrow, `+`, coefficients; case-correct formula labels |
| `client/src/scene/render/spatial.ts` | Curly arrows (full head / fishhook) |
| `client/src/scene/measure.ts`, `tokens.ts`, `normalize.ts`, `engine.ts`, `compile.ts` | Reaction size, new types, curly as attached, draw-on effects |
| `server/tests/sceneChem.test.ts` (new) | 17 tests: parts, stereo, balance messages, every curly rule, reaction refs, coercion, example selection |
| `client/src/scene/__tests__/chemistry.test.ts` (new) | Stereocentre angles, methane unchanged, bond/lone-pair parts in the engine, curly paths, coefficients and `+` |

**Headless renders (Scene Lab):** SN2 — the arc from O's lone pair to C, the
C–Br arrow onto Br, wedge and hashed bonds on carbon, `+` signs and the
reaction arrow, products with the C–O bond highlighted. Combustion —
`CH₄ + 2 O₂ —spark→ CO₂ + 2 H₂O` with the atom tally. Benzene → toluene
labels now read C₆H₆ / C₇H₈.

**Results.**

| Check | Result |
|---|---|
| Server tests | 390 passed, 19 skipped, 0 failed |
| Client tests | 245 passed, 0 failed |
| Server + engine typecheck | 0 errors; eslint: 0 errors (warnings only) |
| Goldens | 18/18 valid with zero warnings; all build and play in the jsdom render test |
| Client production build | succeeds (12.44 s) |

**Not verified / limits.**
- No live AI run (quota); the prompt grew by about 120 tokens.
- The stereocentre projection is a fixed V-and-wedges drawing; it doesn't
  depict inversion (SN2's umbrella flip) or compute R/S.
- Curly arrows can't yet start or end *between* two atoms (a forming bond
  is shown by pointing at the receiving atom).
- Mechanisms with intermediates are drawn as separate molecules per step;
  there is no transition-state notation (brackets, ‡, partial bonds).
- Skeletal (line-angle) display isn't implemented; every atom is drawn.

**Next: Phase 5** (biology) — nested labelled compartments (cell → organelle),
leader-line labels with collision avoidance, and a label-coverage check.

---

## Phase 5 report — biology: labelled compartment diagrams (2026-10-27)

**Objective.** Draw biological structures the way a textbook labels them —
regions inside regions, every part named by a leader line — from the parts
the question needs, and refuse diagrams that contradict basic biology.

**Decisions.**
- **One generic primitive, not stored pictures.** A `compartment` is a whole
  (round / oval / rect) and a tree of parts with generic shapes (round, oval,
  rect, bean, stack, dot, membrane). A plant cell, a bacterium, a nucleus with
  its nucleolus, a leaf cell or an organ's tissues are all written the same
  way; the model chooses parts, nesting and relative sizes, never coordinates.
- **Shared layout** (`server/engine/scene/compartments.ts`), used by both the
  validator and the renderer, so the checks see exactly what is drawn:
  membranes become concentric outlines of their parent; other parts are packed
  largest first at the free spot farthest from everything already placed (the
  biggest part lands centrally, the rest spread out), then nested parts inside
  them.
- **Leader labels** sit in a column on each side: they keep their parts'
  vertical order (leaders don't cross), are spaced a row apart, rebalance to the
  emptier side, and a part nested in a labelled container takes the other
  column so the two leaders don't start side by side. Highlighting a part lights
  its shape and its label together.
- **Label coverage** = every part has exactly one placed label with its own
  leader, labels are unique (copies use `count`), and anything that can't be
  placed (no room inside a parent, too many labels for the columns) is a repair
  error rather than an overlap on screen.
- **Structure rules** come from the labels the model wrote, so they apply to any
  diagram: what a prokaryotic / animal / plant cell can't contain (errors), what
  can only exist inside something else (nucleolus → nucleus, cristae →
  mitochondrion, thylakoids → chloroplast), and what usually defines the cell
  (warnings, since a lesson may leave things out on purpose).
- **Planner:** a biology domain hint (checked last, so "root of an equation"
  stays maths), the plant-cell golden as the example for structure questions,
  and electrochemistry terms recognised as chemistry ("electrochemical cell"
  had been read as biology).

**Files.**

| File | Change |
|---|---|
| `server/engine/scene/compartments.ts` (new) | Shared packing and leader-label layout, issues for what doesn't fit |
| `server/engine/scene/schema.ts` | `compartment` entity |
| `server/engine/scene/validate.ts` | Part ids, `in` references, no cycles, not inside a membrane; parts as refs |
| `server/engine/scene/domainChecks.ts` | `compartment-labels-and-structure` |
| `server/engine/scene/coerce.ts` | Aliases (`cell_diagram`, `labelled_diagram`…); `organelles`/`structures` → `parts`, `name` → `label`, `parent` → `in`, membrane-ish shapes → `membrane` |
| `server/engine/scene/prompt.ts` | Compartment syntax and rule; biology domain and example; electrochemistry hints |
| `server/engine/scene/fixtures/plant-cell.json`, `prokaryote-eukaryote.json` (new) | Goldens |
| `client/src/scene/measure.ts`, `render/board.ts`, `normalize.ts` | Measure from the shared layout; draw outlines, membranes, parts, copies, leaders, labels; part refs |
| `server/tests/sceneBio.test.ts` (new) | Layout invariants (inside parents, no sibling overlaps, one leader per part, row spacing, nested parts opposite), overflow reports, every rule and coercion, planner hints |
| `client/src/scene/__tests__/compartment.test.ts` (new) | Labels and leaders rendered, parts addressable and inside their containers, beats play |

**Headless renders (Scene Lab):** the plant cell reads like a textbook
figure — cell wall and membrane as concentric outlines, central vacuole,
nucleus with nucleolus, four chloroplasts, mitochondria, Golgi; nine labels in
two columns with non-crossing leaders. The prokaryote/eukaryote comparison
(stacked) shows nucleoid vs nucleus, and highlights light shapes and labels
together. Two diagrams *side by side* were too small to read at 1000 px
(labels ≈ 7 px), so the golden stacks them and the prompt says to.

**Results.**

| Check | Result |
|---|---|
| Server tests | 406 passed, 19 skipped, 0 failed |
| Client tests | 252 passed, 0 failed |
| Server + engine typecheck | 0 errors (after fixing a type annotation in the new client test); eslint: 0 errors |
| Goldens | 20/20 valid with zero warnings; all build and play in the jsdom render test |
| Client production build | succeeds (15.39 s) |

**Not verified / limits.**
- No live AI run (quota); the prompt grew by about 150 tokens.
- Schematic, not anatomical: organs with characteristic outlines (heart
  chambers, nephron loops, leaf cross-sections) and flow paths through them
  need shapes this primitive doesn't have yet.
- Leaders can pass over other parts on their way out (as in printed figures);
  they don't cross each other.
- The structure rules cover cell kinds and a handful of containment facts;
  they are a guard against the commonest errors, not a full ontology.
- Processes (mitosis stages, cycles) still use boxes and connectors.

**Next: Phase 6** (DSA / CS) — reference implementations that *compute*
algorithm traces from the input (binary search, sliding window, BFS/DFS,
Dijkstra, sorts, DP tables) instead of the model writing them.

---

## Phase 6 report — computed algorithm traces (2026-10-27)

**Objective.** Stop the model writing algorithm traces by hand. It chooses the
algorithm and the input; TutorBoard runs the algorithm and writes every step.

**Decisions.**
- **A `compute` beat, expanded before validation** (`algorithms.ts`). The
  result is ordinary Scene Language — the same actions a hand-written trace
  would use — so the validator, data-structure simulation, renderer,
  persistence and doubt branches need nothing new, and saved lessons play
  without the algorithm code.
- **Reference implementations, not prompts:** binary search, fixed and
  variable sliding windows, bubble / insertion / selection sort, BFS, DFS
  (iterative, stale entries skipped), Dijkstra, Fibonacci, coin change (min
  coins), LCS (with backtracking) and 0/1 knapsack (with chosen items). Each
  produces highlights, swaps, queue/stack operations, cell updates and pointer
  callouts, plus narration stating the actual numbers ("mid = (4 + 6) / 2 = 5,
  and arr[5] = 31…"; "B: 1 + 2 = 3 < 4 → 3").
- **Inputs are checked, sizes bounded:** unsorted input to binary search,
  negative or missing weights for Dijkstra, unknown start nodes, and inputs too
  large to teach are refused with a precise message. A trace longer than the
  lesson's remaining beats is merged into fewer beats (neighbouring steps with
  the fewest actions first) or refused if it still can't fit.
- **Deterministic choices are stated:** neighbours are taken in edge-list
  order, and the narration says so.
- **Engine additions:** table cells are parts (`dp.r2c3`) that `set` and
  `highlight` reach, `clear` on a whole clears its parts (tables, compartments),
  and table columns are sized for values set later. The client normaliser also
  expands `compute` beats, so raw goldens play in the Scene Lab.
- **Found while rendering (pre-existing engine bug):** annotating an element a
  second time *deleted* the earlier callout from the compiled timeline, so it
  vanished from the beat where it belonged (binary search lost `lo` in step 2).
  Now the old callout fades out at the moment the new one appears. Callout room
  is also released on `unannotate` (pointers no longer drift outward beat by
  beat), and a callout prefers its requested side one tier further out over
  swinging sideways across neighbouring cells.

**Files.**

| File | Change |
|---|---|
| `server/engine/scene/algorithms.ts` (new) | 12 reference implementations → beats; pointer callouts; fitting to the lesson; `expandComputed` |
| `server/engine/scene/validate.ts` | Expansion before validation; table cell parts |
| `server/engine/scene/prompt.ts` | COMPUTED TRACES section and the algorithms rule |
| `server/engine/scene/fixtures/*-computed.json` (5 new) | Binary search, sliding window, BFS, Dijkstra, LCS |
| `client/src/scene/normalize.ts` | Expands `compute` beats (raw goldens) |
| `client/src/scene/render/board.ts` | Table cells as parts; `partPaints` for tables and compartments |
| `client/src/scene/compile.ts` | `set` on table cells; `clear` reaches parts; callout replace-and-fade, freed room, tiered placement |
| `client/src/scene/measure.ts` | Table columns sized for later `set` values |
| `server/tests/sceneAlgorithms.test.ts` (new) | 12 tests: every algorithm's result against hand computation (incl. replaying swaps to a sorted array, Dijkstra's exact update sequence), preconditions, fitting, unknown names, beat composition |
| `client/src/scene/__tests__/algorithms.test.ts` (new) | LCS cells fill in the engine; re-annotated callouts survive |

**Headless renders (Scene Lab):** binary search with `lo`, `mid` (stacked)
and `hi` over the live window and the eliminated half dimmed; sliding window
with the state caption; BFS with the queue (front/rear) and visit order;
Dijkstra with node/distance rows (B shortened to 3 via C); the LCS table filled
row by row with the BCBA path highlighted.

**Results.**

| Check | Result |
|---|---|
| Server tests | 423 passed, 19 skipped, 0 failed |
| Client tests | 264 passed, 0 failed |
| Server + engine typecheck | 0 errors; eslint: 0 errors |
| Goldens | 25/25 valid with zero warnings; all build and play in the jsdom render test |
| Client production build | succeeds (11.48 s) |

**Not verified / limits.**
- No live AI run (quota): whether models choose `compute` instead of writing
  traces is unmeasured. The prompt grew by about 200 tokens.
- Only these 12 algorithms are computed; anything else (quicksort, merge sort,
  topological sort, union–find, string matching, recursion trees) is still
  written by the model and only bounds-checked.
- User-supplied *code* is still traced by the separate code visualizer, not by
  this mechanism.
- DFS's skipped stale stack entries are folded into the previous beat's
  narration rather than shown as their own step.

**Next: Phase 7** (ML) — computed toy data (gradient-descent paths from the
objective, k-means iterations, confusion matrices from labels) through the same
`compute` route, with an "illustrative data" marker where data is made up.

---

## Phase 7 report — machine learning from computed data (2026-10-27)

**Objective.** Every number on an ML board — a step, a centroid, an accuracy,
a slope — comes from running the method on the lesson's data, and made-up data
is labelled as such.

**Decisions.**
- **Same `compute` route** (`ml.ts`, registered alongside the Phase 6
  algorithms; shared pieces moved to `computeKit.ts`). Generators may create
  their own space, sized to the data, when the target space doesn't exist.
- **Gradient descent** steps x ← x − lr·f′(x) with the slope from a central
  difference (or a given `df`), narrates each step's arithmetic, and reports a
  diverging run as what it is ("the steps blow up — the rate overshoots").
- **k-means** runs real assign/update passes to convergence and reports the
  inertia. Default start is farthest-first (stated in the narration); the
  first version started on the first k points, which converged to a poor local
  optimum on the golden — accurate, but a misleading demo. Each iteration's
  points are listed cluster by cluster so cluster colours stay put.
- **Confusion matrix** counts every cell from the label lists and computes
  accuracy (and precision/recall/F1 for two classes); **least squares** is the
  closed form with residuals and R²; **perceptron** updates on each mistake
  and shows the boundary per epoch, saying so when the data isn't separable.
- **Provenance.** `generate` draws a dataset from a seeded generator
  (reproducible); the board then carries a visible *Illustrative data —
  generated for this lesson, not measured* note, the narration says so, and the
  scene records `provenance: [{ algorithm, target, data, beats }]` for every
  computed beat (Phase 6 traces included, as `given`).
- **Scatter palette:** the default classes used `primary` and `warning`,
  which are the same amber — clusters 1 and 2 looked identical. Now a fixed
  set of distinct colours, in the order the k-means centroids use.

**Found while rendering (pre-existing engine bug):** moving a point a second
time used its *current* position as its starting point and doubled the move,
so k-means centroids jumped back. Cause: `'at' in [x, y]` is true in modern
JavaScript (arrays have an `.at()` method), so the check for a `{ at: … }`
object matched every coordinate pair and the code fell back to the moved box.
Any lesson that moved a point or polygon more than once was affected. Fixed,
with a regression test.

**Files.**

| File | Change |
|---|---|
| `server/engine/scene/ml.ts` (new) | Gradient descent, k-means, confusion matrix, linear regression, perceptron; seeded data generation; space sizing; illustrative note |
| `server/engine/scene/computeKit.ts` (new) | Generator contract and helpers shared with `algorithms.ts` |
| `server/engine/scene/algorithms.ts` | ML registered; generated spaces merged; `provenance` recorded |
| `server/engine/scene/schema.ts` | Optional `provenance` |
| `server/engine/scene/prompt.ts` | ML compute syntax; "never invent loss values or accuracies" |
| `server/engine/scene/fixtures/{gradient-descent,kmeans,confusion-matrix,perceptron}-computed.json` (new) | Goldens (k-means on generated data, the others on given data) |
| `client/src/scene/compile.ts` | Array `.at()` misdetection fixed (repeated moves) |
| `client/src/scene/render/spatial.ts` | Distinct scatter palette |
| `client/src/scene/engine.ts` | `spaceMap(id)` (tests, Scene Lab) |
| `server/tests/sceneML.test.ts` (new) | 10 tests: exact GD path and metamorphic learning rate, divergence, k-means means and stable colours, illustrative marker + provenance + reproducibility, confusion counts and metrics, least-squares coefficients, perceptron boundary separating every point, input errors |
| `client/src/scene/__tests__/algorithms.test.ts` | Repeated moves land on each `to`; k-means centroids land on the computed means |

**Headless renders (Scene Lab):** gradient descent's ball settling at
x ≈ 1.88 with the step read-out; k-means centroids in the middle of their three
clusters with the illustrative-data note; the spam/ham confusion matrix with
the diagonal highlighted and *accuracy 17/20 = 0.85, precision 6/7, recall 6/8,
F1 0.8*; the perceptron's final boundary 2x₁ + 2x₂ − 10 = 0 between the classes.

**Results.**

| Check | Result |
|---|---|
| Server tests | 437 passed, 19 skipped, 0 failed |
| Client tests | 274 passed, 0 failed |
| Server + engine typecheck | 0 errors; eslint: 0 errors |
| Goldens | 29/29 valid with zero warnings; all build and play in the jsdom render test |
| Client production build | succeeds (14.26 s) |

**Not verified / limits.**
- No live AI run (quota); the prompt grew by about 120 tokens.
- No model is actually trained beyond these five methods: training/validation
  curves, attention weights and embeddings have no compute path yet, and the
  prompt tells the model not to invent such numbers.
- Gradient descent is one-dimensional; there is no contour-plot path in two
  dimensions.
- Centroids are drawn as ordinary points (labelled), not as larger markers.

**Next: Phase 8** (engineering) — circuits as components + nets with a
KCL/KVL solve for resistive and RC DC cases, logic gates with a truth-table
check, and engineering plots.

---

## Phase 8 report — circuits, logic and beams (2026-10-27)

**Objective.** Engineering diagrams whose numbers are solved, not written:
circuits drawn as schematics with currents from Kirchhoff's laws, logic
circuits whose truth tables are evaluated and checked, and beams whose
shear and moment diagrams come from equilibrium.

**Decisions.**
- **Two new entities with shared modules** (`circuits.ts`, `logic.ts`) used
  by the validator, the computed traces and the renderer.
- **Circuits are components between named nets** (two-terminal: battery,
  resistor, lamp, capacitor, switch, wire, ammeter, voltmeter). The checks
  catch what makes a circuit diagram wrong rather than ugly: dangling
  terminals, a part shorted to itself, a battery shorted by wires, a missing
  source, missing values, disconnected pieces, and contradictory sources.
- **Solve by modified nodal analysis.** Wires merge nets; ammeters and closed
  switches are 0 V sources, so their currents come out of the solve;
  capacitors, open switches and voltmeters carry no DC current. Only nodes
  with no conductive path to ground get a tiny conductance (a first version
  gave every node one, which skewed results by ~10⁻⁶ — caught by the tests).
  **RC**: the Thévenin equivalent across the capacitor (open-circuit voltage,
  then a 1 A test injection with batteries shorted) gives V_th, R_th and
  τ = R_th·C.
- **Schematic layout as a ladder** — battery upright on the left, ground as the
  bottom rail, series parts along the top, parts to ground as rungs, extra
  branches on a higher row, anything else as a bridge over the top — which
  covers the series, parallel, divider and RC circuits school lessons use.
  Junction dots appear only where three or more conductors meet (the first
  version also dotted plain series joints — fixed).
- **Logic** is combinational only (feedback loops are refused); gates are
  laid out in columns by depth with one bend per wire. A truth table anywhere
  in the scene whose columns name the inputs and an output is checked row by
  row — a hand-written table with a wrong row is a repair error with the
  right value.
- **Computed traces** on the existing route (`eng.ts`): `circuit-solve`,
  `rc-charging`, `truth-table`, `beam` (simply supported; point loads and a
  uniform load; shear jumps drawn as vertical segments; the moment peak placed
  exactly under a point load).
- **Engine fix found while rendering:** a `draw` effect with many strokes
  (a schematic) reported only its base duration, so the beat ended before the
  last strokes and symbols appeared. It now reports the full stagger.

**Files.**

| File | Change |
|---|---|
| `server/engine/scene/circuits.ts` (new) | Checks, nodal-analysis DC solve, Thévenin, ladder layout, junction dots |
| `server/engine/scene/logic.ts` (new) | Checks, evaluation, truth rows, truth-table checking, column layout |
| `server/engine/scene/eng.ts` (new) | `circuit-solve`, `rc-charging`, `truth-table`, `beam`; SI formatting |
| `server/engine/scene/schema.ts`, `validate.ts`, `domainChecks.ts`, `algorithms.ts` | Entities, part refs, `circuit-solvable` and `logic-and-truth-tables` checks, registration |
| `server/engine/scene/prompt.ts` | Syntax and rules for circuits, logic, beams |
| `server/engine/scene/fixtures/{circuit,rc-charging,logic,beam}-computed.json` (new) | Goldens |
| `client/src/scene/render/board.ts`, `measure.ts`, `normalize.ts` | Schematic symbols (resistor, battery with polarity, capacitor, switch, lamp, meters), gate shapes, value badges, labels |
| `client/src/scene/compile.ts` | Full duration for many-stroke `draw` |
| `server/tests/sceneEng.test.ts` (new) | 15 tests: solver values against hand calculation, meters, open switch and DC capacitor, metamorphic resistance, every structural error, Thévenin, layout dots and bounds, logic checks/evaluation/truth-table checking, each computed trace incl. a uniformly loaded beam (wL²/8) and a moved load |

**Headless renders (Scene Lab):** the series–parallel circuit as a ladder
(battery with + plate, R1 on top, R2 ∥ R3 as rungs, junction dots only at
the branch) with the solved 4.5 mA / 2.25 mA / 4.5 V callouts and the KCL beat
lighting junction n2; the RC circuit and its charging curve (τ = 200 ms,
63% point at 3.79 V, 6 V asymptote); the majority-vote circuit with live 0/1
values on every gate beside its truth table; the beam's loads and reactions,
the stepped shear diagram and the moment peak of 13.33 kN·m at 2 m.

**Results.**

| Check | Result |
|---|---|
| Server tests | 456 passed, 19 skipped, 0 failed |
| Client tests | 282 passed, 0 failed |
| Server + engine typecheck | 0 errors; eslint: 0 errors |
| Goldens | 33/33 valid with zero warnings; all build and play in the jsdom render test |
| Client production build | succeeds |

**Not verified / limits.**
- No live AI run (quota); the prompt grew by about 250 tokens.
- DC and first-order RC only: no AC (phasors, impedance), inductors,
  op-amps, diodes or transistors; one capacitor per RC trace.
- The ladder layout suits textbook circuits; meshes such as a Wheatstone
  bridge are drawn correctly but with bridges over the top rather than the
  familiar diamond.
- Callout leaders run across a schematic's labels (callouts are placed
  outside the whole diagram).
- Logic is combinational: flip-flops, counters and timing diagrams are not
  supported. Beams are simply supported only (no cantilevers or moments
  applied at a point). No stress–strain model.

**Next: Phase 9** (persistence and interactive refinement) — slider values
and lesson state saved and restored across refresh and reopen, verified end
to end for every domain.

---

## Phase 9 report — saving and restoring lessons (2026-10-27)

**Objective.** A learner who refreshes the page or comes back to a
conversation later finds each lesson as they left it: the same step, the
same slider values, the same board, in every domain.

**What already persisted.** The validated scene (with its parameters,
derived quantities, bindings and provenance) is saved in the chat message
(`visuals`, `canvasSnapshot`) and the artifact (`metadata.sceneV2`); the
last viewed step is saved per artifact (`lessonProgress`, debounced, flushed
on leave/hide, stale-safe). Slider values lived only in the running engine.

**Decisions.**
- **Slider values go with the position, not into the scene.** They are the
  learner's state, like the step, so they are saved in
  `lessonProgress.params` through the same endpoint, with the same rules: a
  late or stale write never overwrites a newer one; a lesson that changed
  (different step count) refuses old positions. The scene is never
  rewritten; on reopen the values go through the stored bindings, clamped to
  each slider's range (`evaluateParams`), so a tampered or outdated value
  cannot push the board off its axes.
- **Validated on the server**: names must look like parameter ids (no `$` or
  `.`, so nothing reaches a Mongo operator or path), values finite numbers,
  at most 12.
- **Client flow.** `ParamPanel` reports values once the board shows them →
  `rememberLessonParams` in the store (keyed by artifact id) →
  `useLessonProgress` writes them with the step (the same 800 ms debounce,
  the same flush on leave/hide/unload). A position from the server fills the
  store's slider values too. `SceneEngine.load(scene, params)` starts a
  reopened lesson at them. A lesson whose sliders were moved while it was
  still streaming in keeps those values once it is saved.
- **Fixes found on the way.**
  - Opening a conversation from the sidebar (`Home.jsx`) never read the
    saved positions — only the start-up restore did — so the step and
    sliders came back only after a full reload. It now reads them and opens
    the lesson at its saved step, like the start-up path.
  - Asking a doubt on the board reloaded the lesson afterwards with its
    sliders back at the defaults (a different scene title cleared them). The
    stage now keeps the lesson's values across the doubt.

**Files.**

| File | Change |
|---|---|
| `server/controllers/artifact.controller.js`, `server/models/Artifact.js` | `lessonProgress.params` (validated, stale-safe) |
| `client/src/scene/engine.ts` | `load(scene, params?)` |
| `client/src/components/canvas/ParamPanel.jsx`, `SceneV2Stage.jsx`, `teaching/TeachingSession.jsx` | `onChange`, `lessonKey`; restore on load; keep values across a doubt |
| `client/src/store/slices/sceneSlice.js`, `hooks/useLessonProgress.js` | `lessonParams`; params saved with the position |
| `client/src/pages/Home.jsx` | Sidebar reopen restores step and sliders |
| `server/tests/scenePersistence.test.ts` (new) | Every golden (all domains) stored in MongoDB and read back unchanged and still valid; saved slider values give the same board as moving the sliders |
| `server/tests/lessonProgress.test.ts`, `client/src/hooks/__tests__/useLessonProgress.test.js`, `scene/__tests__/params.test.ts`, `components/canvas/__tests__/ParamPanel.test.jsx` | Params saved, returned, ordered by time and refused when malformed; saved with the step; engine opens at saved values (clamped) and gives the same board; panel reports values |

**End-to-end check (isolated backend: in-memory MongoDB, E2E mock model, guest).**
All 33 goldens were saved into guest conversations exactly as the chat
saves lessons. Each was opened from the sidebar, moved to a later step
(and, for the two slider lessons, sliders moved), then the page was
refreshed and each reopened from the sidebar:

| Check | Result |
|---|---|
| Server holds the step and slider values left | ✅ 33/33 |
| After refresh, reopened at that step | ✅ 33/33 |
| Board drawn on the canvas at that step | ✅ 33/33 |
| Sliders back at their values: projectile (v₀ 12.5 m/s, θ 60° → range 13.8 m), spring (k 61, m 3.1, A 0.24) | ✅ |

Domains covered: math, geometry, physics (incl. circuits, RC, beams),
chemistry, biology, algorithms, data structures, ML, logic. Two lessons
first showed an empty canvas because the test script had left the sidebar
in its sessions list (which closes the canvas); reopened normally, both
passed.

**Results.**

| Suite | Result |
|---|---|
| Server tests | all pass (3 files hit in-memory-Mongo start-up timeouts under load and pass on rerun) |
| Client tests | 286 passed (36 files) |
| Typecheck (server, scene engine) | 0 errors |
| ESLint (touched files) | 0 errors |
| Vite build | ✅ |

**Not verified / limits.**
- The doubt-branch path (sliders kept across a doubt) is covered by code
  reading, not run live: the mock model cannot answer on the board.
- Only the owner's state is saved; a shared lesson opens at its defaults.
- Lessons not yet saved (no artifact id) keep slider values only for the
  page's lifetime.
- No live AI run (quota).

**Next: Phase 10–11** — eval rerun when quota allows, mobile viewport
suite, performance and security review, readiness report.
