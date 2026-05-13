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
    fallback: 'gpt-3.5-turbo',
    chain: ['gpt-4o-mini', 'gpt-3.5-turbo']
  },
  google: {
    validation: 'gemini-1.5-flash',
    production: 'gemini-1.5-pro',
    fallback: 'gemini-1.5-flash',
    chain: ['gemini-1.5-flash', 'gemini-1.5-pro']
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
  deepseek: {
    validation: 'deepseek-chat',
    production: 'deepseek-chat',
    fallback: 'deepseek-chat',
    chain: ['deepseek-chat']
  },
  openrouter: {
    validation: 'openai/gpt-4o-mini',
    production: 'anthropic/claude-sonnet-4-20250514',
    fallback: 'google/gemini-pro-1.5',
    chain: ['openai/gpt-4o-mini', 'google/gemini-pro-1.5']
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
