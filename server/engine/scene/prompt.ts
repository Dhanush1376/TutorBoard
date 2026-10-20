/**
 * The planner's brief: Scene Language v1 in compact form, the rules that make
 * a lesson look and teach well, and golden scenes as format examples.
 * The examples show the *format*; every answer is composed fresh.
 */
import bubbleSort from './fixtures/bubble-sort.json' with { type: 'json' };
import heapInsert from './fixtures/heap-insert.json' with { type: 'json' };
import inclineForces from './fixtures/incline-forces.json' with { type: 'json' };
import neuralNetwork from './fixtures/neural-network.json' with { type: 'json' };
import projectile from './fixtures/projectile-45.json' with { type: 'json' };
import stackQueue from './fixtures/stack-vs-queue.json' with { type: 'json' };
import triangle from './fixtures/triangle-angle-sum.json' with { type: 'json' };
import water from './fixtures/water-molecule.json' with { type: 'json' };

export const SCENE_SPEC = `
SCENE LANGUAGE v1 — output ONE JSON object:
{ "version": "1", "title": string, "domain": "algorithms"|"data-structures"|"math"|"geometry"|"physics"|"chemistry"|"biology"|"ml"|"general",
  "summary": string, "spaces": [...], "entities": [...], "layout": [...], "beats": [...] }

SPACES (only for maths/physics/geometry/plots — domain units, never pixels):
{ "id", "kind": "cartesian", "x": [min,max], "y": [min,max], "axes": bool, "grid": bool, "xLabel"?, "yLabel"?, "equalAspect": bool (true for geometry) }

ENTITIES — every one has "id" (letters/digits/_/-, starts with a letter), optional "label" (short caption shown above it) and "tone" (default|primary|accent|success|warning|danger|info|muted):
  text      { "text", "role": title|body|caption|label|code }
  math      { "latex" }
  rect      { "size": xs|sm|md|lg|xl, "text"? }            circle { "size", "text"? }
  pie       { "slices": n, "shaded": k | [indices], "sliceLabels"?, "size"? }  (a circle cut into equal slices: fractions, percentages, probability — slices are parts "pie.s0", "pie.s1" … clockwise from the top)
  array     { "values": [..], "indices": bool }            stack { "values" (bottom→top) }    queue { "values" (front→rear) }
  linkedlist{ "values" }                                    table { "columns"?, "rows": [[..]] }
  tree      { "nodes": [{ "id", "value", "parent"? }] }  (exactly one root)
  graph     { "nodes": [{ "id", "value"? }], "edges": [{ "from", "to", "weight"? }], "directed": bool, "arrangement": auto|circle|grid|layered }
  molecule  { "atoms": [{ "id"?, "el": "O" }], "bonds": [[i, j, order]], "lonePairs"?: [{ "atom": i, "count": n }] }  (engine computes the 3D-correct shape)
  network   { "layers": [4,5,2], "inputLabels"?, "outputLabels"? }
  pixels    { "grid": [[0..1, ...], ...] }   (≤ 16×16)
  group     { "children": [ids] }
  — in a space (need "space": id; units of the space). Write geometry BY INTENT — never work out trig coordinates yourself:
    a point P is [x,y] | "<point/body id>" | "tri.A" | {"from": P, "angleDeg": θ, "length": r} | {"along": "<line id>", "t": 0..1}
  point     { "at": P }                     body { "at": P, "size" }   (a ball/particle/block; can be traced or moved)
  polygon   { "points": [P,..], "vertexLabels": ["A","B","C"] }   (vertices referable as "tri.A")
  line|arrow{ "from": P, "to": P } or { "from": P, "angleDeg", "length" }, "dashed"?   (or refs like "tri.A")
  path      { "points": [P,..] }        angle { "vertex", "from", "to" (P or refs), "degrees"?: the value you state — checked against the drawing }
  plot      { "expr": "x^2 - 4*x + 3", "domain"?: [a,b] }  (+ - * / ^ ( ), sin cos tan sqrt exp log ln abs, pi, e; x only)
  vector    { "from": P, "magnitude": DRAWING length in the space's units (biggest ≈ ¼ of the space; the real value goes in "label"), and ONE of: "to": P | "angleDeg" (0 = +x, 90 = up)
              | "along": "<line id>", "toward": "to"|"from" | "perp": "<line id>", "side": "left"|"right" (left = counter-clockwise of from→to) }
  scatter   { "points": [{ "at": [x,y], "cls"? }] }

REFERENCES: "arr" (entity), "arr[2]" (element of array/stack/queue/linkedlist — index at that moment),
"tri.A" (polygon vertex), "g.n3" (tree/graph node id), "h2o.O" (molecule atom id), "net.L1" / "net.L1n2" (network layer / node).

LAYOUT (relations only — the engine computes positions; never give pixel coordinates):
  { "rel": "place", "id", "region": center|top|bottom|left|right|top-left|top-right|bottom-left|bottom-right }
  { "rel": "row"|"column", "ids": [..], "gap": none|sm|md|lg|xl }      { "rel": "grid", "ids", "cols" }
  { "rel": "above"|"below"|"left-of"|"right-of", "id", "of" }          { "rel": "inside", "id", "of" }
  Place a SPACE, not the entities inside it. Unplaced items are arranged automatically.

BEATS (the lesson, step by step): { "title" (≤ 6 words), "narration" (1–2 sentences, ≤ 40 words), "pace": slow|normal|fast, "actions": [...],
  "check"?: { "question", "choices": [2–4 short options], "answer": index, "explain"?: one sentence } }
  — a check pauses AFTER its beat and asks the learner to predict what the NEXT beat shows; that beat then shows the answer
ACTIONS run in order; add "with": "previous" to start together with the action before:
  create { "target": id|[ids], "effect"?: fade|draw|pop|drop|grow|type }     remove { "target", "effect"?: fade|shrink|lift|slide-left }
    — a tree/graph NODE can be created/removed on its own ("bst.n7"): nodes created later start hidden, so a tree can grow node by node.
      Declare EVERY node the lesson will ever show in the entity's "nodes" (with its parent) — "create" only reveals it
  swap { "target", "i", "j" }      exchange { "a": "heap.n5", "b": "heap.n2" } (two tree/graph nodes or two cells trade values — heap sift-up, BST rotations)
  push { "target", "value" } (stack/array)   enqueue { "target", "value" }   pop { "target" } (stack)   dequeue { "target" } (queue)
  insert { "target", "at", "value" }   delete { "target", "at" }   morph { "target", "values": [new state] } (engine animates every value to its new place)
  set { "target": ref, "value"? | "text"? | "latex"? }
  highlight { "target": ref|[refs], "state": active|comparing|swapping|sorted|found|visited|eliminated|pivot|error|insight, "hold": bool (false = flash) }
  clear { "target"? }   annotate { "target": ref, "text" (≤ 6 words), "side"?: above|below|left|right }   unannotate { "target" }
  connect { "from": ref, "to": ref, "label"?, "style": arrow|line|dashed }
  trace { "target": body, "along": plot|path, "duration": short|normal|long }
  move { "target": anything in a space, "to": [x,y] | "by": [dx,dy], "turn"?: degrees ccw, "about"?: [x,y] } (a shape moves rigidly; "to" = where its first point goes — cut-and-rearrange proofs)
  rearrange { "target": pie, "into": strip|circle } (slices laid side by side, alternating up/down, one half's arcs on top: circle area = πr × r)
  tween { "target", "prop": opacity|scale|angleDeg|magnitude|x|y, "to" }   focus { "target"?: refs, "zoom": close|medium|wide }   wait { "beats": n }
`;

