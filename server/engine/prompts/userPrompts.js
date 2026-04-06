/**
 * User Prompt Templates
 */

import { detectDomain } from './domainConfig.js';

const GREETINGS = ['hi','hello','hey','yo','sup','hola','greetings','howdy','namaste'];

export function isGreeting(text) {
  if (!text) return false;
  const cleaned = text.trim().toLowerCase().replace(/[!?.,']/g, '');
  return GREETINGS.some(g => cleaned === g || cleaned.startsWith(g + ' '));
}

// Short domain-specific shape hints — enough to guide the AI without blowing the token budget
const DOMAIN_HINTS = {
  dsa: 'Use rect cells for arrays, circle for tree/graph nodes, arrow for pointers and edges. Show each comparison or swap as a separate step.',
  mathematics: 'Use line/arrow for axes and vectors, circle for points, text for equations and labels. Build geometry or graphs step by step.',
  physics: 'Use circle for objects/particles, arrow for forces and velocity, text for equations. Show before-state then after-state.',
  chemistry: 'Use circle for atoms (H=white, C=gray, O=red, N=blue), arrow for electron movement and reactions. Left=reactants, right=products.',
  biology: 'Use large circle for cell/organ boundary, smaller circles inside for components, arrow for processes and signals.',
  general: 'Use a clear labelled diagram. Arrows for relationships and flow. Build complexity one concept at a time.',
};

export function buildTeachingPrompt(topic) {
  const domain = detectDomain(topic);
  const hint = DOMAIN_HINTS[domain] || DOMAIN_HINTS.general;
  return `Draw a step-by-step visual explanation of: "${topic}"

Domain: ${domain}
Drawing hint: ${hint}

Return ONLY valid JSON following the system prompt format.`;
}

export function buildRetryPrompt(errors) {
  return `Fix these validation errors and return corrected JSON: ${errors.join('; ')}`;
}

export function buildCondensedPrompt() {
  return `Return valid JSON only.`;
}

export function buildDoubtContext(session, domain) {
  return `Topic: ${session.timeline?.title || 'N/A'}, Domain: ${domain}`;
}
