/**
 * Domain Configuration — v2
 *
 * Changes from v1:
 *  - Full TypeScript types (DomainKey, DomainConfig, DetectionResult)
 *  - Weighted keyword scoring: multi-word phrases score higher than single words
 *  - detectDomain() now returns a ranked list of { domain, score } instead of one string
 *  - getPrimaryDomain() is the drop-in replacement for the old detectDomain()
 *  - 8 new domains: linguistics, philosophy, environmental_science, music,
 *    data_science, cybersecurity, economics (was present), space_astronomy
 *  - Every domain has: displayName, icon (emoji), primaryColor, secondaryColor
 *  - Richer animation guides with explicit shape primitives and per-topic step counts
 *  - getDomainConfig() / getAnimationGuide() / getNodeTemplates() helpers
 */

/**
 * @typedef { 'dsa' | 'mathematics' | 'physics' | 'chemistry' | 'biology' | 'medicine' | 'computer_science' | 'engineering' | 'business' | 'law' | 'history' | 'geography' | 'psychology' | 'arts' | 'economics' | 'aviation_maritime' | 'data_science' | 'cybersecurity' | 'linguistics' | 'philosophy' | 'environmental_science' | 'music' | 'space_astronomy' | 'general' } DomainKey
 */

/**
 * @typedef {Object} DomainMeta
 * @property {string} displayName
 * @property {string} icon
 * @property {string} primaryColor - hex
 * @property {string} secondaryColor - hex
 */

/**
 * @typedef {Object} DetectionResult
 * @property {DomainKey} domain
 * @property {number} score - cumulative keyword weight
 */

// ─── Domain Metadata ──────────────────────────────────────────────────────────

/** @type {Object.<DomainKey, DomainMeta>} */
export const DOMAIN_META = {
  dsa:                  { displayName: 'DSA & Algorithms',       icon: '🧩', primaryColor: '#6366f1', secondaryColor: '#a5b4fc' },
  mathematics:          { displayName: 'Mathematics',            icon: '∑',  primaryColor: '#0ea5e9', secondaryColor: '#7dd3fc' },
  physics:              { displayName: 'Physics',                icon: '⚛️', primaryColor: '#f59e0b', secondaryColor: '#fcd34d' },
  chemistry:            { displayName: 'Chemistry',              icon: '⚗️', primaryColor: '#10b981', secondaryColor: '#6ee7b7' },
  biology:              { displayName: 'Biology',                icon: '🧬', primaryColor: '#22c55e', secondaryColor: '#86efac' },
  medicine:             { displayName: 'Medicine & Health',      icon: '🩺', primaryColor: '#ef4444', secondaryColor: '#fca5a5' },
  computer_science:     { displayName: 'Computer Science',       icon: '💻', primaryColor: '#8b5cf6', secondaryColor: '#c4b5fd' },
  engineering:          { displayName: 'Engineering',            icon: '⚙️', primaryColor: '#64748b', secondaryColor: '#94a3b8' },
  business:             { displayName: 'Business & Management',  icon: '📊', primaryColor: '#f97316', secondaryColor: '#fdba74' },
  law:                  { displayName: 'Law & Legal Studies',    icon: '⚖️', primaryColor: '#1e40af', secondaryColor: '#93c5fd' },
  history:              { displayName: 'History',                icon: '📜', primaryColor: '#92400e', secondaryColor: '#d97706' },
  geography:            { displayName: 'Geography',              icon: '🌍', primaryColor: '#059669', secondaryColor: '#34d399' },
  psychology:           { displayName: 'Psychology',             icon: '🧠', primaryColor: '#db2777', secondaryColor: '#f9a8d4' },
  arts:                 { displayName: 'Arts & Design',          icon: '🎨', primaryColor: '#ec4899', secondaryColor: '#f9a8d4' },
  economics:            { displayName: 'Economics',              icon: '📈', primaryColor: '#0d9488', secondaryColor: '#5eead4' },
  aviation_maritime:    { displayName: 'Aviation & Maritime',    icon: '✈️', primaryColor: '#0369a1', secondaryColor: '#38bdf8' },
  data_science:         { displayName: 'Data Science & ML',      icon: '🤖', primaryColor: '#7c3aed', secondaryColor: '#c4b5fd' },
  cybersecurity:        { displayName: 'Cybersecurity',          icon: '🔐', primaryColor: '#1e293b', secondaryColor: '#475569' },
  linguistics:          { displayName: 'Linguistics',            icon: '🗣️', primaryColor: '#9333ea', secondaryColor: '#d8b4fe' },
  philosophy:           { displayName: 'Philosophy',             icon: '🏛️', primaryColor: '#57534e', secondaryColor: '#a8a29e' },
  environmental_science:{ displayName: 'Environmental Science',  icon: '🌱', primaryColor: '#16a34a', secondaryColor: '#86efac' },
  music:                { displayName: 'Music',                  icon: '🎵', primaryColor: '#dc2626', secondaryColor: '#fca5a5' },
  space_astronomy:      { displayName: 'Space & Astronomy',      icon: '🚀', primaryColor: '#1e1b4b', secondaryColor: '#818cf8' },
  general:              { displayName: 'General',                icon: '📚', primaryColor: '#6b7280', secondaryColor: '#d1d5db' },
};

