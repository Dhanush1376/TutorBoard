/**
 * Domain Configuration — v2 (Modular)
 */

import * as base from './domains/base.js';
import * as dsa from './domains/dsa.js';
import * as math from './domains/math.js';
import * as science from './domains/science.js';
import * as computing from './domains/computing.js';
import * as humanities from './domains/humanities.js';
import * as professional from './domains/professional.js';
import * as arts from './domains/arts.js';
import * as general from './domains/general.js';

// Re-export Metadata
export const DOMAIN_META = base.DOMAIN_META;

// Merge Keywords
export const DOMAIN_KEYWORDS = {
  ...dsa.DOMAIN_KEYWORDS,
  ...math.DOMAIN_KEYWORDS,
  ...science.DOMAIN_KEYWORDS,
  ...computing.DOMAIN_KEYWORDS,
  ...humanities.DOMAIN_KEYWORDS,
  ...professional.DOMAIN_KEYWORDS,
  ...arts.DOMAIN_KEYWORDS,
  ...general.DOMAIN_KEYWORDS
};

// Merge Templates
export const DOMAIN_NODE_TEMPLATES = {
  ...dsa.DOMAIN_NODE_TEMPLATES,
  ...math.DOMAIN_NODE_TEMPLATES,
  ...science.DOMAIN_NODE_TEMPLATES,
  ...computing.DOMAIN_NODE_TEMPLATES,
  ...humanities.DOMAIN_NODE_TEMPLATES,
  ...professional.DOMAIN_NODE_TEMPLATES,
  ...arts.DOMAIN_NODE_TEMPLATES,
  ...general.DOMAIN_NODE_TEMPLATES
};

// Merge Animation Guides
export const DOMAIN_ANIMATION_GUIDE = {
  ...dsa.DOMAIN_ANIMATION_GUIDE,
  ...math.DOMAIN_ANIMATION_GUIDE,
  ...science.DOMAIN_ANIMATION_GUIDE,
  ...computing.DOMAIN_ANIMATION_GUIDE,
  ...humanities.DOMAIN_ANIMATION_GUIDE,
  ...professional.DOMAIN_ANIMATION_GUIDE,
  ...arts.DOMAIN_ANIMATION_GUIDE,
  ...general.DOMAIN_ANIMATION_GUIDE
};

/**
 * Machine-readable minimum step requirements per domain/topic.
 */
// Merge Min Steps
export const DOMAIN_MIN_STEPS = {
  ...dsa.DOMAIN_MIN_STEPS,
  ...math.DOMAIN_MIN_STEPS,
  ...science.DOMAIN_MIN_STEPS,
  ...computing.DOMAIN_MIN_STEPS,
  ...humanities.DOMAIN_MIN_STEPS,
  ...professional.DOMAIN_MIN_STEPS,
  ...arts.DOMAIN_MIN_STEPS,
  ...general.DOMAIN_MIN_STEPS
};

/**
 * Subject-specific Scene Scaffolds.
 */
export const DOMAIN_SCENE_SCAFFOLDS = {
  ...dsa.DOMAIN_SCENE_SCAFFOLDS,
  ...math.DOMAIN_SCENE_SCAFFOLDS,
  ...science.DOMAIN_SCENE_SCAFFOLDS,
  ...computing.DOMAIN_SCENE_SCAFFOLDS,
  ...humanities.DOMAIN_SCENE_SCAFFOLDS,
  ...professional.DOMAIN_SCENE_SCAFFOLDS,
  ...arts.DOMAIN_SCENE_SCAFFOLDS,
  ...general.DOMAIN_SCENE_SCAFFOLDS
};


// Helper Functions
export function getVisualScaffold(domain) {
  return DOMAIN_SCENE_SCAFFOLDS[domain] || DOMAIN_SCENE_SCAFFOLDS.general;
}

export function detectDomains(topic) {
  const t = topic.toLowerCase();
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

export function getPrimaryDomain(topic) {
  return detectDomains(topic)[0].domain;
}

export function getDomainMeta(domain) {
  return DOMAIN_META[domain];
}

export function getNodeTemplates(domain) {
  return DOMAIN_NODE_TEMPLATES[domain] ?? DOMAIN_NODE_TEMPLATES.general;
}

export function getAnimationGuide(domain) {
  return DOMAIN_ANIMATION_GUIDE[domain] ?? DOMAIN_ANIMATION_GUIDE.general;
}

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

export function getMinSteps(domain, topic) {
  const config = DOMAIN_MIN_STEPS[domain] || DOMAIN_MIN_STEPS.general;
  const t = (topic || '').toLowerCase();
  for (const [key, value] of Object.entries(config)) {
    if (key !== 'default' && t.includes(key)) return value;
  }
  return config.default;
}

/** @deprecated Use getPrimaryDomain() instead. */
export const detectDomain = getPrimaryDomain;
