/**
 * Shared constants for the teaching engine
 */

export const DOMAIN_STYLES = {
  dsa:                  { bg: 'rgba(5,150,105,0.15)',   border: 'rgba(5,150,105,0.3)',   text: '#10b981', label: 'DSA' },
  mathematics:          { bg: 'rgba(124,58,237,0.15)',  border: 'rgba(124,58,237,0.3)',  text: '#8b5cf6', label: 'Math' },
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
  psychology:           { bg: 'rgba(168,85,247,0.15)',  border: 'rgba(168,85,247,0.3)',  text: '#a855f7', label: 'Psychology' },
  arts:                 { bg: 'rgba(244,63,94,0.15)',   border: 'rgba(244,63,94,0.3)',   text: '#f43f5e', label: 'Arts' },
  economics:            { bg: 'rgba(34,197,94,0.15)',   border: 'rgba(34,197,94,0.3)',   text: '#4ade80', label: 'Economics' },
  aviation_maritime:    { bg: 'rgba(56,189,248,0.15)',  border: 'rgba(56,189,248,0.3)',  text: '#38bdf8', label: 'Aviation' },
  data_science:         { bg: 'rgba(124,58,237,0.15)',  border: 'rgba(124,58,237,0.3)',  text: '#7c3aed', label: 'Data Science' },
  cybersecurity:        { bg: 'rgba(30,41,59,0.25)',    border: 'rgba(71,85,105,0.3)',   text: '#94a3b8', label: 'Cybersecurity' },
  linguistics:          { bg: 'rgba(147,51,234,0.15)',  border: 'rgba(147,51,234,0.3)',  text: '#9333ea', label: 'Linguistics' },
  philosophy:           { bg: 'rgba(87,83,78,0.15)',    border: 'rgba(87,83,78,0.3)',    text: '#a8a29e', label: 'Philosophy' },
  environmental_science:{ bg: 'rgba(22,163,74,0.15)',   border: 'rgba(22,163,74,0.3)',   text: '#16a34a', label: 'Environment' },
  music:                { bg: 'rgba(220,38,38,0.15)',   border: 'rgba(220,38,38,0.3)',   text: '#dc2626', label: 'Music' },
  space_astronomy:      { bg: 'rgba(30,27,75,0.25)',    border: 'rgba(129,140,248,0.3)', text: '#818cf8', label: 'Astronomy' },
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

export const PANEL_VISIBLE_STATES = ['TEACHING', 'RESPONDING', 'RESUMING'];

export const formatTopicTitle = (raw) => {
  if (!raw) return 'Session';
  let title = raw.trim();
  
  let prev;
  do {
    prev = title;
    title = title.replace(/^(can you|could you|please|explain|tell|show|teach|help|i want to learn|understanding|understand|me|to me|about|what|how|why|is|are|does|do|a|an|the)\s+/i, '');
  } while (title !== prev);
  
  title = title.replace(/\?+$/, '');
  
  title = title.split(' ')
    .filter(w => w.length > 0)
    .map(w => {
      const smallWords = ['a', 'an', 'the', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'and', 'or'];
      if (smallWords.includes(w.toLowerCase())) return w.toLowerCase();
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(' ');
    
  if (title.length > 0) {
    title = title.charAt(0).toUpperCase() + title.slice(1);
  }
  
  return title.trim() || 'Session';
};