// ─── Weighted Keywords ────────────────────────────────────────────────────────
//
// Format: [keyword, weight]
//   weight 3 → domain-specific multi-word phrase (very strong signal)
//   weight 2 → moderately specific single word
//   weight 1 → broad / shared term
//
// Rationale: "bubble sort" is unambiguously DSA (weight 3); "node" is shared
// across CS/DSA/networking (weight 1). Summing weights lets us rank domains.

/** @type {Object.<DomainKey, [string, number][]>} */
export const DOMAIN_KEYWORDS = {

  dsa: [
    ['bubble sort', 3], ['merge sort', 3], ['quick sort', 3], ['insertion sort', 3],
    ['selection sort', 3], ['heap sort', 3], ['radix sort', 3], ['counting sort', 3],
    ['binary search', 3], ['depth first search', 3], ['breadth first search', 3],
    ['dynamic programming', 3], ['dijkstra', 3], ['bellman ford', 3], ['floyd warshall', 3],
    ['kruskal', 3], ["prim's algorithm", 3], ['topological sort', 3], ['union find', 3],
    ['sliding window', 3], ['two pointer', 3], ['fast slow pointer', 3],
    ['linked list', 2], ['binary tree', 2], ['binary search tree', 3], ['avl tree', 3],
    ['red black tree', 3], ['segment tree', 3], ['fenwick tree', 3], ['suffix array', 3],
    ['trie', 2], ['hash map', 2], ['hash table', 2], ['priority queue', 2],
    ['monotonic stack', 3], ['deque', 2], ['disjoint set', 3],
    ['big o', 2], ['time complexity', 2], ['space complexity', 2],
    ['array', 1], ['graph', 1], ['tree', 1], ['heap', 1], ['stack', 1], ['queue', 1],
    ['algorithm', 1], ['recursion', 1], ['bfs', 2], ['dfs', 2],
    ['dp', 1], ['memoization', 2], ['tabulation', 2],
    ['edge', 1], ['vertex', 1], ['pointer', 1], ['node', 1],
    ['sorting', 1], ['searching', 1], ['traversal', 1],
  ],

  mathematics: [
    ['differential equation', 3], ['partial derivative', 3], ['riemann integral', 3],
    ['fourier transform', 3], ['laplace transform', 3], ['linear algebra', 3],
    ['set theory', 3], ['number theory', 3], ['complex analysis', 3],
    ['abstract algebra', 3], ['group theory', 3], ['ring theory', 3],
    ['combinatorics', 2], ['permutation', 2], ['combination', 2],
    ['probability distribution', 3], ['bayes theorem', 3],
    ['calculus', 2], ['derivative', 2], ['integral', 2], ['limit', 2],
    ['matrix', 2], ['vector', 2], ['eigenvalue', 3], ['eigenvector', 3],
    ['theorem', 1], ['proof', 1], ['algebra', 1], ['geometry', 1],
    ['trigonometry', 2], ['function', 1], ['series', 1],
    ['polynomial', 2], ['determinant', 2], ['gradient', 2],
    ['topology', 3], ['manifold', 3], ['differential geometry', 3],
    ['modular arithmetic', 3], ['prime', 1], ['factorization', 2],
    ['statistics', 1], ['hypothesis testing', 3], ['confidence interval', 3],
  ],

  physics: [
    ['quantum mechanics', 3], ['special relativity', 3], ['general relativity', 3],
    ['thermodynamics', 2], ['electromagnetism', 2], ['fluid mechanics', 3],
    ['classical mechanics', 3], ['optics', 2], ['nuclear physics', 3],
    ["maxwell's equations", 3], ["newton's laws", 3], ["schrodinger equation", 3],
    ['wave function', 3], ['superposition', 2], ['entanglement', 3],
    ['momentum', 2], ['angular momentum', 3], ['torque', 2],
    ['kinetic energy', 2], ['potential energy', 2], ['conservation of energy', 3],
    ['electric field', 2], ['magnetic field', 2], ['electromagnetic wave', 3],
    ['force', 1], ['motion', 1], ['energy', 1], ['wave', 1],
    ['gravity', 1], ['velocity', 1], ['acceleration', 1],
    ['photon', 2], ['electron', 1], ['nucleus', 1], ['atom', 1],
    ['circuit', 1], ['resistance', 2], ['capacitor', 2], ['inductor', 2],
    ['doppler effect', 3], ['refraction', 2], ['diffraction', 2],
    ['black body radiation', 3], ['photoelectric effect', 3],
  ],

  chemistry: [
    ['organic chemistry', 3], ['inorganic chemistry', 3], ['physical chemistry', 3],
    ['reaction mechanism', 3], ['electron configuration', 3], ['molecular orbital', 3],
    ['lewis structure', 3], ['vsepr theory', 3], ['hybridization', 2],
    ['electronegativity', 2], ['ionization energy', 3], ['electron affinity', 3],
    ['periodic table', 2], ['stoichiometry', 2], ['titration', 2],
    ['acid base', 2], ['redox reaction', 3], ['oxidation state', 2],
    ['enthalpy', 2], ['entropy', 2], ['gibbs free energy', 3],
    ['equilibrium constant', 3], ['le chatelier', 3], ['rate law', 3],
    ['polymer', 2], ['isomer', 2], ['functional group', 3],
    ['reaction', 1], ['molecule', 1], ['atom', 1], ['bond', 1],
    ['acid', 1], ['base', 1], ['element', 1], ['compound', 1],
    ['oxidation', 1], ['reduction', 1], ['catalyst', 1], ['enzyme', 1],
    ['mole', 1], ['orbital', 1], ['valence', 2],
    ['nmr spectroscopy', 3], ['mass spectrometry', 3], ['chromatography', 3],
  ],

  biology: [
    ['cell biology', 3], ['molecular biology', 3], ['genetics', 2],
    ['natural selection', 3], ['dna replication', 3], ['protein synthesis', 3],
    ['transcription', 2], ['translation', 2], ['gene expression', 3],
    ['mendelian genetics', 3], ['epigenetics', 3], ['crispr', 3],
    ['mitosis', 2], ['meiosis', 2], ['cell cycle', 3],
    ['photosynthesis', 2], ['cellular respiration', 3], ['atp synthesis', 3],
    ['ecosystem', 2], ['food chain', 2], ['trophic level', 3],
    ['immune system', 2], ['antibody', 2], ['antigen', 2],
    ['nervous system', 2], ['action potential', 3], ['synapse', 2],
    ['evolution', 1], ['cell', 1], ['dna', 1], ['rna', 1], ['protein', 1],
    ['chromosome', 1], ['organism', 1], ['tissue', 1], ['organ', 1],
    ['bacteria', 1], ['virus', 1], ['hormone', 1], ['metabolism', 1],
    ['taxonomy', 2], ['phylogenetics', 3], ['biome', 2],
    ['homeostasis', 2], ['osmosis', 2], ['diffusion', 1],
  ],

  medicine: [
    ['clinical diagnosis', 3], ['differential diagnosis', 3], ['pathophysiology', 3],
    ['pharmacokinetics', 3], ['pharmacodynamics', 3], ['drug interaction', 3],
    ['surgical anatomy', 3], ['clinical examination', 3], ['physical examination', 3],
    ['evidence based medicine', 3], ['randomised controlled trial', 3],
    ['mbbs', 3], ['bds', 3], ['nursing', 2], ['residency', 2],
    ['anatomy', 2], ['physiology', 2], ['pathology', 2], ['pharmacology', 2],
    ['biochemistry', 2], ['microbiology', 2], ['immunology', 2],
    ['cardiology', 3], ['neurology', 3], ['oncology', 3], ['psychiatry', 3],
    ['emergency medicine', 3], ['paediatrics', 3], ['obstetrics', 3],
    ['diagnosis', 1], ['surgery', 1], ['disease', 1], ['treatment', 1],
    ['drug', 1], ['symptom', 1], ['patient', 1], ['clinical', 1],
    ['blood', 1], ['heart', 1], ['brain', 1], ['lung', 1], ['liver', 1],
    ['cancer', 1], ['infection', 1], ['therapy', 1], ['vaccine', 1],
  ],

  computer_science: [
    ['operating system', 3], ['process scheduling', 3], ['memory management', 3],
    ['virtual memory', 3], ['file system', 3], ['computer network', 3],
    ['tcp ip', 3], ['osi model', 3], ['http protocol', 2],
    ['relational database', 3], ['sql query', 2], ['nosql', 2],
    ['compiler design', 3], ['lexer', 2], ['parser', 2], ['ast', 2],
    ['design pattern', 3], ['solid principles', 3], ['microservice', 3],
    ['rest api', 3], ['graphql', 2], ['web socket', 2],
    ['object oriented', 3], ['functional programming', 3],
    ['docker', 2], ['kubernetes', 2], ['ci cd', 3], ['devops', 2],
    ['git', 1], ['version control', 2], ['agile', 1],
    ['programming', 1], ['database', 1], ['api', 1], ['class', 1],
    ['object', 1], ['variable', 1], ['loop', 1], ['function', 1],
    ['frontend', 1], ['backend', 1], ['cloud', 1],
    ['distributed system', 3], ['cap theorem', 3], ['consensus algorithm', 3],
    ['load balancer', 2], ['caching', 2], ['message queue', 2],
  ],

  engineering: [
    ['free body diagram', 3], ['stress strain', 3], ['factor of safety', 3],
    ['finite element', 3], ['control system', 3], ['pid controller', 3],
    ['signal processing', 3], ['fourier analysis', 2],
    ['mechanical engineering', 3], ['civil engineering', 3],
    ['electrical engineering', 3], ['electronics engineering', 3],
    ['thermodynamic cycle', 3], ['carnot cycle', 3], ['rankine cycle', 3],
    ['fluid dynamics', 3], ['bernoulli', 2], ['reynolds number', 3],
    ['moment of inertia', 3], ['shear force', 3], ['bending moment', 3],
    ['circuit analysis', 3], ['kirchhoff', 2], ['thevenin', 3],
    ['cad', 2], ['manufacturing', 1], ['welding', 2], ['turbine', 2],
    ['voltage', 1], ['current', 1], ['resistance', 1], ['sensor', 1],
    ['motor', 1], ['hydraulic', 1], ['pneumatic', 2],
    ['tolerance', 2], ['material science', 3], ['yield strength', 3],
  ],

  business: [
    ['porter five forces', 3], ['swot analysis', 3], ['pestle analysis', 3],
    ['value chain', 3], ['business model canvas', 3], ['balanced scorecard', 3],
    ['cash flow statement', 3], ['income statement', 3], ['balance sheet', 3],
    ['net present value', 3], ['internal rate of return', 3], ['wacc', 3],
    ['supply chain management', 3], ['operations management', 3],
    ['human resource management', 3], ['organizational behavior', 3],
    ['entrepreneurship', 2], ['venture capital', 3], ['startup', 2],
    ['marketing mix', 3], ['brand equity', 3], ['customer lifetime value', 3],
    ['bba', 3], ['mba', 3], ['cfa', 3],
    ['marketing', 1], ['finance', 1], ['accounting', 1], ['strategy', 1],
    ['management', 1], ['revenue', 1], ['profit', 1], ['stakeholder', 1],
    ['leadership', 1], ['negotiation', 1], ['investment', 1],
  ],

  law: [
    ['contract law', 3], ['tort law', 3], ['criminal law', 3],
    ['constitutional law', 3], ['administrative law', 3], ['corporate law', 3],
    ['intellectual property', 3], ['international law', 3],
    ['habeas corpus', 3], ['mens rea', 3], ['actus reus', 3],
    ['consideration', 2], ['promissory estoppel', 3], ['vicarious liability', 3],
    ['judicial review', 3], ['stare decisis', 3], ['ratio decidendi', 3],
    ['arbitration', 2], ['mediation', 2], ['litigation', 2],
    ['jurisdiction', 2], ['precedent', 2], ['statute', 2],
    ['contract', 1], ['tort', 1], ['criminal', 1], ['civil', 1],
    ['constitution', 1], ['case', 1], ['judgement', 1], ['liability', 1],
    ['rights', 1], ['legal', 1], ['court', 1], ['plaintiff', 1], ['defendant', 1],
  ],

  history: [
    ['world war', 3], ['cold war', 3], ['industrial revolution', 3],
    ['french revolution', 3], ['russian revolution', 3], ['american revolution', 3],
    ['roman empire', 3], ['british empire', 3], ['mongol empire', 3],
    ['colonialism', 2], ['decolonization', 3], ['imperialism', 2],
    ['silk road', 3], ['black death', 3], ['renaissance', 2],
    ['treaty of versailles', 3], ['league of nations', 3], ['united nations', 2],
    ['civil rights movement', 3], ['apartheid', 3], ['holocaust', 3],
    ['war', 1], ['empire', 1], ['revolution', 1], ['dynasty', 1],
    ['civilization', 1], ['independence', 1], ['treaty', 1],
    ['ancient', 1], ['medieval', 1], ['modern', 1],
    ['king', 1], ['queen', 1], ['parliament', 1], ['republic', 1],
    ['colonisation', 2], ['migration', 1], ['trade route', 2],
  ],

  geography: [
    ['plate tectonics', 3], ['tectonic plates', 3], ['seismic activity', 3],
    ['ocean current', 3], ['atmospheric circulation', 3], ['monsoon', 2],
    ['urban heat island', 3], ['demographic transition', 3],
    ['agricultural revolution', 3], ['green revolution', 3],
    ['water cycle', 2], ['carbon cycle', 2], ['nitrogen cycle', 2],
    ['latitude longitude', 2], ['time zone', 2], ['map projection', 3],
    ['climate zone', 2], ['biome', 2], ['ecosystem', 1],
    ['climate', 1], ['continent', 1], ['ocean', 1], ['river', 1],
    ['mountain', 1], ['population', 1], ['urbanization', 1],
    ['agriculture', 1], ['resources', 1], ['weather', 1],
  ],

  psychology: [
    ['cognitive behavioral therapy', 3], ['psychoanalysis', 3],
    ['classical conditioning', 3], ['operant conditioning', 3],
    ["maslow's hierarchy", 3], ['piaget stages', 3], ['erikson stages', 3],
    ['attachment theory', 3], ['cognitive dissonance', 3],
    ['social learning theory', 3], ['self efficacy', 3],
    ['working memory', 3], ['long term memory', 3], ['short term memory', 3],
    ['emotional intelligence', 3], ['growth mindset', 2],
    ['positive psychology', 3], ['humanistic psychology', 3],
    ['bystander effect', 3], ['confirmation bias', 3], ['anchoring bias', 3],
    ['behavior', 1], ['cognition', 1], ['emotion', 1], ['memory', 1],
    ['perception', 1], ['personality', 1], ['development', 1], ['therapy', 1],
    ['motivation', 1], ['learning', 1], ['consciousness', 1], ['mental health', 1],
    ['anxiety', 1], ['depression', 1], ['freud', 2], ['jung', 2],
  ],

  arts: [
    ['color theory', 3], ['golden ratio', 3], ['gestalt principles', 3],
    ['typography hierarchy', 3], ['grid system', 3], ['ui ux design', 3],
    ['user experience', 2], ['interaction design', 3], ['visual design', 2],
    ['adobe illustrator', 2], ['figma', 2], ['sketch', 2],
    ['film theory', 3], ['cinematography', 3], ['mise en scene', 3],
    ['music composition', 3], ['art history', 3], ['modernism', 2], ['postmodernism', 2],
    ['design', 1], ['color', 1], ['composition', 1], ['typography', 1],
    ['animation', 1], ['photography', 1], ['architecture', 1],
    ['sculpture', 1], ['painting', 1], ['illustration', 1],
    ['fashion', 1], ['interior design', 2], ['graphic design', 2],
  ],

  economics: [
    ['supply and demand', 3], ['price elasticity', 3], ['consumer surplus', 3],
    ['producer surplus', 3], ['market equilibrium', 3], ['deadweight loss', 3],
    ['gdp calculation', 3], ['inflation rate', 2], ['unemployment rate', 2],
    ['monetary policy', 3], ['fiscal policy', 3], ['quantitative easing', 3],
    ['phillips curve', 3], ['laffer curve', 3], ['is lm model', 3],
    ['game theory', 3], ['nash equilibrium', 3], ['prisoner dilemma', 3],
    ['comparative advantage', 3], ['trade deficit', 2], ['exchange rate', 2],
    ['supply', 1], ['demand', 1], ['inflation', 1], ['gdp', 1],
    ['market', 1], ['trade', 1], ['micro', 1], ['macro', 1],
    ['utility', 1], ['production', 1], ['consumption', 1], ['elasticity', 1],
    ['opportunity cost', 2], ['externality', 2], ['public good', 2],
  ],

  aviation_maritime: [
    ['instrument flight rules', 3], ['visual flight rules', 3],
    ['air traffic control', 3], ['instrument landing system', 3],
    ['angle of attack', 3], ['bernoulli lift', 3], ['stall speed', 3],
    ['weight and balance', 3], ['flight plan', 2], ['metar', 3], ['notam', 3],
    ['colregs', 3], ['beaufort scale', 3], ['tide calculation', 3],
    ['celestial navigation', 3], ['dead reckoning', 3],
    ['aircraft', 1], ['pilot', 1], ['navigation', 1], ['altitude', 1],
    ['thrust', 1], ['lift', 1], ['drag', 1], ['runway', 1],
    ['nautical', 1], ['vessel', 1], ['tide', 1], ['cockpit', 1],
    ['fuel', 1], ['engine', 1], ['atc', 2],
  ],

  data_science: [
    ['machine learning', 3], ['deep learning', 3], ['neural network', 3],
    ['convolutional neural network', 3], ['recurrent neural network', 3],
    ['transformer architecture', 3], ['large language model', 3],
    ['gradient descent', 3], ['backpropagation', 3], ['overfitting', 2],
    ['cross validation', 3], ['bias variance tradeoff', 3],
    ['random forest', 3], ['support vector machine', 3], ['k means clustering', 3],
    ['principal component analysis', 3], ['dimensionality reduction', 3],
    ['feature engineering', 3], ['data pipeline', 3], ['etl', 2],
    ['pandas', 2], ['numpy', 2], ['scikit learn', 3], ['pytorch', 2], ['tensorflow', 2],
    ['regression', 2], ['classification', 2], ['clustering', 2],
    ['recommendation system', 3], ['natural language processing', 3],
    ['computer vision', 3], ['reinforcement learning', 3],
    ['a b testing', 3], ['statistical significance', 3],
    ['data visualization', 2], ['tableau', 2], ['power bi', 2],
    ['sql analytics', 2], ['spark', 2], ['hadoop', 2],
  ],

  cybersecurity: [
    ['penetration testing', 3], ['ethical hacking', 3], ['vulnerability assessment', 3],
    ['sql injection', 3], ['cross site scripting', 3], ['csrf attack', 3],
    ['man in the middle', 3], ['social engineering', 3], ['phishing', 2],
    ['public key infrastructure', 3], ['rsa encryption', 3], ['aes encryption', 3],
    ['hash function', 2], ['digital signature', 3], ['ssl tls', 3],
    ['zero day exploit', 3], ['buffer overflow', 3], ['privilege escalation', 3],
    ['firewall', 2], ['intrusion detection', 3], ['siem', 3],
    ['owasp', 3], ['cvss score', 3], ['cve', 2],
    ['network forensics', 3], ['malware analysis', 3], ['reverse engineering', 3],
    ['oscp', 3], ['ceh', 3], ['cissp', 3],
    ['encryption', 2], ['decryption', 2], ['authentication', 2],
    ['authorization', 2], ['security', 1], ['hacking', 1], ['exploit', 2],
  ],

  linguistics: [
    ['phonology', 3], ['morphology', 3], ['syntax tree', 3], ['semantics', 2],
    ['pragmatics', 3], ['discourse analysis', 3], ['sociolinguistics', 3],
    ['language acquisition', 3], ['universal grammar', 3], ['chomsky', 2],
    ['phoneme', 2], ['morpheme', 2], ['lexeme', 3], ['allophone', 3],
    ['syntax', 2], ['grammar', 1], ['linguistic', 1], ['language', 1],
    ['dialect', 2], ['pidgin', 3], ['creole', 3], ['bilingualism', 2],
    ['corpus linguistics', 3], ['computational linguistics', 3],
    ['ipa', 2], ['vowel', 2], ['consonant', 2], ['prosody', 3],
    ['etymology', 2], ['semantics', 2], ['connotation', 2], ['denotation', 2],
  ],

  philosophy: [
    ['epistemology', 3], ['metaphysics', 3], ['ontology', 3], ['axiology', 3],
    ['deontological ethics', 3], ['consequentialism', 3], ['virtue ethics', 3],
    ['utilitarianism', 3], ['kantian ethics', 3], ['social contract', 3],
    ['empiricism', 3], ['rationalism', 3], ['idealism', 2], ['materialism', 2],
    ['existentialism', 3], ['phenomenology', 3], ['hermeneutics', 3],
    ['plato', 2], ['aristotle', 2], ['descartes', 2], ['hume', 2], ['kant', 2],
    ['hegel', 2], ['nietzsche', 2], ['wittgenstein', 2], ['sartre', 2],
    ['philosophy of mind', 3], ['philosophy of language', 3], ['logic', 2],
    ['syllogism', 3], ['modus ponens', 3], ['fallacy', 2],
    ['ethics', 1], ['morality', 1], ['truth', 1], ['knowledge', 1],
    ['free will', 2], ['determinism', 2], ['consciousness', 1],
  ],

  environmental_science: [
    ['climate change', 3], ['global warming', 3], ['greenhouse gas', 3],
    ['carbon footprint', 3], ['carbon sequestration', 3], ['net zero', 3],
    ['renewable energy', 3], ['solar power', 2], ['wind energy', 2], ['geothermal', 2],
    ['biodiversity', 2], ['habitat loss', 3], ['species extinction', 3],
    ['ocean acidification', 3], ['sea level rise', 3], ['permafrost', 3],
    ['deforestation', 2], ['reforestation', 2], ['sustainable development', 3],
    ['ecological footprint', 3], ['carrying capacity', 3], ['trophic cascade', 3],
    ['biogeochemical cycle', 3], ['nitrogen cycle', 3], ['phosphorus cycle', 3],
    ['pollution', 1], ['ecosystem', 1], ['conservation', 1], ['sustainability', 1],
    ['environment', 1], ['ecology', 1], ['habitat', 1],
    ['ipcc', 3], ['cop', 2], ['paris agreement', 3], ['kyoto protocol', 3],
  ],

  music: [
    ['music theory', 3], ['circle of fifths', 3], ['chord progression', 3],
    ['counterpoint', 3], ['figured bass', 3], ['voice leading', 3],
    ['sonata form', 3], ['rondo form', 3], ['theme and variation', 3],
    ['time signature', 2], ['key signature', 2], ['tempo marking', 2],
    ['dynamics', 2], ['articulation', 2], ['phrasing', 2],
    ['tonic', 2], ['dominant', 2], ['subdominant', 2], ['cadence', 2],
    ['major scale', 2], ['minor scale', 2], ['mode', 2], ['interval', 2],
    ['orchestration', 3], ['instrumentation', 2], ['arranging', 2],
    ['mixing', 2], ['mastering', 2], ['daw', 2], ['midi', 2],
    ['jazz harmony', 3], ['blues scale', 3], ['improvisation', 2],
    ['rhythm', 1], ['melody', 1], ['harmony', 1], ['notation', 1],
    ['solfege', 3], ['ear training', 3], ['sight reading', 3],
  ],

  space_astronomy: [
    ['stellar evolution', 3], ['hertzsprung russell diagram', 3],
    ['main sequence star', 3], ['white dwarf', 3], ['neutron star', 3],
    ['black hole', 2], ['event horizon', 3], ['hawking radiation', 3],
    ['hubble constant', 3], ['cosmic microwave background', 3], ['big bang', 2],
    ['dark matter', 3], ['dark energy', 3], ['cosmological constant', 3],
    ['orbital mechanics', 3], ['kepler laws', 3], ['escape velocity', 3],
    ['spectroscopy', 2], ['redshift', 2], ['blueshift', 2], ['parallax', 2],
    ['galaxy', 2], ['nebula', 2], ['supernova', 2], ['pulsar', 3],
    ['exoplanet', 3], ['transit method', 3], ['radial velocity', 3],
    ['telescope', 1], ['space', 1], ['planet', 1], ['star', 1],
    ['solar system', 2], ['astronomy', 1], ['astronaut', 1], ['orbit', 1],
    ['nasa', 2], ['isro', 2], ['esa', 2], ['james webb', 3],
  ],

  general: [],
};

