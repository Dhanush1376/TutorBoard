# Scene Language v1

The one JSON format the AI writes and the TutorBoard engine plays.
Source of truth: [`server/engine/scene/schema.ts`](../server/engine/scene/schema.ts) (shape) and
[`validate.ts`](../server/engine/scene/validate.ts) (meaning). Golden examples:
[`server/engine/scene/fixtures/`](../server/engine/scene/fixtures/).

## Principles

1. **No pixels.** Board items are positioned with layout *relations*; maths and
   physics items use *domain units* inside a cartesian *space*. The engine solves the layout.
2. **General primitives, not topic templates.** A Bubble Sort is an `array` plus
   `swap` actions; a proof is a `polygon`, `angle`s and a `line`.
3. **Semantic styling.** `tone` and highlight `state` name a meaning
   (`comparing`, `sorted`, `insight`…); the engine owns colour, motion and timing.
4. **Every beat changes the board.** A beat = one lesson step: title, narration, actions.

## Shape

```jsonc
{
  "version": "1",
  "title": "How Bubble Sort works on [5, 1, 4, 2, 8]",
  "domain": "algorithms",           // algorithms | data-structures | math | geometry | physics | chemistry | biology | ml | general
  "summary": "…",                   // optional, one sentence
  "spaces":   [ /* cartesian coordinate systems, optional */ ],
  "entities": [ /* what can appear */ ],
  "layout":   [ /* where board items go */ ],
  "beats":    [ /* the lesson, step by step */ ]
}
```

### Spaces

```jsonc
{ "id": "field", "kind": "cartesian", "x": [0, 45], "y": [0, 14],
  "axes": true, "grid": false, "xLabel": "x (m)", "yLabel": "y (m)", "equalAspect": false }
```
Use `equalAspect: true` for geometry. Entities inside a space name it with `"space": "field"`.
`"xScale": "log"` / `"yScale": "log"` make an axis logarithmic (decades evenly spaced, ticks 1–2–5 on short ranges); its range must be above 0.

### Entities

Every entity has `id` (letters/digits/`_`/`-`, starts with a letter), optional `label` and `tone`
(`default primary accent success warning danger info muted`).

| Group | Type | Key fields |
|---|---|---|
| Text | `text` | `text`, `role` (`title body caption label code`) |
| | `math` | `latex` |
| Shapes (board) | `rect`, `circle` | `size` (`xs`…`xl`), `text` |
| Shapes (space) | `point` | `space`, `at: [x, y]`, `on?` (a plot/curve it lies on — checked) |
| | `polygon` | `space`, `points`, `vertexLabels` (enables `tri.A`), `fill` |
| | `line`, `arrow` | `from`, `to` — coordinates (needs `space`) or refs (`"tri.A"`), `dashed` |
| | `path` | `space`, `points`, `smooth` |
| | `angle` | `vertex`, `from`, `to` (refs or coordinates), `showValue` |
| Functions & physics | `plot` | `space`, `expr` (function of `x`), `domain`, `label` |
| | `curve` | `space`, `x` + `y` (functions of `t`) **or** `r` (function of `θ`/`t`), `t: [start, end]` — numbers or constants like `"2pi"` |
| | `area` | `space`, `plot`, `to` (a y value, default 0, or another plot), `domain` — shaded region |
| | `refline` | `space`, `x` **or** `y`, `label`, `dashed` (default true) — full-width/height reference line |
| | `vector` | `space`, `from`, and `to` *or* `angleDeg` + `magnitude` |
| | `body` | `space`, `at`, `size` |
| | `scatter` | `space`, `points: [{ at, cls }]` |
| Data structures | `array` | `values`, `indices` |
| | `stack` | `values` (bottom → top) |
| | `queue` | `values` (front → rear) |
| | `linkedlist` | `values`, `doubly` |
| | `tree` | `nodes: [{ id, value, parent }]` — exactly one root |
| | `graph` | `nodes`, `edges: [{ from, to, weight }]`, `directed`, `arrangement` |
| | `table` | `columns`, `rows` |
| Science & ML | `molecule` | `atoms: [{ id, el, charge? }]`, `bonds: [[i, j, order, style?]]`, `lonePairs` — the engine computes geometry; rings are drawn as regular polygons (write aromatic rings in Kekulé form); `style` `"wedge"` (towards the viewer) or `"dash"` (away) on single bonds, narrow end at the first atom (the stereocentre) |
| | `reaction` | `reactants`, `products` (molecule ids, or `{ id, n }` with a coefficient), `arrow` (`forward` \| `equilibrium`), `conditions` — drawn around the laid-out molecules; atoms and charge must balance |
| | `compartment` | `label`, `shape` (`round` \| `oval` \| `rect`), `size`, `parts: [{ id, label, in?, shape, size, count? }]` — a labelled diagram of nested regions (cell → organelles); the engine packs each part inside its parent and labels it with a leader line. Part shapes: `round oval rect bean stack dot membrane` (a membrane is an outline of its parent: cell wall, cell membrane, nuclear envelope). Parts are refs: `cell.nucleus` |
| | `circuit` | `components: [{ id, kind, from, to, value?, closed?, label? }]`, `ground?` — kinds `battery resistor lamp capacitor switch wire ammeter voltmeter`; nets are names, a battery's `to` is its + terminal; drawn as a schematic (source on the left, ground rail at the bottom, series parts along the top, parts to ground as rungs). Parts and nets are refs: `c.R1`, `c.n2` |
| | `logic` | `inputs`, `gates: [{ id, op, in }]` (`and or not nand nor xor xnor buf`), `outputs: [{ id, from }]` — combinational logic drawn in columns by depth; parts accept `set` (the value badge: 0/1) |
| | `curly` | `from` (a lone pair `"m.lp-O"` or a bond `"m.C1-Br"`), `to` (an atom `"m.C1"` or a bond), `electrons` (2: full head, 1: fishhook) — electron-pushing arrow |
| | `network` | `layers: [4, 5, 2]`, `inputLabels`, `outputLabels` |
| | `pixels` | `grid` of 0–1 brightness |
| Composition | `group` | `children` |