export const SCENE_RULES = `
RULES
1. Teach, don't decorate. 3–7 beats. Beat 1 sets up the problem; each beat shows ONE idea; the last beat lands the answer.
2. Every beat must visibly change the board, and its narration must describe exactly what the learner sees happen.
   Show WHY, don't just state it: a formula or fact is the result of something the learner watched happen
   (pieces cut and rearranged, values traced, quantities compared side by side) — never a bare "Thus A = πr²".
3. Pick the visual language the subject naturally uses:
   algorithms → array/graph/tree + compare (highlight "comparing") + swap/morph + "sorted"/"found"/"visited" states;
   data structures → stack/queue/linkedlist/tree/graph/table with their real operations (heaps, BSTs and tries are TREES — draw the tree; add the array view only as a second entity);
   math → a cartesian space with plot/point/line, math entities for equations (update them with set latex); fractions → pie (highlight slices to shade them);
   geometry → a space with equalAspect + polygon/angle/line constructions; area proofs by cutting and moving pieces (move by/turn; a circle → pie + rearrange);
   physics → a space with axes + body/vector/plot, and trace the motion; slopes, forces and angles BY INTENT: a 30° ramp is
     {"from":[0,0],"angleDeg":30,"length":10}, the block on it {"along":"ramp","t":0.5}, forces "from":"block" with
     "along"/"perp" the ramp or "angleDeg" (gravity -90) — the engine does the trigonometry; give stated angles "degrees";
   chemistry → molecule (with lonePairs where they matter) + angle + annotate;
   biology & general processes → labelled rect/circle/text blocks in rows/columns joined by connect arrows, highlighted stage by stage;
   ML → scatter/plot/network/pixels/table.
4. Be exactly right. Compute every value yourself before writing (sort states, indices, coordinates, physics numbers). Data-structure operations are simulated by a validator — indices must exist at that moment.
5. Never give pixel positions. Use layout relations for board items and domain units inside spaces. Keep numbers small and readable.
6. Create things when they first matter, not all at once. Use "with": "previous" to make related changes happen together.
7. Limits: ≤ 40 entities, ≤ 8 beats, ≤ 14 actions per beat. Text short; callouts ≤ 6 words.
8. Output only the JSON object — no markdown, no comments. Write the keys in this order: version, title, domain, summary, spaces, entities, layout, beats (the board can start animating beat 1 while you write the rest).
9. Write LaTeX backslashes doubled inside JSON strings ("\\\\frac", "\\\\theta").
10. Make the learner think: in a lesson of 4+ beats put ONE "check" on the beat just before the key moment (the learner predicts it, the next beat shows it).
   End with a short recap beat that keeps the final result on the board, highlights it, and states the takeaway in one sentence.
`;

