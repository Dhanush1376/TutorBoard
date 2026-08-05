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
    validation: 'gemini-flash-latest',
    production: 'gemini-pro-latest',
    fallback: 'gemini-flash-latest',
    chain: ['gemini-flash-latest', 'gemini-pro-latest']
  },
  groq: {
    validation: 'llama-3.1-8b-instant',
    production: 'llama-3.3-70b-versatile',
    fallback: 'llama-3.1-8b-instant',
    chain: ['llama-3.1-8b-instant', 'llama-3.3-70b-versatile']
  },
  anthropic: {
    validation: 'claude-haiku-4-5',
    production: 'claude-sonnet-5',
    fallback: 'claude-haiku-4-5',
    chain: ['claude-haiku-4-5']
  },
  deepseek: {
    validation: 'deepseek-chat',
    production: 'deepseek-chat',
    fallback: 'deepseek-chat',
    chain: ['deepseek-chat']
  },
  openrouter: {
    validation: 'openai/gpt-4o-mini',
    production: 'google/gemini-pro-latest',
    fallback: 'google/gemini-flash-latest',
    chain: ['openai/gpt-4o-mini', 'google/gemini-flash-latest']
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
  
  if (low.includes('70b')) return p.production; 
  if (low.includes('8b') || low.includes('mini') || low.includes('flash')) return p.validation;

  return p.validation;
}
