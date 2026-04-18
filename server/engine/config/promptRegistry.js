/**
 * PromptRegistry — Centralized Agent Prompt Management
 * 
 * Versioning:
 *  - 'latest': The newest verified prompt strings.
 *  - 'v8.0': Legacy context-heavy prompts (fallback).
 * 
 * Powered by process.env.PROMPT_VERSION
 */

import { PLANNER_AGENT_PROMPT } from '../agents/plannerAgent.js';
import { NARRATOR_AGENT_PROMPT } from '../agents/narratorAgent.js';
import { VISUALIZER_AGENT_PROMPT } from '../agents/visualizerAgent.js';
import { ANIMATOR_AGENT_PROMPT } from '../agents/animatorAgent.js';
import { CRITIC_AGENT_PROMPT } from '../agents/criticAgent.js';
import { VALIDATOR_AGENT_PROMPT } from '../agents/validatorAgent.js';
import { DOUBT_RESPONSE_PROMPT } from '../agents/doubtPrompt.js';

export const PROMPT_REGISTRY = {
  latest: {
    planner:    PLANNER_AGENT_PROMPT,
    narrator:   NARRATOR_AGENT_PROMPT,
    visualizer: VISUALIZER_AGENT_PROMPT,
    animator:   ANIMATOR_AGENT_PROMPT,
    critic:     CRITIC_AGENT_PROMPT,
    validator:  VALIDATOR_AGENT_PROMPT,
    doubt:      DOUBT_RESPONSE_PROMPT
  },
  // Placeholders for future A/B testing or rollbacks
  v8: {
    planner:    PLANNER_AGENT_PROMPT,
    narrator:   NARRATOR_AGENT_PROMPT,
    visualizer: VISUALIZER_AGENT_PROMPT,
    animator:   ANIMATOR_AGENT_PROMPT,
    critic:     CRITIC_AGENT_PROMPT,
    validator:  VALIDATOR_AGENT_PROMPT,
    doubt:      DOUBT_RESPONSE_PROMPT
  }
};

/**
 * Retrieves the specified agent prompt based on the registered version.
 * @param {'planner'|'narrator'|'visualizer'|'animator'|'critic'|'validator'|'doubt'} agentName 
 * @param {string} [version] 
 * @returns {string}
 */
export function getPrompt(agentName, version = process.env.PROMPT_VERSION || 'latest') {
  const selectedVersion = PROMPT_REGISTRY[version] || PROMPT_REGISTRY.latest;
  return selectedVersion[agentName] || PROMPT_REGISTRY.latest[agentName];
}

export default PROMPT_REGISTRY;
