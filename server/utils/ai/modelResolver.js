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
    fallback: 'gpt-3.5-turbo',
  },
  anthropic: {
    validation: 'claude-3-haiku-20240307',
    production: 'claude-3-5-sonnet-latest',
    fallback: 'claude-3-haiku-20240307',
  },
  google: {
    validation: 'gemini-1.5-flash',
    production: 'gemini-1.5-flash',
    fallback: 'gemini-1.5-pro',
  },
  groq: {
    validation: 'llama-3.1-8b-instant',
    production: 'llama-3.3-70b-versatile',
    fallback: 'mixtral-8x7b-32768',
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
    validation: 'anthropic/claude-3.5-sonnet',
    production: 'anthropic/claude-3.5-sonnet',
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
    validation: 'gpt-3.5-turbo',
    production: 'gpt-4o',
    fallback: 'gpt-3.5-turbo',
  }
};

/**
 * Common typo and deprecation mappings
 */
const ALIASES = {
  'llama-3-8b-chat-hf': 'meta-llama/Meta-Llama-3-8B-Instruct',
  'llama-3-70b-chat-hf': 'meta-llama/Meta-Llama-3-70B-Instruct',
  'claude-v3-opus': 'claude-3-opus-20240229',
  'gemini-pro': 'gemini-1.5-pro',
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
