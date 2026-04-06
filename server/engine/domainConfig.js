/**
 * Domain Configuration
 * Centralized domain detection keywords, node templates, and animation strategies
 */

export const DOMAIN_KEYWORDS = {
  dsa: ['array','linked list','tree','graph','heap','stack','queue','sort','search','algorithm','binary','hash','trie','dp','dynamic programming','recursion','bfs','dfs','dijkstra','bubble sort','merge sort','quick sort','insertion sort','selection sort','big o','complexity','pointer','node','edge','vertex'],
  mathematics: ['calculus','derivative','integral','matrix','vector','probability','statistics','theorem','proof','algebra','geometry','trigonometry','function','limit','series','differential','equation','fourier','linear algebra','set theory','number theory','combinatorics','complex number'],
  physics: ['force','motion','energy','wave','quantum','relativity','mechanics','thermodynamics','electromagnetism','optics','gravity','velocity','acceleration','momentum','newton','einstein','circuit','magnetic','electric field','photon','electron','nucleus','atom'],
  chemistry: ['reaction','molecule','atom','bond','acid','base','organic','inorganic','periodic','element','compound','oxidation','reduction','catalyst','enzyme','polymer','titration','stoichiometry','mole','electron configuration','orbital'],
  biology: ['cell','dna','rna','protein','evolution','genetics','photosynthesis','respiration','ecosystem','mitosis','meiosis','enzyme','hormone','neuron','organ','tissue','bacteria','virus','immune','metabolism','chromosome'],
  medicine: ['diagnosis','surgery','anatomy','physiology','disease','treatment','drug','symptom','pathology','pharmacology','clinical','patient','blood','heart','brain','lung','liver','kidney','cancer','infection','therapy','mbbs','bds','nursing'],
  computer_science: ['operating system','network','database','compiler','programming','oop','class','object','function','variable','loop','recursion','api','http','tcp','sql','nosql','docker','cloud','microservice','design pattern','solid','rest','graphql','web','app','mobile','frontend','backend','devops','git','agile'],
  engineering: ['mechanical','civil','electrical','electronics','circuit','voltage','current','stress','strain','load','beam','fluid','thermodynamics','machine','engine','motor','sensor','signal','control system','cad','manufacturing','welding','turbine','hydraulic'],
  business: ['marketing','finance','accounting','strategy','management','hr','supply chain','entrepreneurship','investment','revenue','profit','balance sheet','cash flow','stakeholder','leadership','operations','bba','mba'],
  law: ['contract','tort','criminal','civil','constitution','statute','case','judgement','liability','rights','legal','court','judge','plaintiff','defendant','jurisdiction','precedent','arbitration','intellectual property','corporate law'],
  history: ['war','empire','revolution','dynasty','civilization','colonialism','independence','treaty','ancient','medieval','modern','king','queen','parliament','republic','democracy','culture','migration','trade'],
  geography: ['climate','ecosystem','continent','ocean','river','mountain','population','urbanization','agriculture','resources','plate tectonics','weather','latitude','longitude','biome'],
  psychology: ['behavior','cognition','emotion','memory','perception','personality','development','therapy','social','motivation','learning','consciousness','brain','mental health','anxiety','depression','freud','piaget','maslow'],
  arts: ['design','color','composition','typography','animation','film','photography','architecture','sculpture','painting','illustration','ui','ux','graphic','fashion','interior','sound','music theory','rhythm','melody'],
  economics: ['supply','demand','inflation','gdp','market','trade','monetary','fiscal','micro','macro','equilibrium','elasticity','opportunity cost','utility','production','consumption'],
  aviation_maritime: ['aircraft','pilot','navigation','altitude','thrust','lift','drag','runway','atc','nautical','vessel','tide','longitude','latitude','fuel','engine','cockpit'],
  general: [],
};

export const DOMAIN_NODE_TEMPLATES = {
  dsa: ['hook','prior_knowledge_bridge','concept','intuition','complexity_analysis','step_by_step','worked_example','visual','edge_case','common_mistake','real_world_application','result'],
  mathematics: ['hook','prior_knowledge_bridge','concept','geometric_intuition','proof_sketch','worked_example','visual','common_mistake','real_world_application','result'],
  physics: ['hook','phenomenon','concept','intuition','mathematical_model','experiment','worked_example','visual','common_mistake','real_world_application','result'],
  chemistry: ['hook','prior_knowledge_bridge','concept','molecular_intuition','reaction_mechanism','worked_example','visual','safety_note','real_world_application','result'],
  biology: ['hook','prior_knowledge_bridge','concept','analogy','process_breakdown','case_study','visual','common_mistake','real_world_application','result'],
  medicine: ['clinical_hook','anatomy_context','concept','pathophysiology','diagnosis_walkthrough','treatment_protocol','visual','clinical_pearl','real_world_application','result'],
  computer_science: ['hook','prior_knowledge_bridge','concept','architecture_overview','code_walkthrough','worked_example','visual','best_practice','common_mistake','real_world_application','result'],
  engineering: ['problem_statement','concept','physical_intuition','formula_derivation','worked_example','visual','design_consideration','real_world_application','result'],
  business: ['scenario_hook','concept','framework','case_study','worked_example','visual','common_pitfall','real_world_application','result'],
  law: ['case_hook','legal_concept','principle','case_analysis','argument_structure','visual','common_confusion','real_world_application','result'],
  history: ['narrative_hook','context','key_event','cause_effect','timeline_walk','visual','multiple_perspectives','significance','result'],
  geography: ['hook','concept','spatial_intuition','process_breakdown','case_study','visual','real_world_application','result'],
  psychology: ['behavior_hook','concept','theory','experiment','application','visual','common_mistake','real_world_application','result'],
  arts: ['aesthetic_hook','concept','technique_breakdown','worked_example','visual','style_analysis','real_world_application','result'],
  economics: ['scenario_hook','concept','model','graph_intuition','worked_example','visual','policy_implication','real_world_application','result'],
  aviation_maritime: ['scenario_hook','concept','physical_intuition','procedure_walkthrough','visual','safety_critical','real_world_application','result'],
  general: ['hook','prior_knowledge_bridge','concept','intuition','step_by_step','worked_example','visual','common_mistake','real_world_application','result'],
};