// ─── Node Templates ───────────────────────────────────────────────────────────

/** @type {Object.<DomainKey, string[]>} */
export const DOMAIN_NODE_TEMPLATES = {
  dsa: [
    'hook', 'prior_knowledge_bridge', 'concept', 'intuition',
    'complexity_analysis', 'step_by_step', 'worked_example',
    'visual', 'edge_case', 'common_mistake', 'real_world_application', 'result',
  ],
  mathematics: [
    'hook', 'prior_knowledge_bridge', 'concept', 'geometric_intuition',
    'proof_sketch', 'worked_example', 'visual', 'common_mistake',
    'real_world_application', 'result',
  ],
  physics: [
    'hook', 'phenomenon', 'concept', 'intuition', 'mathematical_model',
    'experiment', 'worked_example', 'visual', 'common_mistake',
    'real_world_application', 'result',
  ],
  chemistry: [
    'hook', 'prior_knowledge_bridge', 'concept', 'molecular_intuition',
    'reaction_mechanism', 'worked_example', 'visual', 'safety_note',
    'real_world_application', 'result',
  ],
  biology: [
    'hook', 'prior_knowledge_bridge', 'concept', 'analogy',
    'process_breakdown', 'case_study', 'visual', 'common_mistake',
    'real_world_application', 'result',
  ],
  medicine: [
    'clinical_hook', 'anatomy_context', 'concept', 'pathophysiology',
    'diagnosis_walkthrough', 'treatment_protocol', 'visual',
    'clinical_pearl', 'real_world_application', 'result',
  ],
  computer_science: [
    'hook', 'prior_knowledge_bridge', 'concept', 'architecture_overview',
    'code_walkthrough', 'worked_example', 'visual', 'best_practice',
    'common_mistake', 'real_world_application', 'result',
  ],
  engineering: [
    'problem_statement', 'concept', 'physical_intuition',
    'formula_derivation', 'worked_example', 'visual',
    'design_consideration', 'real_world_application', 'result',
  ],
  business: [
    'scenario_hook', 'concept', 'framework', 'case_study',
    'worked_example', 'visual', 'common_pitfall',
    'real_world_application', 'result',
  ],
  law: [
    'case_hook', 'legal_concept', 'principle', 'case_analysis',
    'argument_structure', 'visual', 'common_confusion',
    'real_world_application', 'result',
  ],
  history: [
    'narrative_hook', 'context', 'key_event', 'cause_effect',
    'timeline_walk', 'visual', 'multiple_perspectives',
    'significance', 'result',
  ],
  geography: [
    'hook', 'concept', 'spatial_intuition', 'process_breakdown',
    'case_study', 'visual', 'real_world_application', 'result',
  ],
  psychology: [
    'behavior_hook', 'concept', 'theory', 'experiment',
    'application', 'visual', 'common_mistake',
    'real_world_application', 'result',
  ],
  arts: [
    'aesthetic_hook', 'concept', 'technique_breakdown',
    'worked_example', 'visual', 'style_analysis',
    'real_world_application', 'result',
  ],
  economics: [
    'scenario_hook', 'concept', 'model', 'graph_intuition',
    'worked_example', 'visual', 'policy_implication',
    'real_world_application', 'result',
  ],
  aviation_maritime: [
    'scenario_hook', 'concept', 'physical_intuition',
    'procedure_walkthrough', 'visual', 'safety_critical',
    'real_world_application', 'result',
  ],
  data_science: [
    'hook', 'problem_framing', 'concept', 'mathematical_foundation',
    'algorithm_walkthrough', 'code_example', 'visual',
    'evaluation_metrics', 'common_pitfall', 'real_world_application', 'result',
  ],
  cybersecurity: [
    'threat_scenario', 'concept', 'attack_walkthrough', 'defense_mechanism',
    'hands_on_demo', 'visual', 'best_practice', 'real_world_case', 'result',
  ],
  linguistics: [
    'hook', 'prior_knowledge_bridge', 'concept', 'structural_analysis',
    'cross_language_example', 'visual', 'common_mistake',
    'real_world_application', 'result',
  ],
  philosophy: [
    'thought_experiment', 'concept', 'historical_context',
    'argument_structure', 'counterargument', 'visual',
    'contemporary_relevance', 'result',
  ],
  environmental_science: [
    'impact_hook', 'concept', 'mechanism', 'data_evidence',
    'case_study', 'visual', 'solution_pathway',
    'real_world_application', 'result',
  ],
  music: [
    'listening_hook', 'concept', 'theory_foundation', 'ear_training',
    'worked_example', 'visual', 'composition_exercise',
    'real_world_application', 'result',
  ],
  space_astronomy: [
    'wonder_hook', 'concept', 'physical_intuition', 'mathematical_model',
    'observational_evidence', 'visual', 'scale_analogy',
    'real_world_application', 'result',
  ],
  general: [
    'hook', 'prior_knowledge_bridge', 'concept', 'intuition',
    'step_by_step', 'worked_example', 'visual', 'common_mistake',
    'real_world_application', 'result',
  ],
};