### References

`arr` (entity) · `arr[2]` (element of an array/stack/queue/linked list, checked against
its length *at that moment*) · `tri.A` (polygon vertex) · `g.n3` (tree/graph node) ·
`h2o.O` (molecule atom id) · `m.C1-Br` (a bond, either way round) · `m.lp-O` (an atom's lone pairs) · `net.L1`, `net.L1n2` (network layer / node).

### Layout

| Relation | Fields |
|---|---|
| `place` | `id`, `region`: `center top bottom left right top-left top-right bottom-left bottom-right` |
| `row`, `column` | `ids`, `gap` (`none sm md lg xl`) |
| `grid` | `ids`, `cols`, `gap` |
| `above`, `below`, `left-of`, `right-of` | `id`, `of`, `gap` |
| `inside` | `id`, `of` |

Place a *space* (not the entities in it). Anything unplaced is laid out automatically.

### Beats and actions

```jsonc
{ "title": "Pass 1: compare 5 and 1",
  "narration": "5 is bigger than 1, so the two swap places.",
  "pace": "normal",                                 // slow | normal | fast
  "actions": [
    { "do": "highlight", "target": ["arr[0]", "arr[1]"], "state": "comparing" },
    { "do": "set", "target": "cmp", "text": "5 > 1", "with": "previous" },   // runs together with the previous action
    { "do": "swap", "target": "arr", "i": 0, "j": 1 }
  ] }
```

| Action | Fields | Notes |
|---|---|---|
| `create` / `remove` | `target` (id or ids), `effect` | create: `fade draw pop drop grow type`; remove: `fade shrink lift slide-left` |
| `move` | `target`, `to: [x, y]` or `by: [dx, dy]`, `turn?` (degrees counter-clockwise), `about?: [x, y]` | space entities only. A body/point goes to `to`; a shape (polygon, line, path, …) moves rigidly: it turns about `about` (default: its first point), then its first point goes to `to` / shifts by `by`. Moves compose — cut-and-rearrange proofs (`parallelogram-area.json`) |
| `rearrange` | `target` (a pie), `into: strip \| circle` | slices fly out and interlock in a row, tips alternating, the first half's arcs along the top: an almost-rectangle πr wide and r tall (`circle-area.json`); `circle` puts them back |
| `swap` | `target`, `i`, `j` | array/stack/queue/linked list |
| `push` · `enqueue` · `pop` · `dequeue` | `target`, `value` | `pop` = stack top, `dequeue` = queue front |
| `insert` / `delete` | `target`, `at`, `value` | array / linked list |
| `set` | `target` (ref), `value` / `text` / `latex` | change a cell, a caption, an equation |
| `morph` | `target`, `values` | new state of a data structure — the engine animates each value to its new place |
| `highlight` | `target`, `state`, `hold` | states: `active comparing swapping sorted found visited eliminated pivot error insight`; `hold: false` = flash |
| `clear` | `target?` | remove highlight states |
| `annotate` / `unannotate` | `target`, `text`, `side` | callout attached to an element |
| `connect` | `from`, `to`, `label`, `style` | `arrow line dashed` |
| `trace` | `target` (body/point), `along` (plot/path), `duration` | |
| `tween` | `target`, `prop`, `to`, `from?` | `opacity`, `scale`; vectors `angleDeg magnitude`; bodies/points `x y` |
| `focus` | `target?`, `zoom` | camera hint: `close medium wide` |
| `wait` | `beats` | |

## Geometry by intent

Inside a space, geometry can be written by what it means; `resolveGeometry` (shared by server and client) computes the coordinates:

| Written | Means |
|---|---|
| line `{"from": [0,0], "angleDeg": 30, "length": 10}` | a 30° segment (`to` computed) |
| point `"block"`, `"tri.A"` | where that body/point/vertex is |
| point `{"from": P, "angleDeg": θ, "length": r}` | polar, from another point |
| point `{"along": "ramp", "t": 0.5}` | on a line or vector (0 = its `from`, 1 = its `to`) |
| vector `"along": "ramp", "toward": "from"` | parallel to the line, pointing to its `from` end |
| vector `"perp": "ramp", "side": "left"` | perpendicular, counter-clockwise of the line's direction |
| vector `"angleDeg": -90` | straight down |
| angle `"degrees": 30` (or a label like "θ = 30°") | the value the lesson states — the drawing must agree within 1° |

`magnitude` is a drawing length in the space's units; vectors written at their value in newtons are put on one common scale (longest ≈ 30% of the space). Spaces holding vectors or angles are drawn at true shape unless `"equalAspect": false`.

## Doubts — answers as branches of a lesson

A question asked during a lesson is answered on the same board (`server/engine/scene/doubt.ts`). The model receives the lesson and the learner's beat and returns

```json
{"kind": "branch", "from": 2, "answer": "2–3 sentences", "entities": [], "layout": [], "beats": [ … ]}
```

- `from` — the lesson beat (1-based) whose end state the board shows before the answer; it may be earlier or later than the learner's beat. The board jumps there exactly, so answers never recreate a moment by hand.
- `beats` — 1–4 beats acting on the lesson's existing ids (plus any new `entities`, placed with `layout`).
- `{"kind": "new-topic", "answer": "…"}` — the question isn't about this lesson; the app starts a new lesson instead.

The lesson's beats `0..from` and the answer's beats form one scene that is validated like any other, so data-structure state, references and layout are checked as usual. The client plays the answer's beats, then "Back to the lesson" restores the lesson at the learner's own beat.

## Computed traces

For the algorithms below the model does not write the steps. It sets the scene up and writes one beat

```jsonc
{ "title": "Halve the search", "narration": "computed",
  "compute": { "algorithm": "binary-search", "target": "arr", "args": { "find": 23 } } }
```

and the validator (`algorithms.ts`) runs a reference implementation on the target's real values and replaces that beat with the trace — highlights, swaps, pointer callouts, queue/stack operations, distance updates, table cells, and narration with the real numbers. The beat's own `actions` and `title` (if any) open the trace; a trace longer than the room left in the lesson is merged into fewer beats, or refused.

| `algorithm` | `target` | `args` | adds |
|---|---|---|---|
| `binary-search` | sorted array (≤ 32) | `find` | `<target>-state` caption; `lo`/`mid`/`hi` callouts |
| `sliding-window` | array | `k` + `mode` `max-sum`/`min-sum`, or `mode: "longest-unique"` | state caption; window callouts |
| `bubble-sort`, `insertion-sort`, `selection-sort` | array (≤ 12) | — | — |
| `bfs`, `dfs` | graph or tree (≤ 12 nodes) | `start` | `<target>-queue` / `<target>-stack`, `<target>-order` |
| `dijkstra` | graph with number weights ≥ 0 | `start` | `<target>-nodes`, `<target>-dist` arrays |
| `fibonacci` | new array id | `n` (≤ 20) | the array |
| `coin-change` | new array id | `coins`, `amount` (≤ 20) | the array |
| `lcs` | new table id | `a`, `b` (≤ 10 chars) | the table |
| `knapsack` | new table id | `weights`, `values`, `capacity` (≤ 10, ≤ 6 items) | the table |

Machine learning, on the same route (`ml.ts`); `target` is a new space or table id:

| `algorithm` | `args` | shows |
|---|---|---|
| `gradient-descent` | `f` (in x), `x0`, `lr`, `steps` ≤ 12, `df`? | the curve, a ball stepping x ← x − lr·f′(x), each step's arithmetic; "the steps blow up" when the rate is too large |
| `k-means` | `k` ≤ 5, `points` [[x, y], …] (or `generate`), `init`? | assign/update iterations until nothing changes (farthest-first start by default), centroids moving to the means, inertia |
| `confusion-matrix` | `actual`, `predicted`, `positive`?, `classes`? | counts row by row, accuracy; precision/recall/F1 for two classes |
| `linear-regression` | `points` (or `generate`) | exact least-squares line, residuals, R² |
| `perceptron` | `points` [[x, y, "A"], …] (or `generate`), `lr` | the boundary w·x + b = 0 epoch by epoch, mistakes per pass, w and b |

Engineering, on the same route (`eng.ts`):

| `algorithm` | `target` / `args` | shows |
|---|---|---|
| `circuit-solve` | a circuit | equivalent resistance, Ohm's law per part, KCL at the busiest junction, meter readings, power in = power out — by nodal analysis |
| `rc-charging` | a circuit with one capacitor; `v0` | its Thévenin equivalent, τ = R·C, v_C(t) with t = τ and the 63% point |
| `truth-table` | a logic circuit | every input row run through the gates, values on the diagram, the table filled in |
| `beam` | new id; `length` (m), `loads: [{ at, F }]` (kN), `udl` (kN/m) | reactions by moments, shear-force diagram (with its jumps), bending-moment diagram and its peak |

**Data provenance.** With `points` (or labels) the numbers come from the lesson's own data. With `generate` (`n`, `clusters`, `seed`, …) a dataset is drawn from a seeded generator — the same every time — and the board shows *"Illustrative data — generated for this lesson, not measured"*; the narration says so too. Every computed beat is recorded in the scene's `provenance` (`algorithm`, `target`, `data: given | illustrative`, the beat ids).

Neighbours are taken in the order edges are listed. Preconditions are checked (a sorted array for binary search, non-negative weights for Dijkstra) and the error says what to change. Table cells are parts: `dp.r2c3` (data row 2, column 3) — `set` and `highlight` reach them; `clear` on a table clears its cells.

## Parameters (sliders)

A scene can give the learner inputs to change. Everything bound to them is recomputed and the board redraws at the same step.

```jsonc
"params":  [{ "id": "v0", "label": "launch speed v₀", "value": 20, "min": 5, "max": 25, "step": 0.5, "unit": "m/s" },
            { "id": "theta0", "value": 45, "min": 15, "max": 75, "unit": "deg" },
            { "id": "g", "value": 9.8, "min": 9.8, "max": 9.8, "unit": "m/s^2" }],        // min = max: a constant, no slider
"derived": [{ "id": "R", "label": "range", "expr": "v0^2*sin(2*theta0)/g", "unit": "m", "digits": 1 }]
```

| Use | Where | Example |
|---|---|---|
| name it in an expression | `plot.expr`, `curve.x/y/r`, `derived.expr` | `"x*tan(theta0) - g*x^2/(2*v0^2*cos(theta0)^2)"` |
| `"=expr"` in any numeric field | coordinates, `domain`, `magnitude`, `angleDeg`, refline `x`/`y`… | `"at": ["=R/2", "=H"]`, `"domain": [0, "=R"]` |
| `{{id}}` / `{{id:2}}` in text | `text`, `latex`, `label` | `"range {{R}} m"` |

- **Units** are SI (`m`, `m/s`, `m/s^2`, `N/m`, `kg`, `s`, `1/s`, `J`, `W`, `Pa`, `V`, `A`, `ohm`, `F`…); `deg` for angles — shown in degrees, used in radians by `sin`/`cos`, kept in degrees in `angleDeg`/`degrees`/`turn` fields. Spaces may declare `xUnit`/`yUnit`.
- **Dimensional checks** (`units.ts`): a derived quantity must work out in its unit; sums must be of like quantities; `sin`/`exp`/… take dimensionless arguments; a plot must be in its space's `yUnit` (with `x` in `xUnit`); a bound coordinate in its axis unit. Numbers are dimensionless, so write physical constants (g) as parameters.
- **Range sweep**: the scene is validated at the defaults *and* at each slider's minimum and maximum (and all at once), so it can't be valid at 20 m/s and fly off the axes at 25.
- The validator stores every use as a **binding** (`{ id, field, kind, src }`) next to the resolved numbers: a saved scene is plain Scene Language that any renderer can draw, and the client re-applies the bindings when a slider moves (`params.ts`, `SceneEngine.setParams`, `ParamPanel.jsx`).
- **Saved with the lesson**: slider values are kept with the learner's place in it (`lessonProgress.params` on the artifact, `PATCH /api/artifact/:id/progress`). A reopened lesson loads with them (clamped to each slider's range; unknown names ignored), and a doubt answered on the board leaves them as they were. The scene itself is never rewritten — the values are applied through the stored bindings.
- Not allowed: parameters inside geometry-by-intent objects (`"at": {"from", "angleDeg": "=…"}`) — write the coordinates as expressions instead. At most 6 parameters, 12 derived quantities.

