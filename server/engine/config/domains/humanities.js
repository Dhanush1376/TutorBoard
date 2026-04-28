export const DOMAIN_KEYWORDS = {
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
};

export const DOMAIN_NODE_TEMPLATES = {
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
  law: [
    'case_hook', 'legal_concept', 'principle', 'case_analysis',
    'argument_structure', 'visual', 'common_confusion',
    'real_world_application', 'result',
  ],
  philosophy: [
    'thought_experiment', 'concept', 'historical_context',
    'argument_structure', 'counterargument', 'visual',
    'contemporary_relevance', 'result',
  ],
  linguistics: [
    'hook', 'prior_knowledge_bridge', 'concept', 'structural_analysis',
    'cross_language_example', 'visual', 'common_mistake',
    'real_world_application', 'result',
  ],
};

export const DOMAIN_ANIMATION_GUIDE = {
  history: `
ANIMATION STRATEGY — HISTORY:
  Renderer: Use "narrative" (D3) for chronological timelines and sequence-heavy topics.
  Primitives: rect (events/periods), arrow (causation/influence/timeline),
              text (dates/names), badge (key figures/outcomes)
  Layout rules:
    - Timeline: Use the D3 axis at the center. Each step maps to a labeled marker.
    - Cause-Effect: Animate arrows connecting markers to indicate historical links.
  MINIMUM STEPS: timeline=10 | cause-effect=10 | battles=12
`,
  psychology: `
ANIMATION STRATEGY — PSYCHOLOGY:
  Primitives: circle (person/brain regions), arrow (behavior/thought flow), rect (theory models)
  Layout rules:
    - Maslow: stacked rect pyramid.
    - Behavioral: stimulus (LEFT) → response (RIGHT) chain.
  MINIMUM STEPS: theories=10 | brain=12
`,
  geography: `
ANIMATION STRATEGY — GEOGRAPHY:
  Primitives: path (coastlines), rect (regions), arrow (flow), badge (labels)
  Layout rules:
    - Maps: simplified path outlines.
    - Processes: sequential arrow+shape animation.
  MINIMUM STEPS: map=10 | process=10
`,
  law: `
ANIMATION STRATEGY — LAW:
  Primitives: rect (parties), arrow (flow of rights), badge (statutes), highlightbox (holdings)
  Layout rules:
    - Case analysis: parties as rect on LEFT/RIGHT.
    - Hierarchy: constitution at top, regulations below.
  MINIMUM STEPS: case study=10 | process=10
`,
};
export const DOMAIN_MIN_STEPS = {
  history: { timeline: 10, cause: 10, biography: 8, battle: 12, default: 8 },
  geography: { map: 10, climate: 10, process: 10, demographic: 8, default: 8 },
  psychology: { theory: 10, experiment: 10, brain: 12, model: 10, default: 8 },
  law: { case: 10, process: 10, principle: 8, constitution: 10, default: 8 },
  philosophy: { argument: 8, framework: 10, thought: 10, dialect: 10, default: 8 },
  linguistics: { syntax: 10, phonolog: 10, morpholog: 8, cross: 10, default: 8 },
};

export const DOMAIN_SCENE_SCAFFOLDS = {};
