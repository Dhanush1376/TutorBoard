/**
 * Shared constants for the teaching engine
 */

export const DOMAIN_STYLES = {
  dsa:                  { bg: 'rgba(5,150,105,0.15)',   border: 'rgba(5,150,105,0.3)',   text: '#10b981', label: 'DSA' },
  mathematics:          { bg: 'rgba(2,132,199,0.15)',   border: 'rgba(2,132,199,0.3)',   text: '#0284c7', label: 'Math' },
  physics:              { bg: 'rgba(37,99,235,0.15)',   border: 'rgba(37,99,235,0.3)',   text: '#3b82f6', label: 'Physics' },
  chemistry:            { bg: 'rgba(220,38,38,0.15)',   border: 'rgba(220,38,38,0.3)',   text: '#ef4444', label: 'Chemistry' },
  biology:              { bg: 'rgba(22,163,74,0.15)',   border: 'rgba(22,163,74,0.3)',   text: '#22c55e', label: 'Biology' },
  medicine:             { bg: 'rgba(236,72,153,0.15)',  border: 'rgba(236,72,153,0.3)',  text: '#ec4899', label: 'Medicine' },
  computer_science:     { bg: 'rgba(6,182,212,0.15)',   border: 'rgba(6,182,212,0.3)',   text: '#06b6d4', label: 'CS' },
  engineering:          { bg: 'rgba(217,119,6,0.15)',   border: 'rgba(217,119,6,0.3)',   text: '#f59e0b', label: 'Engineering' },
  business:             { bg: 'rgba(20,184,166,0.15)',  border: 'rgba(20,184,166,0.3)',  text: '#14b8a6', label: 'Business' },
  law:                  { bg: 'rgba(245,158,11,0.15)',  border: 'rgba(245,158,11,0.3)',  text: '#fbbf24', label: 'Law' },
  history:              { bg: 'rgba(161,98,7,0.15)',    border: 'rgba(161,98,7,0.3)',    text: '#ca8a04', label: 'History' },
  geography:            { bg: 'rgba(21,128,61,0.15)',   border: 'rgba(21,128,61,0.3)',   text: '#16a34a', label: 'Geography' },
  psychology:           { bg: 'rgba(13,148,136,0.15)',  border: 'rgba(13,148,136,0.3)',  text: '#0d9488', label: 'Psychology' },
  arts:                 { bg: 'rgba(244,63,94,0.15)',   border: 'rgba(244,63,94,0.3)',   text: '#f43f5e', label: 'Arts' },
  economics:            { bg: 'rgba(34,197,94,0.15)',   border: 'rgba(34,197,94,0.3)',   text: '#4ade80', label: 'Economics' },
  aviation_maritime:    { bg: 'rgba(56,189,248,0.15)',  border: 'rgba(56,189,248,0.3)',  text: '#38bdf8', label: 'Aviation' },
  data_science:         { bg: 'rgba(14,165,233,0.15)',  border: 'rgba(14,165,233,0.3)',  text: '#0ea5e9', label: 'Data Science' },
  cybersecurity:        { bg: 'rgba(30,41,59,0.25)',    border: 'rgba(71,85,105,0.3)',   text: '#94a3b8', label: 'Cybersecurity' },
  linguistics:          { bg: 'rgba(8,145,178,0.15)',   border: 'rgba(8,145,178,0.3)',   text: '#0891b2', label: 'Linguistics' },
  philosophy:           { bg: 'rgba(87,83,78,0.15)',    border: 'rgba(87,83,78,0.3)',    text: '#a8a29e', label: 'Philosophy' },
  environmental_science:{ bg: 'rgba(22,163,74,0.15)',   border: 'rgba(22,163,74,0.3)',   text: '#16a34a', label: 'Environment' },
  music:                { bg: 'rgba(220,38,38,0.15)',   border: 'rgba(220,38,38,0.3)',   text: '#dc2626', label: 'Music' },
  space_astronomy:      { bg: 'rgba(15,23,42,0.25)',    border: 'rgba(56,189,248,0.3)',  text: '#38bdf8', label: 'Astronomy' },
  general:              { bg: 'rgba(107,114,128,0.15)', border: 'rgba(107,114,128,0.3)', text: '#9ca3af', label: 'General' },
};

