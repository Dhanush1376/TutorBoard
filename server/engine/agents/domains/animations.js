/**
 * Domain Animation Guides
 */
export const DOMAIN_ANIMATION_GUIDE = {
  dsa: `
ANIMATION STRATEGY — DSA / ALGORITHMS:
  Primitives: array, pointer, swapbridge, comparator, codeline, highlightbox
  Layout rules:
    - Array Sorting/Searching: STRICTLY use a SINGLE 'array' shape with a 'values' property (e.g. "values": [5,2,9,1]). Do NOT draw an array as multiple disconnected rectangles or flowcharts.
    - Swapping: Use 'swapbridge' to show swaps between indices.
    - Pointers: Use 'pointer' shape pointing to array indices.
    - Trees/graphs: root at (0.5, 0.2), children below. circle=node, type: "line"=edge.
  Step rhythm:
    - One comparison = one step. One swap = one step. One pointer move = one step.
    - codeline (x=0.2) shows pseudocode; highlight current executing line each step.
  MINIMUM STEPS: sorting=12 | searching=8 | trees=12 | graph traversal=14 | dp=16
`,
  mathematics: `
ANIMATION STRATEGY — MATHEMATICS:
  Primitives: polygon, axes, dot, circle, line (connection), text, arc
  Layout rules:
    - Geometry: ALWAYS draw explicit shapes using 'polygon' with precise 'points' (e.g., [[-0.2, 0.2], [0.2, 0.2], [-0.2, -0.2]] for a right triangle). DO NOT string circles together as a flowchart.
    - Graphing/Functions: Use 'axes' for the background coordinate system.
    - Equations: Center label prominently.
    - Connections: Use "type": "line" for non-directional geometric edges.
  MINIMUM STEPS: calculus=12 | geometry=8 | matrices=10 | statistics=8
`,
  physics: `
ANIMATION STRATEGY — PHYSICS:
  Primitives: circle (particles/objects), arrow (forces/velocity/fields),
              path (trajectories/waves/field lines), arc (angles), rect (components)
  Layout rules:
    - Mechanics: center object, radiate force arrows outward/inward with labels.
    - Waves: path with sinusoidal d; animate wavelength/amplitude change step by step.
    - Circuits: rect=components, line=wires, text=values; left-to-right layout.
    - Optics: line=rays, arc=reflection angles; normal line dashed.
    - Show BEFORE state (steps 1–3) then animate AFTER state.
  MINIMUM STEPS: mechanics=12 | waves=10 | circuits=12 | thermodynamics=10 | optics=10
`,
  chemistry: `
ANIMATION STRATEGY — CHEMISTRY:
  Primitives: circle (atoms), arrow (electron movement/reaction direction),
              path (bonds/orbitals), badge (values/labels), dashed line (breaking bonds)
  Atom color convention: H=white | C=gray | O=red | N=blue | S=yellow | Cl=green | Na=purple
  Layout rules:
    - Reactants: LEFT (x=150–250). Products: RIGHT (x=550–700). Arrow: CENTER.
    - Bond breaking: dashed arrow. Bond forming: solid arrow.
    - Organic structures: line bonds, circle at atom vertices.
    - Periodic context: rect grid with element symbols.
    - pH/titration: badge for values, arrow for direction of change.
  MINIMUM STEPS: reactions=12 | bonding=10 | organic mechanisms=14 | titration=10
`,
  biology: `
ANIMATION STRATEGY — BIOLOGY:
  Primitives: circle (cells/organelles), path (membranes/DNA), arrow (signals/flow),
              badge (labels), rect (organ outlines)
  Color convention: plant cell=green | animal cell=pink | nucleus=blue |
                    mitochondria=yellow | ER=orange | vacuole=light-blue
  Layout rules:
    - Cell: large circle=boundary, smaller circles=organelles inside, badge=labels.
    - DNA/genetics: path for double helix, text for base pairs (A–T, G–C).
    - Body systems: rect/circle=organs, arrow=blood flow/nerve signals.
    - Evolution: horizontal timeline rect nodes connected by arrows.
  MINIMUM STEPS: cell division=14 | genetics=12 | body systems=10 | photosynthesis=12
`,
  medicine: `
ANIMATION STRATEGY — MEDICINE / CLINICAL:
  Primitives: circle (cells/organs), rect (structures/chambers), arrow (flow/signals),
              path (vessels/nerves), badge (clinical values), highlightbox (key finding)
  Color convention: arterial=red | venous=blue | lymphatic=yellow | nerve=green
  Layout rules:
    - Anatomy: build region step by step, badge each structure.
    - Pathophysiology: normal state (steps 1–3) → diseased state (steps 4+).
    - Pharmacology: drug→receptor→effect as arrow chain.
    - Clinical procedures: sequential rect steps with arrow connectors.
    - Heart: two rects (left/right), arrows for blood flow direction.
  MINIMUM STEPS: anatomy=12 | pathophysiology=14 | pharmacology=10 | procedures=12
`,
  computer_science: `
ANIMATION STRATEGY — COMPUTER SCIENCE:
  Primitives: rect (components/layers), arrow (data flow/API calls),
              circle (services/nodes), codeline (code), badge (labels)
  Layout rules:
    - OS: layered rects, hardware (bottom) → kernel → userspace → app (top).
    - Networking: rect nodes, arrow edges showing packet flow with labels.
    - Database: table as rect grid with row/column labels.
    - OOP: class diagram with rect boxes, arrow=inheritance/composition (labeled).
    - Web: three-tier (client→server→database) rects, left-to-right.
    - Code+execution: codeline (x=80, left half), execution state diagram (x=400+, right half).
  MINIMUM STEPS: OS=12 | networking=12 | databases=10 | OOP=10 | web=10 | distributed=14
`,
  engineering: `
ANIMATION STRATEGY — ENGINEERING:
  Primitives: rect (components/structures), arrow (forces/flow),
              path (beams/curves/waveforms), circle (joints/nodes), badge (values)
  Layout rules:
    - Mechanical free body: center object, force arrows pointing from/to it.
    - Electrical circuit: standard symbols (rect=resistor, circle=source), left-to-right.
    - Civil/structural: load arrows pointing DOWN, reaction arrows pointing UP.
    - Fluid: path shapes showing flow direction, arrow=velocity vector.
    - Label all forces, dimensions, and values with text/badge.
    - Control systems: block diagram rects with arrow signals, feedback loop shown.
  MINIMUM STEPS: circuit=12 | structures=10 | mechanisms=12 | fluid=10 | control=12
`,
  business: `
ANIMATION STRATEGY — BUSINESS:
  Primitives: rect (process boxes/org nodes), arrow (flow/hierarchy/relationships),
              badge (metrics/KPIs), text (labels), path (trend lines)
  Layout rules:
    - SWOT/frameworks: 4-quadrant rect layout, each quadrant labeled.
    - Processes: sequential rect boxes with arrow connectors (left→right or top→bottom).
    - Org chart: hierarchical tree, rect nodes, arrow edges.
    - Financials: rect bar chart with text values on top; highlight key bar.
    - Strategy canvas: left=resources, center=value proposition, right=market.
  MINIMUM STEPS: framework=10 | process=10 | case study=12 | financial=10
`,
  law: `
ANIMATION STRATEGY — LAW:
  Primitives: rect (parties/entities), arrow (relationships/flow of rights),
              badge (rulings/statutes), text (principles), highlightbox (key holding)
  Layout rules:
    - Case analysis: parties as rect on LEFT/RIGHT, court at center-top.
    - Legal process: sequential flowchart rect+arrow (left→right or top→bottom).
    - Contract: two rect parties connected by double-headed arrow, badge=key terms.
    - Constitutional hierarchy: constitution at top, statutes below, regulations below that.
    - Use highlightbox to emphasize the key legal principle in focus.
  MINIMUM STEPS: case study=10 | process=10 | principles=8 | constitutional=10
`,
  history: `
ANIMATION STRATEGY — HISTORY:
  Primitives: rect (events/periods), arrow (causation/influence/timeline),
              text (dates/names), badge (key figures/outcomes)
  Layout rules:
    - Timeline: horizontal sequence of rect events at y=280; arrows connecting cause→effect.
    - Empires/geography: spatial layout, regions as rect at approximate compass positions.
    - Battles: two forces as rect on LEFT/RIGHT, arrows showing movement/advance.
    - Revolution narrative: escalating sequence showing trigger→escalation→outcome.
    - Dates prominently in badge at top of each event rect.
  MINIMUM STEPS: timeline=10 | cause-effect=10 | biography=8 | battles=12
`,
  geography: `
ANIMATION STRATEGY — GEOGRAPHY:
  Primitives: path (coastlines/rivers), rect (regions), circle (cities/features),
              arrow (wind/current/migration), badge (labels/data), arc (latitude lines)
  Layout rules:
    - Maps: simplified outlines using path; label regions with badge.
    - Climate: arrow for wind/current direction, color gradient for temperature.
    - Population: rect bar charts for demographic data.
    - Processes (plate tectonics, water cycle): sequential arrow+shape animation.
    - Always include a scale/compass indicator in corner.
  MINIMUM STEPS: map=10 | climate=10 | process=10 | demographics=8
`,
  psychology: `
ANIMATION STRATEGY — PSYCHOLOGY:
  Primitives: circle (person/brain regions), arrow (behavior/thought flow),
              rect (theory models/stages), badge (concepts/labels)
  Layout rules:
    - Maslow / stage theories: stacked rect pyramid, bottom to top, label each level.
    - Behavioral models: stimulus (LEFT) → organism (CENTER) → response (RIGHT) arrow chain.
    - Brain regions: large circle=brain, smaller inner circles=regions with badge labels.
    - Experiments: show conditions as rect boxes, results as badge/bar.
    - Cognitive biases: before/after rect showing distorted vs accurate perception.
  MINIMUM STEPS: theories=10 | experiments=10 | brain=12 | therapy models=10
`,
  arts: `
ANIMATION STRATEGY — ARTS & DESIGN:
  Primitives: rect (composition zones/type blocks), circle (focal points),
              path (gesture/flow lines), text (typography examples), arc (color wheel)
  Layout rules:
    - Color theory: circle color wheel at center, arc segments for hue ranges.
    - Typography: rect text blocks at varying weights; arrow=hierarchy flow.
    - Composition: overlay grid/rule-of-thirds on rect canvas.
    - Design principles (Gestalt): before/after rect showing effect.
    - UI/UX: wireframe-style rect components; arrow=user flow.
  MINIMUM STEPS: color theory=10 | typography=8 | composition=10 | UI flow=12
`,
  economics: `
ANIMATION STRATEGY — ECONOMICS:
  Primitives: path (supply/demand curves), arrow (shifts), text (axis labels),
              rect (bars/zones), circle (equilibrium point), badge (values)
  Layout rules:
    - Supply/demand: rect axes, path=curves, circle=equilibrium; label P* and Q*.
    - Shifts: animate curve path moving left/right; badge showing new equilibrium.
    - Circular flow: circular arrow path; rect=households/firms at 12/6 o'clock.
    - GDP/indicators: stacked rect bar chart, each segment labeled.
    - Game theory: 2×2 rect matrix with payoffs in each cell.
  MINIMUM STEPS: supply-demand=12 | GDP=8 | market structures=10 | game theory=10
`,
  aviation_maritime: `
ANIMATION STRATEGY — AVIATION & MARITIME:
  Primitives: path (flight path/vessel track), arrow (forces/wind/current),
              circle (instruments/gauges), rect (cockpit panel/chart), badge (values)
  Layout rules:
    - Four forces of flight: center aircraft shape, four arrows (lift↑ drag← thrust→ weight↓).
    - Navigation: simplified map rect, path=route, badge=waypoints.
    - Instrument panel: circle instruments laid out as panel; animate needle movement.
    - Weather chart: rect map background, arrow=wind barbs, badge=METAR values.
    - Vessel colregs: two vessel shapes (circles), arrows showing course, badge=rule number.
  MINIMUM STEPS: forces=10 | navigation=12 | instruments=10 | weather=10 | rules=8
`,
  data_science: `
ANIMATION STRATEGY — DATA SCIENCE & ML:
  Primitives: axes, dot, circle, arrow, rect, badge, codeline
  Layout rules:
    - Clustering / Regression (Scatter Plots): Use a SINGLE 'axes' element securely in the center. Then, scatter multiple 'dot' elements (x,y points). NEVER use a flowchart.
    - Neural network: circles in column layers (input→hidden→output), weighted lines/arrows.
    - Decision tree: binary tree of rect nodes, arrow branches, badge=split condition.
    - Confusion matrix: 2×2 rect grid with values; color TP=green, FP=red, FN=orange, TN=gray.
  MINIMUM STEPS: plotting=8 | neural net=14 | training=12 | decision tree=10 | evaluation=8
`,
  cybersecurity: `
ANIMATION STRATEGY — CYBERSECURITY:
  Primitives: rect (systems/components), arrow (attack/defense flow),
              circle (actors/endpoints), badge (labels/CVE IDs), path (network links)
  Color convention: attacker=red | defender=green | compromised=orange | secure=blue
  Layout rules:
    - Attack chain (kill chain): sequential rect steps, arrow progression left→right.
    - Network attack: circle=host nodes, path=network, red arrow=attack vector.
    - Encryption: show plaintext rect → algorithm rect → ciphertext rect.
    - Auth flow: sequential rect states with arrow connectors and badge=token/credential.
    - Threat model: concentric circles (public→DMZ→internal→critical assets).
  MINIMUM STEPS: attack chain=12 | network=12 | crypto=10 | auth=10 | threat model=10
`,
  linguistics: `
ANIMATION STRATEGY — LINGUISTICS:
  Primitives: rect (morphemes/phrases/clauses), arrow (dependency/transformation),
              circle (phoneme nodes), path (intonation curves), text (IPA symbols), badge (labels)
  Layout rules:
    - Syntax tree: branching tree above the sentence; rect=phrase nodes, text=words.
    - Phonology: circle phoneme grid; arrow=allophone rules.
    - Morphology: underlined word with rect brackets around each morpheme; badge=label.
    - Intonation: path curve over transcribed sentence text.
    - Cross-language comparison: two rect columns (Language A | Language B) with arrow mapping.
  MINIMUM STEPS: syntax tree=10 | phonology=10 | morphology=8 | cross-language=10
`,
  philosophy: `
ANIMATION STRATEGY — PHILOSOPHY:
  Primitives: rect (propositions/concepts), arrow (entailment/influence),
              circle (thinkers), badge (key terms), path (argument flow)
  Layout rules:
    - Argument structure: rect premise boxes → arrow → rect conclusion box.
    - Ethical framework comparison: parallel rect columns per theory, badge=key claim.
    - Historical influence: circle=philosophers, arrow=influence direction, badge=dates.
    - Thought experiment: scenario illustration using rect/circle, badge=question.
    - Dialectic: thesis rect LEFT, antithesis rect RIGHT, synthesis rect CENTER-BOTTOM.
  MINIMUM STEPS: argument=8 | framework comparison=10 | thought experiment=10 | dialectic=10
`,
  environmental_science: `
ANIMATION STRATEGY — ENVIRONMENTAL SCIENCE:
  Primitives: path (biogeochemical cycles/flow), circle (reservoirs), arrow (flux/transfer),
              rect (systems/zones), badge (CO₂ ppm/temperature data), arc (atmospheric layers)
  Color convention: ocean=blue | atmosphere=light-blue | land=green | ice=white | urban=gray
  Layout rules:
    - Carbon cycle: rect reservoirs (atmosphere, ocean, land, biosphere), arrow=flux with badge values.
    - Climate system: layered arc (troposphere, stratosphere, etc.) above rect=earth surface.
    - Food web: circle=species, arrow=energy flow (bottom→top), badge=trophic level.
    - Data trend: path line chart (CO₂ or temp over time), badge=key year events.
    - Solution pathway: sequential rect stages showing intervention steps.
  MINIMUM STEPS: cycle=12 | climate=12 | food web=10 | data trend=8 | solutions=10
`,
  music: `
ANIMATION STRATEGY — MUSIC:
  Primitives: rect (staff lines/keys), circle (note heads), path (clef/ties/slurs),
              arrow (chord resolution/voice leading), text (note names/solfege), badge (values)
  Layout rules:
    - Staff: five horizontal rect lines, circles=noteheads at correct pitch heights.
    - Piano keyboard: rect keys (white=tall, black=shorter, offset), highlight active key.
    - Circle of fifths: circle with 12 clock positions, text=key names, arc=relationships.
    - Chord progression: sequence of rect boxes with chord symbols, arrow=resolution.
    - Waveform: path sinusoid; animate frequency change by scaling x-period.
    - Rhythm: horizontal rect timeline, filled rect segments=beats, badge=note value.
  MINIMUM STEPS: staff reading=10 | circle of fifths=10 | chord progression=10 | rhythm=8
`,
  space_astronomy: `
ANIMATION STRATEGY — SPACE & ASTRONOMY:
  Primitives: circle (stars/planets/objects), path (orbits/trajectories/spectra),
              arrow (forces/direction/jets), badge (distances/masses/values), arc (angles)
  Color convention: main sequence=yellow | red giant=orange-red | white dwarf=white |
                    neutron star=blue-white | black hole=dark with glow ring
  Layout rules:
    - Solar system: sun circle at LEFT x=80, planets at increasing x with orbit path arcs.
    - HR diagram: rect axes (temp x-axis inverted, luminosity y-axis), circle=stars plotted.
    - Stellar evolution: horizontal timeline path, circle=star at each stage with badge.
    - Black hole: dark circle with glowing accretion disk path arc around it.
    - Redshift: two path spectra (side by side), badge=wavelength shift.
    - Scale analogy: two circles at wildly different scales with badge labels.
  MINIMUM STEPS: solar system=10 | stellar evolution=12 | black hole=10 | cosmology=12
`,
  general: `
ANIMATION STRATEGY — GENERAL:
  Primitives: circle, rect, arrow, text, badge, path
  Layout rules:
    - Start with concept overview diagram showing main 3–5 components.
    - Causes: LEFT side. Effects: RIGHT side. Process: CENTER.
    - Label everything clearly with badge shapes.
    - Build complexity progressively: one element per step.
    - Use highlightbox to emphasize the single most important idea.
  MINIMUM STEPS: any concept=10
`,
};

