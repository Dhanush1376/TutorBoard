/**
 * Agents Index
 */
export { REFLECTION_AGENT_PROMPT } from './reflectionPrompt.js';
export { MAESTRO_PEDAGOGY_PROMPT } from './maestroPrompt.js';
export { 
  isGreeting, 
  buildTeachingPrompt 
} from './agentUtils.js';
export {
  detectDomain, 
  getAnimationGuide, 
  getNodeTemplates,
  getMinSteps,
  getVisualScaffold
} from './domainConfig.js';
export { DOUBT_RESPONSE_PROMPT, buildDoubtPrompt } from './doubtPrompt.js';
export { classifyDoubt } from './doubtClassifier.js';
export { buildTimelinePrompt, TIMELINE_RESPONSE_SCHEMA } from './timelinePrompt.js';