// ─── Animation Guides ──────────────────────────────────────────────────────────

/** @type {Object.<DomainKey, string>} */
export const DOMAIN_ANIMATION_GUIDE = {
  dsa: `
ANIMATION STRATEGY — DSA / ALGORITHMS:
  Primitives: array, pointer, swapbridge, comparator, codeline, highlightbox, circle, arrow
  Layout rules:
    - Data structures: centered at x=400. Arrays = horizontal rect cells.
    - Trees/graphs: root at (400,120), children below. circle=node, arrow=edge.
    - Linked lists: rect cells with arrow connectors left→right at y=250.
    - Stacks/queues: rect cells stacked vertically at x=400.
  Step rhythm:
    - One comparison = one step. One swap = one step. One pointer move = one step.
    - sortedCells → green fill. compareCells → orange fill. activeCells → yellow fill.
    - codeline (x=80) shows pseudocode; highlight current executing line each step.
  MINIMUM STEPS: sorting=18 | searching=10 | trees=12 | graph traversal=14 | dp=16
`,

  mathematics: `
ANIMATION STRATEGY — MATHEMATICS:
  Primitives: path (curves/functions), circle (points/roots), arrow (vectors/direction),
              text (labels/equations), arc (angles), rect (matrix cells/axes)
  Layout rules:
    - Function label prominently at (400,60) as text.
    - Coordinate axes: horizontal line y=350, vertical line x=100.
    - Animate left→right for input→output logic.
    - Matrix: rect grid with text inside each cell; highlight active row/col.
    - Vectors: arrow from origin; label components with badge.
    - Statistics: rect bars (histogram) with text values on top.
  MINIMUM STEPS: calculus=12 | geometry=10 | matrices=10 | statistics=8 | probability=10
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
  Primitives: circle (neurons/nodes), arrow (weights/data flow), rect (layers/matrices),
              path (decision boundaries/curves), badge (metrics/values), codeline (code)
  Layout rules:
    - Neural network: circles in column layers (input→hidden→output), weighted arrows.
    - Decision tree: binary tree of rect nodes, arrow branches, badge=split condition.
    - Training loop: circular arrow (data→model→loss→gradient→model).
    - Confusion matrix: 2×2 rect grid with values; color TP=green, FP=red, FN=orange, TN=gray.
    - Dimensionality reduction: scatter of circles in 3D→arrow→2D scatter.
    - Gradient descent: path curve (loss function), circle (current point) moving down.
  MINIMUM STEPS: neural net=14 | training=12 | decision tree=10 | evaluation=8
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

// ─── Detection ────────────────────────────────────────────────────────────────

// ─── Detection ────────────────────────────────────────────────────────────────

/**
 * Rank all domains by keyword score for the given topic string.
 * @param {string} topic
 * @returns {DetectionResult[]}
 */
export function detectDomains(topic) {
  const t = topic.toLowerCase();

  /** @type {Map<DomainKey, number>} */
  const scores = new Map();

  for (const [domain, entries] of Object.entries(DOMAIN_KEYWORDS)) {
    if (domain === 'general') continue;
    let score = 0;
    for (const [keyword, weight] of entries) {
      if (t.includes(keyword)) score += weight;
    }
    if (score > 0) scores.set(domain, score);
  }

  if (scores.size === 0) return [{ domain: 'general', score: 0 }];

  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([domain, score]) => ({ domain, score }));
}

/**
 * Drop-in replacement for the old detectDomain().
 * @param {string} topic
 * @returns {DomainKey}
 */
export function getPrimaryDomain(topic) {
  return detectDomains(topic)[0].domain;
}

// ─── Convenience Getters ──────────────────────────────────────────────────────

/**
 * @param {DomainKey} domain
 * @returns {DomainMeta}
 */
export function getDomainMeta(domain) {
  return DOMAIN_META[domain];
}

/**
 * @param {DomainKey} domain
 * @returns {string[]}
 */
export function getNodeTemplates(domain) {
  return DOMAIN_NODE_TEMPLATES[domain] ?? DOMAIN_NODE_TEMPLATES.general;
}

/**
 * @param {DomainKey} domain
 * @returns {string}
 */
export function getAnimationGuide(domain) {
  return DOMAIN_ANIMATION_GUIDE[domain] ?? DOMAIN_ANIMATION_GUIDE.general;
}

/**
 * @typedef {Object} DomainConfig
 * @property {DomainKey} primary
 * @property {DetectionResult[]} ranked
 * @property {DomainMeta} meta
 * @property {string[]} nodeTemplates
 * @property {string} animationGuide
 */

/**
 * Returns full config for a topic in one call.
 * @param {string} topic
 * @returns {DomainConfig}
 */
export function getDomainConfig(topic) {
  const ranked = detectDomains(topic);
  const primary = ranked[0].domain;
  return {
    primary,
    ranked,
    meta: getDomainMeta(primary),
    nodeTemplates: getNodeTemplates(primary),
    animationGuide: getAnimationGuide(primary),
  };
}

// ─── Backward Compatibility ───────────────────────────────────────────────────

/** @deprecated Use getPrimaryDomain() instead. */
export const detectDomain = getPrimaryDomain;