export const DOMAIN_MIN_STEPS = {
  dsa: { sort: 18, search: 10, tree: 12, graph: 14, dp: 16, default: 10 },
  mathematics: { calculus: 12, geometry: 10, matrix: 10, statistics: 8, probability: 10, default: 8 },
  physics: { mechanics: 12, wave: 10, circuit: 12, thermodynamic: 10, optic: 10, default: 8 },
  chemistry: { reaction: 12, bond: 10, organic: 14, titration: 10, default: 8 },
  biology: { cell: 14, genetics: 12, system: 10, photosynthesis: 12, default: 8 },
  medicine: { anatomy: 12, pathophys: 14, pharmacol: 10, procedure: 12, default: 8 },
  computer_science: { os: 12, network: 12, database: 10, oop: 10, web: 10, distributed: 14, default: 10 },
  engineering: { circuit: 12, structure: 10, mechanism: 12, fluid: 10, control: 12, default: 8 },
  business: { framework: 10, process: 10, case: 12, financial: 10, default: 8 },
  law: { case: 10, process: 10, principle: 8, constitution: 10, default: 8 },
  history: { timeline: 10, cause: 10, biography: 8, battle: 12, default: 8 },
  geography: { map: 10, climate: 10, process: 10, demographic: 8, default: 8 },
  psychology: { theory: 10, experiment: 10, brain: 12, model: 10, default: 8 },
  arts: { color: 10, typo: 8, composition: 10, flow: 12, default: 8 },
  economics: { supply: 12, gdp: 8, market: 10, game: 10, default: 8 },
  aviation_maritime: { force: 10, navigation: 12, instrument: 10, weather: 10, rule: 8, default: 8 },
  data_science: { neural: 14, train: 12, tree: 10, eval: 8, default: 10 },
  cybersecurity: { attack: 12, network: 12, crypto: 10, auth: 10, threat: 10, default: 10 },
  linguistics: { syntax: 10, phonolog: 10, morpholog: 8, cross: 10, default: 8 },
  philosophy: { argument: 8, framework: 10, thought: 10, dialect: 10, default: 8 },
  environmental_science: { cycle: 12, climate: 12, web: 10, data: 8, solution: 10, default: 8 },
  music: { staff: 10, fifth: 10, chord: 10, rhythm: 8, default: 8 },
  space_astronomy: { solar: 10, evolution: 12, black: 10, cosmology: 12, default: 10 },
  general: { default: 10 }
};

