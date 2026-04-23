/**
 * API Key Validator
 * 
 * Makes lightweight test requests to verify API keys are valid before storing.
 * Each provider has a minimal test that uses ~1 token.
 */

const TIMEOUT_MS = 15000;

/**
 * Validate an API key by making a minimal test request
 * @param {string} provider - 'openai' | 'google' | 'anthropic' | 'deepseek' | 'custom'
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
      case 'openrouter':
        return await testOpenRouter(apiKey, model || 'anthropic/claude-3.5-sonnet', start);
      case 'groq':
        return await testGroq(apiKey, model || 'llama-3.3-70b-versatile', start);
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

async function testOpenRouter(apiKey, model, start) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://tutorboard.app',
        'X-Title': 'TutorBoard',
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
    
    if (res.status === 401) return { valid: false, error: 'The OpenRouter key you entered is not valid.', latencyMs };
    if (res.status === 402) return { valid: false, error: 'Your OpenRouter account has run out of credits.', latencyMs };
    return { valid: false, error: `OpenRouter error: ${errMsg}`, latencyMs };
  } finally {
    clearTimeout(timeout);
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
    const errMsg = body?.error?.message || 'Unknown error';
    
    if (res.status === 401) return { valid: false, error: 'The OpenAI key you entered is not valid.', latencyMs };
    if (res.status === 402) return { valid: false, error: 'Your OpenAI account has run out of credits.', latencyMs };
    if (res.status === 429) return { valid: false, error: 'OpenAI is currently busy or you’ve hit a limit. Try again in a minute.', latencyMs };
    return { valid: false, error: `OpenAI error: ${errMsg}`, latencyMs };
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

  const tryRequest = async (modelId) => {
    return await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 1,
      }),
      signal: controller.signal,
    });
  };

  try {
    // Attempt 1: Raw model ID
    let res = await tryRequest(model);
    
    // Attempt 2: Prefixed model ID (fallback on 404)
    if (res.status === 404 && !model.startsWith('models/')) {
      res = await tryRequest(`models/${model}`);
    }

    clearTimeout(timeout);
    const latencyMs = Date.now() - start;

    if (res.ok) return { valid: true, latencyMs };

    const body = await res.json().catch(() => ({}));
    const errMsg = body?.error?.message || `HTTP ${res.status}`;
    
    if (res.status === 400 && errMsg.includes('API key')) return { valid: false, error: 'The Google API key you entered is not valid.', latencyMs };
    if (res.status === 403) return { valid: false, error: 'This Google API key doesn’t have permission to use this model.', latencyMs };
    if (res.status === 404) return { valid: false, error: 'We couldn’t find this model. Please check if it’s enabled in your Google AI Studio.', latencyMs };
    if (res.status === 429) return { valid: false, error: 'Your Google free requests have run out for now. Please wait a moment or upgrade your plan.', latencyMs };
    return { valid: false, error: `Google error: ${errMsg}`, latencyMs };
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
    
    if (res.status === 401) return { valid: false, error: 'The Anthropic key you entered is not valid.', latencyMs };
    if (res.status === 429) return { valid: false, error: 'Anthropic is currently busy. Please wait a moment and try again.', latencyMs };
    return { valid: false, error: `Anthropic error: ${errMsg}`, latencyMs };
  } finally {
    clearTimeout(timeout);
  }
}

async function testCustom(apiKey, model, baseUrl, start) {
  if (!baseUrl) return { valid: false, error: 'Base URL is required for custom providers', latencyMs: 0 };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    // URL Normalization: Ensure we have the correct chat/completions endpoint
    let url = baseUrl.replace(/\/+$/, '');
    if (!url.toLowerCase().endsWith('/chat/completions') && !url.toLowerCase().endsWith('/completions')) {
      url += '/chat/completions';
    }
    
    console.log(`[Validator:Custom] Testing endpoint: ${url}`);

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': apiKey.startsWith('Bearer ') ? apiKey : `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model || 'gpt-3.5-turbo', // Use a common fallback model for testing if not specified
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 1,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    const latencyMs = Date.now() - start;

    if (res.ok) return { valid: true, latencyMs };
    
    // Detailed error hints
    if (res.status === 404) return { valid: false, error: 'AI service not found at this address. Check your Base URL.', latencyMs };
    if (res.status === 401) return { valid: false, error: 'The API key was rejected by the service.', latencyMs };
    if (res.status === 405) return { valid: false, error: 'This address does not support AI requests (Method Not Allowed).', latencyMs };
    if (res.status === 400) return { valid: false, error: 'Bad request. Check if the "Model ID" is correct for this service.', latencyMs };
    
    return { valid: false, error: `Service error (HTTP ${res.status})`, latencyMs };
  } catch (err) {
    if (err.name === 'AbortError') return { valid: false, error: 'Connection timed out. The URL might be wrong or slow.', latencyMs: Date.now() - start };
    return { valid: false, error: `Connection failed: ${err.message}`, latencyMs: Date.now() - start };
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
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', tier: 'premium', contextWindow: 1000000 },
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', tier: 'standard', contextWindow: 1000000 },
    { id: 'gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash Lite', tier: 'economy', contextWindow: 1000000 },
  ],
  anthropic: [
    { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', tier: 'premium', contextWindow: 200000 },
    { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', tier: 'standard', contextWindow: 200000 },
    { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', tier: 'economy', contextWindow: 200000 },
  ],
  openrouter: [
    { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', tier: 'premium', contextWindow: 200000 },
    { id: 'google/gemini-2.0-flash-001', name: 'Gemini 2.0 Flash', tier: 'standard', contextWindow: 1000000 },
    { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1', tier: 'premium', contextWindow: 64000 },
  ],
  groq: [
    { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', tier: 'premium', contextWindow: 128000 },
    { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B', tier: 'standard', contextWindow: 128000 },
    { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', tier: 'standard', contextWindow: 32000 },
  ],
  custom: [],
};

async function testGroq(apiKey, model, start) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
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
    const errMsg = body?.error?.message || 'Unknown error';
    
    if (res.status === 401) return { valid: false, error: 'The Groq key you entered is not valid.', latencyMs };
    if (res.status === 413) return { valid: false, error: 'Request too large for Groq.', latencyMs };
    if (res.status === 429) return { valid: false, error: 'Groq is currently busy. Please wait a moment.', latencyMs };
    return { valid: false, error: `Groq error: ${errMsg}`, latencyMs };
  } finally {
    clearTimeout(timeout);
  }
}