## Plot expressions

`expr` is a function of `x` evaluated by `server/engine/scene/expr.ts` (no `eval`; the client draws with the same code):
numbers, `x`, `+ - * / ^`, parentheses, implicit multiplication (`2(x+1)`, `4x`), `pi`/`π`, `e`, degrees (`45deg`, `45°`),
`sin cos tan asin acos atan sinh cosh tanh exp ln log sqrt abs floor ceil sign`. Sampling refines steep stretches and
breaks the curve at poles and jumps, so `tan(x)` and `1/(x-1)` are never joined across their asymptotes. A `label` is drawn
beside the end of the curve in its colour.

## Validation (what `validateScene` enforces)

- Shape and limits (≤ 60 entities, ≤ 12 beats, ≤ 24 actions per beat).
- Unique ids; every reference resolves, including parts and indices.
- Actions suit their targets (`swap` needs an indexed type, `pop` only on stacks, `trace` a body along a plot…).
- Data structures are simulated beat by beat: no popping an empty stack, no index past the end.
- Domain-unit entities name a defined space; coordinates without a space are rejected.
- Use-before-create is auto-fixed (a `create` is inserted, with a warning); set `autofix: false` to report it instead.
- Warnings (not errors): beats that change nothing, entities never shown, conflicting placements.
- **Domain checks** (`domainChecks.ts`, one entry per entity type) — is the drawing true?
  - `plot`: the expression evaluates; the curve appears inside its space (error), and not as a < 15 % stub (warning).
  - `curve`: evaluates over its `t` range and appears in its space.
  - `area`: its domain lies within the plot's; `refline`: inside its space.
  - `point`, `body`: inside their space (3 % margin) — otherwise invisible or clipped.
  - `point`: with `on`, or a label naming it a root / zero / x-intercept / vertex / max / min / peak / apex / turning point / intercept / intersection / half-life, it must lie on a curve in its space (within 1.5 % of the frame). A root must have f(x) ≈ 0; a max/min/vertex must be a turning point — the repair message gives the exact turning point and f(x).
  - `compartment`: part ids unique, `in` names a part (not a membrane) without cycles; every part fits inside its parent and every label fits beside the diagram (the shared layout in `compartments.ts` reports what doesn't); labels unique (copies use `count`); a kind of cell named in the label can't contain what it doesn't have (no nucleus or mitochondria in a prokaryote, no cell wall or chloroplasts in an animal cell, no centrioles in a plant cell); a nucleolus/chromatin sits inside a nucleus, cristae/matrix inside a mitochondrion, thylakoids/grana/stroma inside a chloroplast. Missing defining structures (a plant cell without a cell wall) are warnings.
  - `circuit`: every net touches at least two terminals (no dangling ends), no part with both ends on one net, a battery present and not shorted by wires, all nets connected, values present (V, Ω, F), and one consistent DC solution (two batteries fighting in parallel are refused).
  - `logic`: names unique, gate inputs exist, input counts fit the gate (NOT 1, others 2–4), no feedback loops, every input used. Any `table` whose columns name the inputs and an output is checked row by row against the circuit.
  - `reaction`: reactants and products are molecule entities, each once; elements and total charge balance with the coefficients — the message lists what differs per element.
  - `curly`: starts at a lone pair (declared, or an anion's) or a bond — an atom only with `electrons: 1`; ends at an atom or a bond, never a lone pair; both ends inside molecules.
  - `molecule`: wedge/dash only on single bonds (error); the first atom of a wedge/dash should be a stereocentre with 3–4 bonds (warning).
  - `molecule`: each atom within its valence for its formal charge (C 4, N 3 or 4 with `charge: 1`, O 2, period-3 atoms may expand); no bond listed twice; a formula `label` ("C7H8", "SO₄²⁻") matches the atoms; a neutral atom short of bonds when hydrogens are drawn is a warning.

`formatIssuesForRepair(issues)` turns errors into a compact list for a repair round with the model.