export const DOMAIN_SCENE_SCAFFOLDS = {
  dsa: [
    { id: 'cell_0', shape: 'rect', x: 140, y: 300, w: 60, h: 60, color: '#3b82f6', cornerRadius: 8, label: 'Index 0', appearsAtStep: 0 },
    { id: 'cell_1', shape: 'rect', x: 210, y: 300, w: 60, h: 60, color: '#3b82f6', cornerRadius: 8, label: 'Index 1', appearsAtStep: 0 },
    { id: 'cell_2', shape: 'rect', x: 280, y: 300, w: 60, h: 60, color: '#3b82f6', cornerRadius: 8, label: 'Index 2', appearsAtStep: 0 },
    { id: 'cell_3', shape: 'rect', x: 350, y: 300, w: 60, h: 60, color: '#3b82f6', cornerRadius: 8, label: 'Index 3', appearsAtStep: 0 },
    { id: 'cell_4', shape: 'rect', x: 420, y: 300, w: 60, h: 60, color: '#3b82f6', cornerRadius: 8, label: 'Index 4', appearsAtStep: 0 },
    { id: 'cell_5', shape: 'rect', x: 490, y: 300, w: 60, h: 60, color: '#3b82f6', cornerRadius: 8, label: 'Index 5', appearsAtStep: 0 },
  ],
  mathematics: [
    { id: 'xaxis', shape: 'line', x1: 50, y1: 350, x2: 750, y2: 350, color: '#ffffff40', appearsAtStep: 0 },
    { id: 'yaxis', shape: 'line', x1: 400, y1: 50, x2: 400, y2: 550, color: '#ffffff40', appearsAtStep: 0 },
    { id: 'xlabel', shape: 'text', x: 740, y: 370, text: 'x', fontSize: 14, color: '#ffffff60', appearsAtStep: 0 },
    { id: 'ylabel', shape: 'text', x: 415, y: 60, text: 'y', fontSize: 14, color: '#ffffff60', appearsAtStep: 0 },
  ],
  physics: [
    { id: 'ground', shape: 'line', x1: 50, y1: 450, x2: 750, y2: 450, color: '#4b5563', appearsAtStep: 0 },
    { id: 'main_obj', shape: 'circle', x: 400, y: 400, r: 25, color: '#ef4444', label: 'Object', appearsAtStep: 0 },
  ],
  chemistry: [
    { id: 'reactant_zone', shape: 'highlightbox', x: 80, y: 150, w: 220, h: 300, color: '#10b981', opacity: 0.1, appearsAtStep: 0 },
    { id: 'product_zone', shape: 'highlightbox', x: 500, y: 150, w: 220, h: 300, color: '#3b82f6', opacity: 0.1, appearsAtStep: 0 },
    { id: 'reaction_label', shape: 'text', x: 400, y: 500, text: 'Reaction Progress', fontSize: 14, color: '#94a3b8', appearsAtStep: 0 },
  ],
  computer_science: [
    { id: 'memory_stack', shape: 'rect', x: 100, y: 100, w: 200, h: 400, color: '#1e293b', label: 'Stack', appearsAtStep: 0 },
    { id: 'memory_heap', shape: 'rect', x: 450, y: 100, w: 250, h: 400, color: '#1e293b', label: 'Heap', appearsAtStep: 0 },
  ],
  history: [
    { id: 'timeline_base', shape: 'line', x1: 50, y1: 300, x2: 750, y2: 300, color: '#92400e', appearsAtStep: 0 },
    { id: 'era_indicator', shape: 'badge', x: 400, y: 320, text: 'Main Period', bgColor: '#92400e', textColor: '#fff', appearsAtStep: 0 },
  ],
  general: [
    { id: 'center_hub', shape: 'circle', x: 400, y: 300, r: 40, color: '#6366f1', label: 'Concept', appearsAtStep: 0 },
  ]
};
