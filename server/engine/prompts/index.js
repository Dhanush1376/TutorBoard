/**
 * Prompts Index
 * Re-exports all prompt modules for backward compatibility
 */

export { 
  TEACHING_PHILOSOPHY, 
  TEACHING_ENGINE_PROMPT,
  DOMAIN_PERSONAS,
  DOMAIN_NARRATION_STYLES
} from './systemPrompts.js';

export { 
  isGreeting, 
  buildTeachingPrompt, 
  buildRetryPrompt,
  buildCondensedPrompt,
  buildDoubtContext 
} from './userPrompts.js';

export { TEACHING_TIMELINE_PROMPT } from './timelinePrompt.js';
export { DOUBT_RESPONSE_PROMPT } from './doubtPrompt.js';

export { 
  DOMAIN_KEYWORDS, 
  DOMAIN_NODE_TEMPLATES, 
  DOMAIN_ANIMATION_GUIDE,
  detectDomain 
} from './domainConfig.js';