export const DOUBT_PLACEHOLDERS = {
  dsa:              'Trace through this step with me... (?)',
  mathematics:      'Why does this equation work? (?)',
  physics:          'I don\'t understand this force... (?)',
  chemistry:        'How do these atoms bond here? (?)',
  biology:          'Which organelle does this? (?)',
  medicine:         'What\'s the diagnostic path? (?)',
  computer_science: 'What happens in memory here? (?)',
  engineering:      'Where does this force go? (?)',
  business:         'How does this apply to real cases? (?)',
  law:              'What\'s the legal principle here? (?)',
  history:          'Why did this happen at this moment? (?)',
  geography:        'Where is this located on the map? (?)',
  psychology:       'Is this behavior always true? (?)',
  arts:             'What\'s the technique being used here? (?)',
  economics:        'What causes this market shift? (?)',
  aviation_maritime: 'How does this rule apply at sea/air? (?)',
  data_science:     'How do we interpret this distribution? (?)',
  cybersecurity:    'What\'s the vulnerability in this flow? (?)',
  linguistics:      'How does this grammar rule apply? (?)',
  philosophy:       'What\'s the ethical implication? (?)',
  environmental_science: 'How does this impact the ecosystem? (?)',
  music:            'What\'s the scale/rhythm logic here? (?)',
  space_astronomy:  'What\'s the orbital physics here? (?)',
  general:          'Ask a doubt or give a command... (?)',
};

/** Key of a lesson step's "predict the next step" check (answers are kept per lesson). */
export const checkKey = (lesson, stepIndex) => `${lesson?.title ?? lesson?.id ?? 'lesson'}:${stepIndex}`; // title: stable while a lesson streams in

/** Is the lesson waiting at this step for the learner to answer its check? */
export const awaitingCheck = (lesson, stepIndex, answers) => {
  const steps = lesson?.steps || lesson?.timeline || [];
  return !!steps[stepIndex]?.check && answers?.[checkKey(lesson, stepIndex)] === undefined;
};

/** The learner's level from their checks this session (5.2): lessons get smaller steps or sharper ones. */
export const learnerLevelFrom = ({ right = 0, wrong = 0 } = {}) =>
  wrong >= 2 && wrong > right ? 'beginner' : right >= 3 && wrong === 0 ? 'advanced' : 'intermediate';

export const PANEL_VISIBLE_STATES = ['TEACHING', 'RESPONDING', 'RESUMING', 'DOUBT_TRIGGERED', 'PAUSED'];

export const formatTopicTitle = (raw) => {
  if (!raw) return 'Session';
  let title = String(raw).trim();
  
  // Strip thought tags or context blocks if present
  title = title.replace(/<thought>[\s\S]*?<\/thought>/gi, '').trim();
  const contextMatch = title.match(/Context: ".*?"\s*\n\nQuestion:\s*(.*)/is);
  if (contextMatch && contextMatch[1]) {
    title = contextMatch[1].trim();
  }
  title = title.replace(/^Question:\s*/i, '').trim();

  // Strip conversational openers iteratively (e.g. "can you teach me", "please explain to me", etc.)
  let prev;
  do {
    prev = title;
    title = title.replace(/^(?:can you|could you|would you|please|i want to learn|i want to know|teach me|tell me|show me|explain to me|help me with|help me|explain|describe)\s+(?:about\s+)?/i, '').trim();
  } while (title !== prev);

  // Convert telegraphic "how find", "how calculate", or "how do i / can i" to "how to ..."
  title = title.replace(/^how\s+(?:do\s+i|can\s+i|can\s+we|to)\s+/i, 'how to ');
  title = title.replace(/^how\s+(find|calculate|derive|solve|compute|get|make|draw|integrate|differentiate|prove)\b/i, 'how to $1');

  // Clean trailing punctuation and markdown formatting artifacts
  title = title.replace(/[?.,!;:]+$/, '').trim();
  title = title.replace(/^[`*#_~"']+|[`*#_~"']+$/g, '').trim();

  if (!title) return 'Session';

  // Words that stay lowercase unless they are the first word
  const minorWords = new Set([
    'a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 'on', 'at', 'to', 'from',
    'by', 'of', 'in', 'with', 'as', 'into', 'over'
  ]);

  const words = title.split(/\s+/).filter(Boolean);
  const formatted = words.map((word, idx) => {
    const lower = word.toLowerCase();
    // Preserve well-known all-caps acronyms / identifiers (e.g. AI, DNA, HTML, CPU, 2D, 3D)
    if (word.length > 1 && word === word.toUpperCase() && /^[A-Z0-9]+$/.test(word)) {
      return word;
    }
    if (idx > 0 && minorWords.has(lower)) {
      return lower;
    }
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  }).join(' ');

  return formatted.trim() || 'Session';
};
