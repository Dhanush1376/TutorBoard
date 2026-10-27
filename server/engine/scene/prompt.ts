/**
 * The planner's brief: Scene Language v1 in compact form, the rules that make
 * a lesson look and teach well, and golden scenes as format examples.
 * The examples show the *format*; every answer is composed fresh.
 */
import bubbleSort from './fixtures/bubble-sort.json' with { type: 'json' };
import heapInsert from './fixtures/heap-insert.json' with { type: 'json' };
import plantCell from './fixtures/plant-cell.json' with { type: 'json' };
import inclineForces from './fixtures/incline-forces.json' with { type: 'json' };
import combustion from './fixtures/methane-combustion.json' with { type: 'json' };
import neuralNetwork from './fixtures/neural-network.json' with { type: 'json' };
import projectile from './fixtures/projectile-45.json' with { type: 'json' };
import sn2 from './fixtures/sn2-mechanism.json' with { type: 'json' };
import stackQueue from './fixtures/stack-vs-queue.json' with { type: 'json' };
import triangle from './fixtures/triangle-angle-sum.json' with { type: 'json' };
import water from './fixtures/water-molecule.json' with { type: 'json' };

export const SCENE_SPEC = `
SCENE LANGUAGE v1 — output ONE JSON object:
{ "version": "1", "title": string, "domain": "algorithms"|"data-structures"|"math"|"geometry"|"physics"|"chemistry"|"biology"|"ml"|"general",
  "summary": string, "spaces": [...], "entities": [...], "layout": [...], "beats": [...], "params"?: [...], "derived"?: [...] }

PARAMS (sliders — when the learner should try "what if"; physics especially; 1–3 sliders):
  "params": [{ "id": "v0", "label": "launch speed", "value": 20, "min": 5, "max": 25, "step": 0.5, "unit": "m/s" }]  (SI units; "deg" for angles; min = max is a fixed constant like g)
  "derived": [{ "id": "R", "label": "range", "expr": "v0^2*sin(2*theta0)/g", "unit": "m", "digits": 1 }]
  use them: plot/curve expressions name them ("x*tan(theta0) - g*x^2/(2*v0^2*cos(theta0)^2)"); numbers as "=expr" ("at": ["=R/2", "=H"], "domain": [0, "=R"], "angleDeg": "=theta0");
  text/latex/labels show values with {{R}}. Give spaces "xUnit"/"yUnit". Units are checked; the scene is checked at every slider's min and max — size spaces for the extremes.

SPACES (only for maths/physics/geometry/plots — domain units, never pixels):
{ "id", "kind": "cartesian", "x": [min,max], "y": [min,max], "axes": bool, "grid": bool, "xLabel"?, "yLabel"?, "equalAspect": bool (true for geometry), "xScale"/"yScale"?: "log" (range > 0; for decay, pH, decibels, orders of magnitude), "xUnit"/"yUnit"?: SI unit of each axis }

ENTITIES — every one has "id" (letters/digits/_/-, starts with a letter), optional "label" (short caption shown above it) and "tone" (default|primary|accent|success|warning|danger|info|muted):
  text      { "text", "role": title|body|caption|label|code }
  math      { "latex" }
  rect      { "size": xs|sm|md|lg|xl, "text"? }            circle { "size", "text"? }
  pie       { "slices": n, "shaded": k | [indices], "sliceLabels"?, "size"? }  (a circle cut into equal slices: fractions, percentages, probability — slices are parts "pie.s0", "pie.s1" … clockwise from the top)
  array     { "values": [..], "indices": bool }            stack { "values" (bottom→top) }    queue { "values" (front→rear) }
  linkedlist{ "values" }                                    table { "columns"?, "rows": [[..]] }
  tree      { "nodes": [{ "id", "value", "parent"? }] }  (exactly one root)
  graph     { "nodes": [{ "id", "value"? }], "edges": [{ "from", "to", "weight"? }], "directed": bool, "arrangement": auto|circle|grid|layered }
  molecule  { "atoms": [{ "id"?, "el": "O", "charge"? }], "bonds": [[i, j, order, "wedge"|"dash"?]], "lonePairs"?: [{ "atom": i, "count": n }] }  (engine computes the shape; rings drawn as regular polygons. Draw every H. Aromatic rings in Kekulé form: alternate 1 and 2. Valence is checked: C 4 bonds, N 3 (4 with "charge": 1), O 2. A formula "label" must match the atoms)
  compartment { "label": "Plant cell", "shape": round|oval|rect, "size": sm|md|lg, "parts": [{ "id", "label", "in"?: "<part id>", "shape": round|oval|rect|bean|stack|dot|membrane, "size": xs|sm|md|lg, "count"? }] }
            (labelled diagram of nested regions — a cell and its organelles, an organ and its tissues; the engine places every part inside its parent and labels each with a leader line; "membrane" = an outline of its parent: cell wall, cell membrane, nuclear envelope; parts are refs "cell.nucleus")
  circuit   { "components": [{ "id": "V1", "kind": battery|resistor|lamp|capacitor|switch|wire|ammeter|voltmeter, "from": "n0", "to": "n1", "value"?: V/Ω/F, "closed"? }], "ground"? }
            (nets are names; a battery's "to" is +; the engine draws the schematic and checks it is closed and solvable; parts and nets are refs "c.R1", "c.n2")
  logic     { "inputs": ["A","B"], "gates": [{ "id": "g1", "op": and|or|not|nand|nor|xor|xnor, "in": ["A","B"] }], "outputs": [{ "id": "Y", "from": "g1" }] }  (a truth table in the scene is checked against it)
  network   { "layers": [4,5,2], "inputLabels"?, "outputLabels"? }
  pixels    { "grid": [[0..1, ...], ...] }   (≤ 16×16)
  group     { "children": [ids] }
  — in a space (need "space": id; units of the space). Write geometry BY INTENT — never work out trig coordinates yourself:
    a point P is [x,y] | "<point/body id>" | "tri.A" | {"from": P, "angleDeg": θ, "length": r} | {"along": "<line id>", "t": 0..1}
  point     { "at": P, "on"?: "<plot/curve id>" }   (a point labelled root/vertex/max/min/intercept/half-life must lie on its curve — checked)
  body { "at": P, "size" }   (a ball/particle/block; can be traced or moved)
  polygon   { "points": [P,..], "vertexLabels": ["A","B","C"] }   (vertices referable as "tri.A")
  line|arrow{ "from": P, "to": P } or { "from": P, "angleDeg", "length" }, "dashed"?   (or refs like "tri.A")
  path      { "points": [P,..] }        angle { "vertex", "from", "to" (P or refs), "degrees"?: the value you state — checked against the drawing }
  plot      { "expr": "x^2 - 4*x + 3", "domain"?: [a,b], "label"? }  (+ - * / ^ ( ), sin cos tan sqrt exp log ln abs, pi, e, 45deg; x only. Breaks at asymptotes by itself)
  curve     { "x": "cos(t)", "y": "sin(t)", "t": [0, "2pi"] } parametric | { "r": "1 + cos(θ)", "t": [0, "2pi"] } polar
  area      { "plot": "<plot id>", "to"?: 0 | "<plot id>", "domain"?: [a,b] }   (shaded region: integrals, work = area under F–x)
  refline   { "x": a } or { "y": b }, "label"?   (dashed full-width line: asymptote, equilibrium, threshold, half value)
  vector    { "from": P, "magnitude": DRAWING length in the space's units (biggest ≈ ¼ of the space; the real value goes in "label"), and ONE of: "to": P | "angleDeg" (0 = +x, 90 = up)
              | "along": "<line id>", "toward": "to"|"from" | "perp": "<line id>", "side": "left"|"right" (left = counter-clockwise of from→to) }
  scatter   { "points": [{ "at": [x,y], "cls"? }] }

REFERENCES: "arr" (entity), "arr[2]" (element of array/stack/queue/linkedlist — index at that moment),
"tri.A" (polygon vertex), "g.n3" (tree/graph node id), "h2o.O" (molecule atom id), "m.C1-Br" (bond), "m.lp-O" (lone pair), "net.L1" / "net.L1n2" (network layer / node).

LAYOUT (relations only — the engine computes positions; never give pixel coordinates):
  { "rel": "place", "id", "region": center|top|bottom|left|right|top-left|top-right|bottom-left|bottom-right }
  { "rel": "row"|"column", "ids": [..], "gap": none|sm|md|lg|xl }      { "rel": "grid", "ids", "cols" }
  { "rel": "above"|"below"|"left-of"|"right-of", "id", "of" }          { "rel": "inside", "id", "of" }
  Place a SPACE, not the entities inside it. Unplaced items are arranged automatically.

BEATS (the lesson, step by step): { "title" (≤ 6 words), "narration" (1–2 sentences, ≤ 40 words), "pace": slow|normal|fast, "actions": [...],
  "check"?: { "question", "choices": [2–4 short options], "answer": index, "explain"?: one sentence } }
  — a check pauses AFTER its beat and asks the learner to predict what the NEXT beat shows; that beat then shows the answer
COMPUTED TRACES — for these algorithms do NOT write the steps: write one beat { "title", "narration": "computed", "compute": { "algorithm", "target", "args" } }
  and TutorBoard runs the algorithm on the target's real values and writes every step (pointers, swaps, queue, distances, table cells, narration):
  binary-search (sorted array; args.find) · sliding-window (array; args.k + "mode": max-sum|min-sum, or "mode": "longest-unique") · bubble-sort | insertion-sort | selection-sort (array ≤ 12)
  · bfs | dfs | dijkstra (graph; args.start; dijkstra needs number weights) · fibonacci (args.n) · coin-change (args.coins, args.amount) · lcs (args.a, args.b) · knapsack (args.weights, values, capacity)
  · ML (target = a new space/table id): gradient-descent (args.f in x, x0, lr, steps) · k-means (args.k, "points": [[x,y],…]) · linear-regression ("points")
  · perceptron ("points": [[x,y,"A"],…]) · confusion-matrix (args.actual, predicted, positive?). Give real data when the question has it; with "generate" instead
  of points the data is made up and the board says "illustrative".
  · engineering: circuit-solve (target a circuit: voltages, currents, KCL, power) · rc-charging (circuit with one capacitor; args.v0) · truth-table (target a logic circuit)
  · beam (new id; args.length m, "loads": [{ "at": m, "F": kN }], "udl"?: kN/m → reactions, shear-force and bending-moment diagrams)
  — DP ones create their own table/array under "target". Set the scene up in earlier beats; add a takeaway beat after.
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
   algorithms → array/graph/tree + compare (highlight "comparing") + swap/morph + "sorted"/"found"/"visited" states — and a COMPUTED TRACE whenever the algorithm is in that list;
   data structures → stack/queue/linkedlist/tree/graph/table with their real operations (heaps, BSTs and tries are TREES — draw the tree; add the array view only as a second entity);
   math → a cartesian space with plot/point/line, math entities for equations (update them with set latex); fractions → pie (highlight slices to shade them);
   geometry → a space with equalAspect + polygon/angle/line constructions; area proofs by cutting and moving pieces (move by/turn; a circle → pie + rearrange);
   physics → a space with axes + body/vector/plot, and trace the motion; slopes, forces and angles BY INTENT: a 30° ramp is
     {"from":[0,0],"angleDeg":30,"length":10}, the block on it {"along":"ramp","t":0.5}, forces "from":"block" with
     "along"/"perp" the ramp or "angleDeg" (gravity -90) — the engine does the trigonometry; give stated angles "degrees";
     motion, oscillation, circuits and gas laws → PARAMS with sliders so the learner can change the inputs;
     electric circuits → a circuit entity + circuit-solve / rc-charging (never write currents yourself); digital logic → a logic entity + truth-table;
     beams and structures → beam;
   chemistry → molecule (with lonePairs where they matter) + angle + annotate; equations → reaction
     { "reactants": ["ch4", {"id": "o2", "n": 2}], "products": [...], "arrow": "forward"|"equilibrium", "conditions"? } over molecule entities (atoms and charge must balance);
     mechanisms → curly { "from": "m.lp-O" | "m.C1-Br", "to": "m.C1" | "m.C1-C2", "electrons": 2|1 } (electrons leave a lone pair or a bond, arrive at an atom or a bond), one beat per arrow, then the products;
   biology structures → compartment (≤ 12 labelled parts; what a cell can't have is checked: no nucleus in a bacterium, no cell wall in an animal cell; a nucleolus goes "in" the nucleus), compared diagrams stacked in a column;
   biology & general processes → labelled rect/circle/text blocks in rows/columns joined by connect arrows, highlighted stage by stage;
   ML → network (layers from the question) / scatter / plot / pixels / table, and a COMPUTED TRACE for training, fitting, clustering and metrics — never invent loss values or accuracies.
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
  [/\b(molecule|atom|bond|electron|reaction|acid|ion|chemical|compound|sn[12]|e[12] elimination|nucleophil\w*|electrophil\w*|benzene|organic|chiral\w*|stereo\w*|combustion|stoichiometr\w*|electrochemi\w*|galvanic|voltaic|electroly\w*)\b/i, 'chemistry'],
  [/\b(neural|network|regression|classif|cluster|gradient|machine learning|model|training|attention)\b/i, 'ml'],
  [/\b(derivative|integral|equation|function|graph of|root|matrix|fraction|slope|limit)\b/i, 'math'],
  // last, so "root of an equation" stays maths and "electrochemical cell" chemistry
  [/\b(cells?|organelles?|mitochondri\w*|chloroplasts?|nucleus|nuclei|bacteri\w*|virus\w*|photosynthesis|respiration|dna|rna|proteins?|enzymes?|tissues?|organs?|heart|lungs?|kidneys?|nephrons?|leaf|leaves|stems?|plants?|animals?|mitosis|meiosis|genes?|genetics?|anatomy|biology)\b/i, 'biology'],
];

export function guessDomain(question: string): string {
  return DOMAIN_HINTS.find(([re]) => re.test(question))?.[1] ?? 'general';
}

/** Slopes and forces get the ramp example: geometry and force directions written by intent. */
const INCLINE_QUESTION = /\b(ramps?|inclines?|inclined plane|wedge|friction|free[- ]body|normal force)\b/i;

/** Reaction mechanisms get the SN2 example (curly arrows from lone pairs and bonds); equations to balance get combustion. */
const MECHANISM_QUESTION = /\b(mechanisms?|sn[12]|e[12]|nucleophil\w*|electrophil\w*|curly arrows?|arrow[- ]pushing|carbocation|leaving group)\b/i;
/** Structures (cells, organelles, organs) get the plant-cell example: a labelled compartment diagram. */
const STRUCTURE_QUESTION = /\b(cells?|organelles?|structure|anatomy|parts? of|labell?ed|diagram|organs?|tissues?|bacteri\w*|chloroplasts?|mitochondri\w*|nucleus)\b/i;
const EQUATION_QUESTION = /\b(balanc\w*|chemical equations?|combustion|stoichiometr\w*|reactants?|products?)\b/i;

/** Trees (heaps, BSTs, tries) get the heap example: a tree growing node by node, nodes exchanging values. */
const TREE_QUESTION = /\b(heaps?|trees?|bst|tries?|heapify|avl)\b/i;

/**
 * One format example: the closest domain's golden scene. A second example for breadth
 * cost ~900 prompt tokens, which on small per-minute budgets (Groq free tier: 8k) came
 * out of the answer and truncated whole lessons (docs/eval/runs/full-48-part3).
 */
export function examplesFor(question: string): unknown[] {
  const domain = guessDomain(question);
  const chem = domain === 'chemistry';
  return [TREE_QUESTION.test(question) ? heapInsert
    : chem && MECHANISM_QUESTION.test(question) ? sn2
      : chem && EQUATION_QUESTION.test(question) ? combustion
        : domain === 'biology' && STRUCTURE_QUESTION.test(question) ? plantCell
        : INCLINE_QUESTION.test(question) && !chem ? inclineForces // "wedge" is also a stereo bond
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
