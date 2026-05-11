/**
 * PromptRegistry — Enterprise Agent Prompt Management
 * Fulfills Enterprise Architecture Target for Prompt Versioning.
 */

import { PLANNER_AGENT_PROMPT } from '../agents/plannerAgent.js';
import { NARRATOR_AGENT_PROMPT } from '../agents/narratorAgent.js';
import { VISUALIZER_AGENT_PROMPT } from '../agents/visualizerAgent.js';
import { ANIMATOR_AGENT_PROMPT } from '../agents/animatorAgent.js';
import { CRITIC_AGENT_PROMPT } from '../agents/criticAgent.js';
import { VALIDATOR_AGENT_PROMPT } from '../agents/validatorAgent.js';
import { DOUBT_RESPONSE_PROMPT } from '../agents/doubtPrompt.js';

export const VERSIONS = {
  LATEST: 'latest',
  V9_0: 'v9.0',
  V8_0: 'v8.0'
};

const PROMPT_STORAGE = {
  [VERSIONS.LATEST]: {
    prompts: {
      planner:    PLANNER_AGENT_PROMPT,
      narrator:   NARRATOR_AGENT_PROMPT,
      visualizer: VISUALIZER_AGENT_PROMPT,
      animator:   ANIMATOR_AGENT_PROMPT,
      critic:     CRITIC_AGENT_PROMPT,
      validator:  VALIDATOR_AGENT_PROMPT,
      doubt:      DOUBT_RESPONSE_PROMPT
    },
    metadata: {
      version: '9.1.0-rc',
      deployedAt: '2026-05-10T12:00:00Z',
      author: 'Antigravity AI',
      description: 'Enterprise production-ready parallelized agent prompts.'
    }
  },
  [VERSIONS.V8_0]: {
    prompts: {
      planner:    PLANNER_AGENT_PROMPT,
      narrator:   NARRATOR_AGENT_PROMPT,
      visualizer: VISUALIZER_AGENT_PROMPT,
      animator:   ANIMATOR_AGENT_PROMPT,
      critic:     CRITIC_AGENT_PROMPT,
      validator:  VALIDATOR_AGENT_PROMPT,
      doubt:      DOUBT_RESPONSE_PROMPT
    },
    metadata: {
      version: '8.0.4',
      deployedAt: '2026-04-30T10:00:00Z',
      author: 'Core Team',
      description: 'Legacy synchronous agent prompts.'
    }
  }
};

class PromptRegistry {
  /**
   * Retrieves the specified agent prompt based on the registered version.
   * @param {string} agentName 
   * @param {string} [version] 
   * @returns {string}
   */
  getPrompt(agentName, version = process.env.PROMPT_VERSION || VERSIONS.LATEST) {
    const entry = PROMPT_STORAGE[version] || PROMPT_STORAGE[VERSIONS.LATEST];
    return entry.prompts[agentName] || PROMPT_STORAGE[VERSIONS.LATEST].prompts[agentName];
  }

  /**
   * Returns metadata for a specific prompt version.
   */
  getVersionMetadata(version = VERSIONS.LATEST) {
    return PROMPT_STORAGE[version]?.metadata || PROMPT_STORAGE[VERSIONS.LATEST].metadata;
  }

  /**
   * List all available prompt versions.
   */
  listVersions() {
    return Object.keys(PROMPT_STORAGE);
  }
}

const registry = new PromptRegistry();
export default registry;
export const getPrompt = registry.getPrompt.bind(registry);
export const PROMPT_REGISTRY = PROMPT_STORAGE; // Export for legacy compatibility