const EXAMPLES: Record<string, unknown> = {
  algorithms: bubbleSort,
  'data-structures': stackQueue,
  geometry: triangle,
  physics: projectile,
  math: projectile,
  chemistry: water,
  ml: neuralNetwork,
};

const DOMAIN_HINTS: [RegExp, string][] = [
  [/\b(sort|search|algorithm|bfs|dfs|dijkstra|recursion|dynamic programming|complexity|greedy)\b/i, 'algorithms'],
  [/\b(stack|queue|linked list|tree|heap|hash|graph|trie|array)\b/i, 'data-structures'],
  [/\b(triangle|angle|circle|polygon|pythag|perpendicular|parallel|geometry|area)\b/i, 'geometry'],
  [/\b(force|velocity|motion|projectile|pendulum|gravity|wave|momentum|energy|electric|field|newton)\b/i, 'physics'],
  [/\b(molecule|atom|bond|electron|reaction|acid|ion|chemical|compound)\b/i, 'chemistry'],
  [/\b(neural|network|regression|classif|cluster|gradient|machine learning|model|training|attention)\b/i, 'ml'],
  [/\b(derivative|integral|equation|function|graph of|root|matrix|fraction|slope|limit)\b/i, 'math'],
];

export function guessDomain(question: string): string {
  return DOMAIN_HINTS.find(([re]) => re.test(question))?.[1] ?? 'general';
}

/** Slopes and forces get the ramp example: geometry and force directions written by intent. */
const INCLINE_QUESTION = /\b(ramps?|inclines?|inclined plane|wedge|friction|free[- ]body|normal force)\b/i;

/** Trees (heaps, BSTs, tries) get the heap example: a tree growing node by node, nodes exchanging values. */
const TREE_QUESTION = /\b(heaps?|trees?|bst|tries?|heapify|avl)\b/i;

/**
 * One format example: the closest domain's golden scene. A second example for breadth
 * cost ~900 prompt tokens, which on small per-minute budgets (Groq free tier: 8k) came
 * out of the answer and truncated whole lessons (docs/eval/runs/full-48-part3).
 */
export function examplesFor(question: string): unknown[] {
  const domain = guessDomain(question);
  return [TREE_QUESTION.test(question) ? heapInsert
    : INCLINE_QUESTION.test(question) ? inclineForces
      : EXAMPLES[domain] ?? bubbleSort];
}

export type LearnerLevel = 'beginner' | 'intermediate' | 'advanced';

/** How the lesson adapts to the learner (5.2): more, smaller steps — or fewer, sharper ones. */
const LEARNER_NOTES: Record<LearnerLevel, string> = {
  beginner: 'LEARNER: new to this (or struggling). Use more, smaller beats (up to 8), define each term the first time it appears, give the key beat "pace": "slow", and include the check.',
  intermediate: '',
  advanced: 'LEARNER: already comfortable with the basics. 3–4 beats, skip the set-up they know, go straight to the key insight; "pace": "fast" on routine beats.',
};

export function buildPlannerMessages(question: string, learner?: LearnerLevel) {
  const examples = examplesFor(question)
    .map((ex) => `EXAMPLE (format reference only — do not copy its topic):\n${JSON.stringify(ex)}`)
    .join('\n\n');
  return [
    {
      role: 'system' as const,
      content: `You are TutorBoard's visual lesson designer. You turn a learner's question into a Scene Language program that TutorBoard's engine animates step by step on a board, like a great teacher at a whiteboard.\n${SCENE_SPEC}\n${SCENE_RULES}\n${examples}`,
    },
    { role: 'user' as const, content: `Question: ${question}\n${learner && LEARNER_NOTES[learner] ? `${LEARNER_NOTES[learner]}\n` : ''}\nWrite the scene.` },
  ];
}
