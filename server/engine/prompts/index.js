/**
 * Prompts Index
 * Re-exports all prompt modules for modular usage.
 */

export { 
  TEACHING_ENGINE_PROMPT,
  buildTeachingEnginePrompt,
  validateTeachingEngineResponse
} from './systemPrompts.js';

export { 
  isGreeting, 
  inferDifficulty,
  buildLessonPrompt, 
  buildRetryPrompt,
  buildCondensedPrompt,
  buildDoubtUserMessage,
  buildDoubtContext 
} from './userPrompts.js';

export { 
  TEACHING_TIMELINE_PROMPT,
  buildTimelinePrompt,
  validateTimelineResponse
} from './timelinePrompt.js';

export { 
  DOUBT_RESPONSE_PROMPT,
  buildDoubtPrompt 
} from './doubtPrompt.js';

export { 
  DOMAIN_KEYWORDS, 
  DOMAIN_NODE_TEMPLATES, 
  DOMAIN_ANIMATION_GUIDE,
  DOMAIN_META,
  detectDomains,
  getPrimaryDomain,
  getDomainMeta,
  getNodeTemplates,
  getAnimationGuide,
  getDomainConfig,
  detectDomain 
} from './domainConfig.js';
