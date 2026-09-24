/**
 * Universal Model Resolution & Auto-Correction Engine
 * 
 * Maps deprecated models, fixes casing, and provides smart fallbacks
 * to guarantee API availability.
 */

export const MODEL_REGISTRY = {
  openai: {
    validation: 'gpt-4o-mini',
    production: 'gpt-4o',
    fallback: 'gpt-4o-mini',
  },
  anthropic: {
    validation: 'claude-haiku-4-5',
    production: 'claude-sonnet-5',
    fallback: 'claude-haiku-4-5',
  },
  google: {
    validation: 'gemini-3.8-flash',
    production: 'gemini-3.8-flash',
    fallback: 'gemini-3.6-flash',
  },
  groq: {
    validation: 'openai/gpt-oss-20b',
    production: 'openai/gpt-oss-120b',
    fallback: 'openai/gpt-oss-20b',
  },
  together: {
    validation: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
    production: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
    fallback: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
  },
  huggingface: {
    validation: 'TinyLlama/TinyLlama-1.1B-Chat-v1.0',
    production: 'meta-llama/Meta-Llama-3-8B-Instruct',
    fallback: 'google/flan-t5-base',
  },
  deepseek: {
    validation: 'deepseek-chat',
    production: 'deepseek-reasoner',
    fallback: 'deepseek-chat',
  },
  openrouter: {
    validation: 'openai/gpt-4o-mini',
    production: 'google/gemini-3.8-flash',
    fallback: 'openai/gpt-4o-mini',
  },
  ollama: {
    validation: 'llama3',
    production: 'llama3',
    fallback: 'mistral',
  },
  lmstudio: {
    validation: 'local-model',
    production: 'local-model',
    fallback: 'local-model',
  },
  default: {
    validation: 'gemini-3.8-flash',
    production: 'gemini-3.8-flash',
    fallback: 'gemini-3.8-flash',
  }
};

/**
 * Common typo and deprecation mappings
 */
const ALIASES = {
  'llama-3.3-70b-versatile': 'openai/gpt-oss-120b',
  'llama-3.1-8b-instant': 'openai/gpt-oss-20b',
  'llama-3.3-70b': 'openai/gpt-oss-120b',
  'llama-3.1-8b': 'openai/gpt-oss-20b',
  'llama-3-8b-chat-hf': 'meta-llama/Meta-Llama-3-8B-Instruct',
  'llama-3-70b-chat-hf': 'meta-llama/Meta-Llama-3-70B-Instruct',
  'claude-v3-opus': 'claude-opus-4-8',
  'gemini-pro': 'gemini-3.8-flash',
  'gemini-1.5-flash': 'gemini-3.8-flash',
  'gemini-1.5-pro': 'gemini-3.8-flash',
  'gemini-2.0-flash': 'gemini-3.8-flash',
  'gemini-flash-latest': 'gemini-3.8-flash',
  'gemini-pro-latest': 'gemini-3.8-flash',
  'gpt-4-turbo': 'gpt-4-turbo-preview'
};

/**
 * Resolves a requested model to the best available safe model
 * @param {string} provider 
 * @param {string} requestedModel 
 * @param {boolean} isValidation - true if this is just a key test
 * @returns {{ model: string, suggestions: string[], corrected: boolean }}
 */
export function resolveModel(provider, requestedModel, isValidation = false) {
  const registry = MODEL_REGISTRY[provider] || MODEL_REGISTRY.default;
  
  if (!requestedModel) {
    return {
      model: isValidation ? registry.validation : registry.production,
      suggestions: [],
      corrected: true
    };
  }

  let finalModel = requestedModel.trim();
  let corrected = false;
  let suggestions = [];

  // Fix common aliases
  if (ALIASES[finalModel.toLowerCase()]) {
    finalModel = ALIASES[finalModel.toLowerCase()];
    corrected = true;
  }

  // Basic casing fixes for strict providers
  if (provider === 'huggingface' && finalModel.toLowerCase().includes('meta-llama-3')) {
    const fixed = finalModel.replace(/meta-llama-3/i, 'Meta-Llama-3').replace(/instruct/i, 'Instruct');
    if (fixed !== finalModel) {
      finalModel = fixed;
      corrected = true;
    }
  }

  return {
    model: finalModel,
    suggestions: [registry.production, registry.fallback].filter(Boolean),
    corrected
  };
}
