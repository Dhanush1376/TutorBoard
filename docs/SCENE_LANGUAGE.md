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

### Entities

Every entity has `id` (letters/digits/`_`/`-`, starts with a letter), optional `label` and `tone`
(`default primary accent success warning danger info muted`).

| Group | Type | Key fields |
|---|---|---|
| Text | `text` | `text`, `role` (`title body caption label code`) |
| | `math` | `latex` |
| Shapes (board) | `rect`, `circle` | `size` (`xs`…`xl`), `text` |
| Shapes (space) | `point` | `space`, `at: [x, y]` |
| | `polygon` | `space`, `points`, `vertexLabels` (enables `tri.A`), `fill` |
| | `line`, `arrow` | `from`, `to` — coordinates (needs `space`) or refs (`"tri.A"`), `dashed` |
| | `path` | `space`, `points`, `smooth` |
| | `angle` | `vertex`, `from`, `to` (refs or coordinates), `showValue` |
| Functions & physics | `plot` | `space`, `expr` (function of `x`), `domain` |
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
| Science & ML | `molecule` | `atoms: [{ id, el }]`, `bonds: [[i, j, order]]`, `lonePairs` — the engine computes geometry |
| | `network` | `layers: [4, 5, 2]`, `inputLabels`, `outputLabels` |
| | `pixels` | `grid` of 0–1 brightness |
| Composition | `group` | `children` |

### References

`arr` (entity) · `arr[2]` (element of an array/stack/queue/linked list, checked against
its length *at that moment*) · `tri.A` (polygon vertex) · `g.n3` (tree/graph node) ·
`h2o.O` (molecule atom id) · `net.L1`, `net.L1n2` (network layer / node).

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

## Validation (what `validateScene` enforces)

- Shape and limits (≤ 60 entities, ≤ 12 beats, ≤ 24 actions per beat).
- Unique ids; every reference resolves, including parts and indices.
- Actions suit their targets (`swap` needs an indexed type, `pop` only on stacks, `trace` a body along a plot…).
- Data structures are simulated beat by beat: no popping an empty stack, no index past the end.
- Domain-unit entities name a defined space; coordinates without a space are rejected.
- Use-before-create is auto-fixed (a `create` is inserted, with a warning); set `autofix: false` to report it instead.
- Warnings (not errors): beats that change nothing, entities never shown, conflicting placements.

`formatIssuesForRepair(issues)` turns errors into a compact list for a repair round with the model.
