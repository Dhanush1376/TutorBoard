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
export { DOUBT_RESPONSE_PROMPT, buildDoubtPrompt, classifyDoubt } from './doubtPrompt.js';
export { buildTimelinePrompt } from './timelinePrompt.js';