export const DOMAIN_ANIMATION_GUIDE = {
  dsa: `
ANIMATION STRATEGY — DSA / ALGORITHMS:
  Use: array, pointer, swapbridge, comparator, codeline, highlightbox
  - Show data structures as visual objects (arrays centered at x=400)
  - Each comparison = one step. Each swap = one step. Each state change = one step.
  - Use sortedCells (green) as elements settle, compareCells (orange) for active comparison
  - Use codeline on left side (x=80) to show pseudocode executing
  - For trees/graphs: circle=node, arrow=edge. Root at top-center (400,120), children below
  - For linked lists: rect cells with arrow connectors left-to-right
  - For stacks/queues: rect cells stacked vertically at center
  MINIMUM STEPS: sorting=18, searching=10, trees=12, graph traversal=14
`,
  mathematics: `
ANIMATION STRATEGY — MATHEMATICS:
  Use: path (curves, functions), circle (points, centers), arrow (vectors, direction), text (labels), arc (angles)
  - For calculus: draw the function as a path, then show tangent as an arrow, area as filled region
  - For geometry: build shapes step by step using line and arc
  - For matrices: use rect grid with text inside each cell
  - For vectors: arrow from origin to point, label the components
  - For statistics: use rect bars (histogram) with text labels on top
  - Place function/equation prominently at (400,90) as text
  - Animate from LEFT (input) to RIGHT (output/result)
  MINIMUM STEPS: calculus=12, geometry=10, matrices=10, statistics=8
`,
  physics: `
ANIMATION STRATEGY — PHYSICS:
  Use: circle (particles, objects), arrow (forces, velocity, fields), path (trajectories, waves), arc (angles)
  - For mechanics: show object as circle, force arrows pointing direction with labels
  - For waves: use path with sinusoidal d attribute, animate wavelength/amplitude change
  - For circuits: use rect (components), line (wires), text (values)
  - For optics: use line (rays), arrow (direction), arc (reflection angle)
  - Always show BEFORE state first, then animate to AFTER state
  - Force diagrams: center object, radiate arrows outward/inward
  MINIMUM STEPS: mechanics=12, waves=10, circuits=12, thermodynamics=10
`,
  chemistry: `
ANIMATION STRATEGY — CHEMISTRY:
  Use: circle (atoms - color-coded by element), arrow (electron movement, reaction direction), path (bonds, orbitals)
  - Atom color convention: H=white, C=gray, O=red, N=blue, S=yellow, Cl=green
  - Show reactants on LEFT (x=150-250), products on RIGHT (x=550-700), arrow in CENTER
  - For reactions: show bonds breaking (dashed arrow) then forming (solid arrow)
  - For periodic table context: rect grid with element symbols
  - For organic structures: use line bonds, circle for atoms at vertices
  - pH/titration: use badge for values, arrow for direction of change
  MINIMUM STEPS: reactions=12, bonding=10, organic mechanisms=14
`,
  biology: `
ANIMATION STRATEGY — BIOLOGY:
  Use: circle (cells, organelles), path (membranes, DNA helix), arrow (signals, flow), badge (labels)
  - For cell processes: large circle=cell boundary, smaller circles=organelles inside
  - For DNA/genetics: use path for double helix, text for base pairs
  - For body systems: use rect/circle for organs, arrow for blood flow/nerve signals
  - For evolution: timeline with rect nodes connected by arrows
  - Color code: green=plant cell, pink=animal cell, blue=nucleus, yellow=mitochondria
  - Use badge liberally for organelle labels
  MINIMUM STEPS: cell division=14, genetics=12, body systems=10, photosynthesis=12
`,
  medicine: `
ANIMATION STRATEGY — MEDICINE / CLINICAL:
  Use: circle (cells, organs), rect (structures, chambers), arrow (flow, signals), path (vessels, nerves)
  - For anatomy: build body region step by step, label each structure with badge
  - For pathophysiology: show normal state first (step 1-3), then diseased state
  - For pharmacology: show drug → receptor → effect as arrow chain
  - For clinical procedures: sequential rect steps with arrow connectors
  - Heart: two rects side by side (left/right), arrows for blood flow direction
  - Use red for arterial, blue for venous, yellow for lymphatic
  MINIMUM STEPS: anatomy=12, pathophysiology=14, pharmacology=10, procedures=12
`,
  computer_science: `
ANIMATION STRATEGY — COMPUTER SCIENCE:
  Use: rect (components, layers), arrow (data flow, API calls), circle (services, nodes), codeline (code), badge (labels)
  - For OS concepts: layered rects (hardware → kernel → userspace → app)
  - For networking: rect nodes with arrow edges showing packet flow
  - For databases: show table as rect grid with rows/columns
  - For OOP: class diagram with rect boxes, arrow for inheritance/composition
  - For web: three-tier architecture (client → server → database) as rects
  - For algorithms/code: use codeline shape on left, show execution state on right
  MINIMUM STEPS: OS=12, networking=12, databases=10, OOP=10, web=10
`,
  engineering: `
ANIMATION STRATEGY — ENGINEERING:
  Use: rect (components, structures), arrow (forces, flow), path (beams, curves), circle (joints, nodes)
  - For mechanical: show free body diagram with force arrows
  - For electrical: standard circuit symbols using rect/circle/line
  - For civil: structural diagram with load arrows pointing down, reaction arrows up
  - For fluid: path shapes showing flow direction, arrow for velocity
  - Label all forces, dimensions, and values with text/badge
  MINIMUM STEPS: circuit=12, structures=10, mechanisms=12, fluid=10
`,
  business: `
ANIMATION STRATEGY — BUSINESS:
  Use: rect (process boxes, org chart nodes), arrow (flow, hierarchy), badge (metrics, KPIs), text (labels)
  - For frameworks (SWOT, Porter's 5 Forces): 4-quadrant rect layout
  - For processes: sequential rect boxes with arrow connectors
  - For org charts: hierarchical tree using rect+arrow
  - For financials: rect bar chart with text values on top
  - For strategy: canvas with zones (left=resources, center=value, right=market)
  MINIMUM STEPS: framework=10, process=10, case study=12, financial=10
`,
  law: `
ANIMATION STRATEGY — LAW:
  Use: rect (parties, legal entities), arrow (relationships, flow of rights), badge (rulings), text (principles)
  - For case analysis: show parties as rect on left/right, court at center top
  - For legal process: sequential flowchart rect + arrow
  - For contract: two rect parties connected by arrow with badge (terms)
  - For constitutional: hierarchy diagram, constitution at top, laws below
  - Use highlightbox to emphasize key legal principle being discussed
  MINIMUM STEPS: case study=10, process=10, principles=8
`,
  history: `
ANIMATION STRATEGY — HISTORY:
  Use: rect (events, periods), arrow (causation, influence), text (dates, names), badge (key figures)
  - Timeline: horizontal sequence of rect events, arrows connecting cause→effect
  - For empires/maps: spatial layout with regions as rect at approximate positions
  - For battles: two forces as rect on left/right, arrow showing movement
  - For revolutions: escalating sequence showing trigger → escalation → outcome
  - Use dates prominently in badge shapes at tops of event rects
  MINIMUM STEPS: timeline=10, cause-effect=10, biography=8
`,
  psychology: `
ANIMATION STRATEGY — PSYCHOLOGY:
  Use: circle (person, brain regions), arrow (behavior, thought flow), rect (theory models), badge (concepts)
  - For theories (Maslow, Freud): pyramid using stacked rect layers
  - For behavioral models: stimulus → organism → response as arrow chain
  - For brain: large circle=brain, smaller circles for regions with labels
  - For experiments: show experimental setup as diagram with conditions
  MINIMUM STEPS: theories=10, experiments=10, brain=12
`,
  economics: `
ANIMATION STRATEGY — ECONOMICS:
  Use: path (supply/demand curves), arrow (shifts), text (labels), rect (axes), circle (equilibrium point)
  - For supply/demand: draw axes as lines, curves as path, equilibrium as circle
  - For circular flow: circular arrow path with rect (households/firms) at 12/6 o'clock
  - For GDP: stacked rect bar chart
  - For market structures: rect grid showing firms/prices
  - Label all axes, curves, and points clearly
  MINIMUM STEPS: supply-demand=12, GDP=8, market structures=10
`,
  general: `
ANIMATION STRATEGY — GENERAL:
  Use: circle, rect, arrow, text, badge, path
  - Start with a concept overview diagram showing main components
  - Use spatial layout: causes on left, effects on right, process in center
  - Label everything clearly with badge shapes
  - Build complexity progressively, one element per step
  MINIMUM STEPS: any concept=10
`,
};

export function detectDomain(topic) {
  const t = topic.toLowerCase();
  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
    if (domain === 'general') continue;
    if (keywords.some(k => t.includes(k))) return domain;
  }
  return 'general';
}
