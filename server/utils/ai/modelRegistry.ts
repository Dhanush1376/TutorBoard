/**
 * modelRegistry.ts — Unified Model Registry v7.0
 * 
 * Single source of truth for model tiers across all providers.
 * Used for validation, production routing, and automatic failovers.
 */

export interface ModelEntry {
  validation: string;
  production: string;
  fallback: string;
  chain: string[];
}

export type ModelRegistry = Record<string, ModelEntry>;

export const MODEL_REGISTRY: ModelRegistry = {
  openai: {
    validation: 'gpt-4o-mini',
    production: 'gpt-4o',
    fallback: 'gpt-4o-mini',
    chain: ['gpt-4o-mini']
  },
  google: {
    validation: 'gemini-3.8-flash',
    production: 'gemini-3.8-flash',
    fallback: 'gemini-3.6-flash',
    chain: ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.6-flash']
  },
  groq: {
    validation: 'openai/gpt-oss-20b',
    production: 'openai/gpt-oss-120b',
    fallback: 'openai/gpt-oss-20b',
    chain: ['openai/gpt-oss-20b', 'openai/gpt-oss-120b', 'qwen/qwen3.8-27b']
  },
  anthropic: {
    validation: 'claude-haiku-4-5',
    production: 'claude-sonnet-5',
    fallback: 'claude-haiku-4-5',
    chain: ['claude-haiku-4-5', 'claude-sonnet-5']
  },
  deepseek: {
    validation: 'deepseek-chat',
    production: 'deepseek-chat',
    fallback: 'deepseek-chat',
    chain: ['deepseek-chat']
  },
  openrouter: {
    validation: 'openai/gpt-4o-mini',
    production: 'google/gemini-3.8-flash',
    fallback: 'openai/gpt-4o-mini',
    chain: ['openai/gpt-4o-mini', 'google/gemini-3.8-flash', 'anthropic/claude-sonnet-5']
  },
  default: {
    validation: 'gemini-3.8-flash',
    production: 'gemini-3.8-flash',
    fallback: 'gemini-3.8-flash',
    chain: ['gemini-3.8-flash']
  }
};

/**
 * Get the best model for a specific purpose
 */
export function getRegistryModel(provider: string, tier: keyof Omit<ModelEntry, 'chain'> = 'production'): string {
  const p = MODEL_REGISTRY[provider] || MODEL_REGISTRY.default;
  return p[tier] || p.production;
}

/**
 * Attempt to fix common model ID typos
 */
export function suggestCorrectModel(provider: string, failedModel: string): string {
  const p = MODEL_REGISTRY[provider];
  if (!p) return MODEL_REGISTRY.default.validation;

  const low = (failedModel || '').toLowerCase();
  
  if (provider === 'groq') {
    if (low.includes('120b') || low.includes('70b') || low.includes('versatile')) return p.production;
    return p.validation;
  }
  if (provider === 'google') {
    return p.validation;
  }
  if (low.includes('70b') || low.includes('120b')) return p.production; 
  if (low.includes('8b') || low.includes('20b') || low.includes('mini') || low.includes('flash')) return p.validation;

  return p.validation;
}
