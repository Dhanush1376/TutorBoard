/**
 * API Key Validator
 * 
 * Makes lightweight test requests to verify API keys are valid before storing.
 * Each provider has a minimal test that uses ~1 token.
 */

const TIMEOUT_MS = 15000;

/**
 * Validate an API key by making a minimal test request
 * @param {string} provider - 'openai' | 'google' | 'anthropic' | 'custom'
 * @param {string} apiKey - The raw API key
 * @param {string} model - The model to test with (optional)
 * @param {string} baseUrl - Custom base URL (for 'custom' provider)
 * @returns {Promise<{ valid: boolean, error?: string, latencyMs: number }>}
 */
export async function validateApiKey(provider, apiKey, model, baseUrl) {
  const start = Date.now();

  try {
    switch (provider) {
      case 'openai':
        return await testOpenAI(apiKey, model || 'gpt-4o-mini', start);
      case 'deepseek':
        return await testDeepSeek(apiKey, model || 'deepseek-chat', start);
      case 'google':
        return await testGoogle(apiKey, model || 'gemini-2.0-flash', start);
      case 'anthropic':
        return await testAnthropic(apiKey, model || 'claude-3-haiku-20240307', start);
      case 'custom':
        return await testCustom(apiKey, model, baseUrl, start);
      default:
        return { valid: false, error: `Unknown provider: ${provider}`, latencyMs: Date.now() - start };
    }
  } catch (err) {
    return {
      valid: false,
      error: err.message || 'Validation failed',
      latencyMs: Date.now() - start,
    };
  }
}

async function testOpenAI(apiKey, model, start) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 1,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    const latencyMs = Date.now() - start;

    if (res.ok) return { valid: true, latencyMs };

    const body = await res.json().catch(() => ({}));
    const errMsg = body?.error?.message || `HTTP ${res.status}`;
    
    if (res.status === 401) return { valid: false, error: 'Invalid API key', latencyMs };
    if (res.status === 429) return { valid: false, error: 'Rate limited — key is valid but throttled', latencyMs };
    if (res.status === 402) return { valid: false, error: 'Insufficient credits', latencyMs };
    return { valid: false, error: errMsg, latencyMs };
  } finally {
    clearTimeout(timeout);
  }
}

async function testDeepSeek(apiKey, model, start) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model || 'deepseek-chat',
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 1,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    const latencyMs = Date.now() - start;

    if (res.ok) return { valid: true, latencyMs };

    const body = await res.json().catch(() => ({}));
    const errMsg = body?.error?.message || `HTTP ${res.status}`;
    
    if (res.status === 401) return { valid: false, error: 'Invalid DeepSeek API key', latencyMs };
    if (res.status === 402) return { valid: false, error: 'Insufficient DeepSeek balance', latencyMs };
    return { valid: false, error: errMsg, latencyMs };
  } finally {
    clearTimeout(timeout);
  }
}

async function testGoogle(apiKey, model, start) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    // Use Google's OpenAI-compatible endpoint
    const res = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 1,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    const latencyMs = Date.now() - start;

    if (res.ok) return { valid: true, latencyMs };

    const body = await res.json().catch(() => ({}));
    const errMsg = body?.error?.message || `HTTP ${res.status}`;
    
    if (res.status === 400 && errMsg.includes('API key')) return { valid: false, error: 'Invalid API key', latencyMs };
    if (res.status === 403) return { valid: false, error: 'Invalid or restricted API key', latencyMs };
    return { valid: false, error: errMsg, latencyMs };
  } finally {
    clearTimeout(timeout);
  }
}

async function testAnthropic(apiKey, model, start) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 1,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    const latencyMs = Date.now() - start;

    if (res.ok) return { valid: true, latencyMs };

    const body = await res.json().catch(() => ({}));
    const errMsg = body?.error?.message || `HTTP ${res.status}`;
    
    if (res.status === 401) return { valid: false, error: 'Invalid API key', latencyMs };
    if (res.status === 429) return { valid: false, error: 'Rate limited — key is valid but throttled', latencyMs };
    return { valid: false, error: errMsg, latencyMs };
  } finally {
    clearTimeout(timeout);
  }
}

async function testCustom(apiKey, model, baseUrl, start) {
  if (!baseUrl) return { valid: false, error: 'Base URL is required for custom providers', latencyMs: 0 };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const url = baseUrl.replace(/\/+$/, '') + '/chat/completions';
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model || 'default',
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 1,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    const latencyMs = Date.now() - start;

    if (res.ok) return { valid: true, latencyMs };
    return { valid: false, error: `Custom endpoint returned HTTP ${res.status}`, latencyMs };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Provider model catalogs for the frontend UI
 */
export const PROVIDER_MODELS = {
  openai: [
    { id: 'gpt-4o', name: 'GPT-4o', tier: 'premium', contextWindow: 128000 },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', tier: 'standard', contextWindow: 128000 },
    { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', tier: 'premium', contextWindow: 128000 },
    { id: 'o3-mini', name: 'o3-mini (Reasoning)', tier: 'premium', contextWindow: 200000 },
  ],
  deepseek: [
    { id: 'deepseek-chat', name: 'DeepSeek V3', tier: 'standard', contextWindow: 128000 },
    { id: 'deepseek-reasoner', name: 'DeepSeek R1', tier: 'premium', contextWindow: 64000 },
  ],
  google: [
    { id: 'gemini-2.5-pro-preview-05-06', name: 'Gemini 2.5 Pro', tier: 'premium', contextWindow: 1000000 },
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', tier: 'standard', contextWindow: 1000000 },
    { id: 'gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash Lite', tier: 'economy', contextWindow: 1000000 },
  ],
  anthropic: [
    { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', tier: 'premium', contextWindow: 200000 },
    { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', tier: 'standard', contextWindow: 200000 },
    { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', tier: 'economy', contextWindow: 200000 },
  ],
  custom: [],
};
