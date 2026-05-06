/**
 * Unified Model Registry v1.0
 * 
 * Single source of truth for model tiers across all providers.
 * Used for validation, production routing, and automatic failovers.
 */

export const MODEL_REGISTRY = {
  openai: {
    validation: 'gpt-4o-mini',
    production: 'gpt-4o',
    fallback: 'gpt-3.5-turbo',
    chain: ['gpt-4o-mini', 'gpt-3.5-turbo']
  },
  google: {
    validation: 'gemini-1.5-flash',
    production: 'gemini-1.5-pro',
    fallback: 'gemini-2.0-flash',
    chain: ['gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite']
  },
  groq: {
    validation: 'llama-3.1-8b-instant',
    production: 'llama-3.3-70b-versatile',
    fallback: 'mixtral-8x7b-32768',
    chain: ['llama-3.1-8b-instant', 'mixtral-8x7b-32768', 'gemma2-9b-it']
  },
  anthropic: {
    validation: 'claude-3-5-haiku-20241022',
    production: 'claude-sonnet-4-20250514',
    fallback: 'claude-3-haiku-20240307',
    chain: ['claude-3-5-haiku-20241022', 'claude-3-haiku-20240307']
  },
  huggingface: {
    validation: 'mistralai/Mistral-7B-Instruct-v0.2',
    production: 'mistralai/Mistral-7B-Instruct-v0.2',
    fallback: 'google/gemma-2b-it',
    chain: ['mistralai/Mistral-7B-Instruct-v0.2', 'google/gemma-2b-it', 'tiiuae/falcon-7b-instruct']
  },
  deepseek: {
    validation: 'deepseek-chat',
    production: 'deepseek-chat',
    fallback: 'deepseek-chat',
    chain: ['deepseek-chat']
  },
  together: {
    validation: 'meta-llama/Llama-3.2-3B-Instruct-Turbo',
    production: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
    fallback: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
    chain: ['meta-llama/Llama-3.2-3B-Instruct-Turbo', 'meta-llama/Llama-3.1-8B-Instruct-Turbo', 'mistralai/Mixtral-8x7B-Instruct-v0.1']
  },
  mistral: {
    validation: 'mistral-small-latest',
    production: 'mistral-large-latest',
    fallback: 'open-mistral-7b',
    chain: ['mistral-small-latest', 'open-mistral-7b']
  },
  cerebras: {
    validation: 'llama3.1-8b',
    production: 'llama3.1-70b',
    fallback: 'llama3.1-8b',
    chain: ['llama3.1-8b']
  },
  sambanova: {
    validation: 'Meta-Llama-3.1-8B-Instruct',
    production: 'Meta-Llama-3.1-70B-Instruct',
    fallback: 'Meta-Llama-3.1-8B-Instruct',
    chain: ['Meta-Llama-3.1-8B-Instruct']
  },
  novita: {
    validation: 'meta-llama/llama-3.1-8b-instruct',
    production: 'meta-llama/llama-3.1-70b-instruct',
    fallback: 'mistralai/mistral-7b-instruct',
    chain: ['meta-llama/llama-3.1-8b-instruct', 'meta-llama/llama-3-8b-instruct', 'mistralai/mistral-7b-instruct']
  },
  fireworks: {
    validation: 'accounts/fireworks/models/llama-v3p1-8b-instruct',
    production: 'accounts/fireworks/models/llama-v3p1-70b-instruct',
    fallback: 'accounts/fireworks/models/mixtral-8x7b-instruct',
    chain: ['accounts/fireworks/models/llama-v3p1-8b-instruct', 'accounts/fireworks/models/mixtral-8x7b-instruct']
  },
  perplexity: {
    validation: 'sonar',
    production: 'sonar-pro',
    fallback: 'sonar',
    chain: ['sonar']
  },
  lepton: {
    validation: 'llama3-8b',
    production: 'llama3-70b',
    fallback: 'mistral-7b-instruct',
    chain: ['llama3-8b', 'mistral-7b-instruct']
  },
  cohere: {
    validation: 'command-r',
    production: 'command-r-plus',
    fallback: 'command',
    chain: ['command-r', 'command']
  },
  xai: {
    validation: 'grok-beta',
    production: 'grok-beta',
    fallback: 'grok-beta',
    chain: ['grok-beta']
  },
  replicate: {
    validation: 'meta/llama-2-7b-chat',
    production: 'meta/llama-2-70b-chat',
    fallback: 'meta/meta-llama-3-8b-instruct',
    chain: ['meta/llama-2-7b-chat', 'meta/meta-llama-3-8b-instruct']
  },
  anyscale: {
    validation: 'mistralai/Mistral-7B-Instruct-v0.1',
    production: 'meta-llama/Meta-Llama-3-70B-Instruct',
    fallback: 'mistralai/Mistral-7B-Instruct-v0.1',
    chain: ['mistralai/Mistral-7B-Instruct-v0.1']
  },
  upstage: {
    validation: 'solar-pro',
    production: 'solar-pro',
    fallback: 'solar-pro',
    chain: ['solar-pro']
  },
  ai21: {
    validation: 'jamba-1.5-mini',
    production: 'jamba-1.5-large',
    fallback: 'jamba-1.5-mini',
    chain: ['jamba-1.5-mini']
  },
  workers: {
    validation: '@cf/meta/llama-3-8b-instruct',
    production: '@cf/meta/llama-3-8b-instruct',
    fallback: '@cf/meta/llama-3-8b-instruct',
    chain: ['@cf/meta/llama-3-8b-instruct']
  },
  openrouter: {
    validation: 'openai/gpt-4o-mini',
    production: 'anthropic/claude-sonnet-4-20250514',
    fallback: 'google/gemini-2.0-flash-001',
    chain: ['openai/gpt-4o-mini', 'google/gemini-2.0-flash-001']
  },
  deepinfra: {
    validation: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
    production: 'meta-llama/Meta-Llama-3.1-70B-Instruct',
    fallback: 'microsoft/WizardLM-2-7B',
    chain: ['mistralai/Mixtral-8x7B-Instruct-v0.1', 'meta-llama/Meta-Llama-3.1-8B-Instruct', 'microsoft/WizardLM-2-7B']
  },
  nvidia: {
    validation: 'meta/llama-3.1-8b-instruct',
    production: 'nvidia/llama-3.1-nemotron-70b-instruct',
    fallback: 'meta/llama-3.1-8b-instruct',
    chain: ['meta/llama-3.1-8b-instruct', 'nvidia/llama-3.1-nemotron-70b-instruct', 'meta/llama-3.1-70b-instruct']
  },
  ollama: {
    validation: 'llama3',
    production: 'llama3',
    fallback: 'llama3',
    chain: ['llama3']
  },
  lmstudio: {
    validation: 'local-model',
    production: 'local-model',
    fallback: 'local-model',
    chain: ['local-model']
  },
  vllm: {
    validation: 'meta-llama/Meta-Llama-3.1-8B-Instruct',
    production: 'meta-llama/Llama-3-70b',
    fallback: 'meta-llama/Meta-Llama-3.1-8B-Instruct',
    chain: ['meta-llama/Meta-Llama-3.1-8B-Instruct']
  },
  default: {
    validation: 'gpt-4o-mini',
    production: 'gpt-4o-mini',
    fallback: 'gpt-4o-mini',
    chain: ['gpt-4o-mini']
  }
};

/**
 * Get the best model for a specific purpose
 */
export function getRegistryModel(provider, tier = 'production') {
  const p = MODEL_REGISTRY[provider] || MODEL_REGISTRY.default;
  return p[tier] || p.production;
}

/**
 * Attempt to fix common model ID typos
 */
export function suggestCorrectModel(provider, failedModel) {
  const p = MODEL_REGISTRY[provider];
  if (!p) return null;

  const low = (failedModel || '').toLowerCase();
  const currentProduction = p.production.toLowerCase();
  
  // If the failed model IS the production model, suggest the validation (safe) one
  if (low === currentProduction || low === p.production.toLowerCase()) {
    return p.validation;
  }

  // Rule-based suggestions
  if (low.includes('70b')) {
    return p.production; 
  }
  
  if (low.includes('8b') || low.includes('mini') || low.includes('flash')) {
    return p.validation;
  }

  // Default fallback suggestion (the safe one)
  return p.validation;
}
