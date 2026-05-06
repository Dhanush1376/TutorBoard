// ============================================================================
// PROVIDER REGISTRY — Single source of truth for all AI provider definitions
// ============================================================================

export const PROVIDERS = [
  { id: 'google',      name: 'Google Gemini',     color: '#4285f4', price: 0, defaultModel: 'gemini-1.5-flash',                   patterns: [/^AIza/],                                                                 hint: 'AIza...', link: 'https://aistudio.google.com/apikey' },
  { id: 'groq',        name: 'Groq',              color: '#f55036', price: 0, defaultModel: 'llama-3.1-8b-instant',                    patterns: [/^gsk_/],                                                                 hint: 'gsk_...', link: 'https://console.groq.com/keys' },
  { id: 'huggingface', name: 'Hugging Face',      color: '#ff9d00', price: 0, defaultModel: 'mistralai/Mistral-7B-Instruct-v0.2',      patterns: [/^hf_/],                                                                  hint: 'hf_...', link: 'https://huggingface.co/settings/tokens' },
  { id: 'mistral',     name: 'Mistral AI',        color: '#ff7000', price: 0, defaultModel: 'mistral-small-latest',                    patterns: [/^[a-zA-Z0-9]{32}$/, /^[A-Z0-9]{20,}$/],                                 hint: '32-char alphanumeric', link: 'https://console.mistral.ai/api-keys/' },
  { id: 'deepseek',    name: 'DeepSeek',          color: '#4d6cfa', price: 0, defaultModel: 'deepseek-chat',                           patterns: [/^sk-[a-z0-9]{32}$/i],                                                    hint: 'sk-... (32 chars)', link: 'https://platform.deepseek.com/api_keys' },
  { id: 'together',    name: 'Together AI',       color: '#0070f3', price: 0, defaultModel: 'meta-llama/Llama-3.2-3B-Instruct-Turbo', patterns: [/^[a-f0-9]{64}$/],                                                    hint: '64-char hex', link: 'https://api.together.xyz/settings/api-keys' },
  { id: 'cerebras',    name: 'Cerebras',          color: '#34d399', price: 0, defaultModel: 'llama3.1-8b',                             patterns: [/^csk-/],                                                                 hint: 'csk-...', link: 'https://cloud.cerebras.ai/' },
  { id: 'sambanova',   name: 'SambaNova',         color: '#ec4899', price: 0, defaultModel: 'Meta-Llama-3.1-8B-Instruct',            patterns: [/^[a-f0-9-]{36}$/],                                                       hint: 'UUID format', link: 'https://cloud.sambanova.ai/' },
  { id: 'novita',      name: 'Novita AI',         color: '#8b5cf6', price: 0, defaultModel: 'meta-llama/llama-3.1-8b-instruct',      patterns: [/^[a-f0-9-]{36}$/],                                                       hint: 'UUID format', link: 'https://novita.ai/settings/key' },
  { id: 'openai',      name: 'OpenAI',           color: '#10a37f', price: 1, defaultModel: 'gpt-4o-mini',                               patterns: [/^sk-proj-/, /^sk-[A-Za-z0-9]{48,}/],                                    hint: 'sk-proj-... or sk-... (48+ chars)', link: 'https://platform.openai.com/api-keys' },
  { id: 'openrouter',  name: 'OpenRouter',        color: '#6d28d9', price: 1, defaultModel: 'openai/gpt-4o-mini',                      patterns: [/^sk-or-/],                                                               hint: 'sk-or-...', link: 'https://openrouter.ai/keys' },
  { id: 'deepinfra',   name: 'Deep Infra',        color: '#0ea5e9', price: 1, defaultModel: 'mistralai/Mixtral-8x7B-Instruct-v0.1',   patterns: [/^[A-Za-z0-9_-]{24,40}$/],                                                hint: 'alphanumeric token', link: 'https://deepinfra.com/dash/api_keys' },
  { id: 'fireworks',   name: 'Fireworks AI',      color: '#ff4e1a', price: 1, defaultModel: 'accounts/fireworks/models/llama-v3p1-8b-instruct', patterns: [/^fw_/],                                                         hint: 'fw_...', link: 'https://fireworks.ai/account/api-keys' },
  { id: 'perplexity',  name: 'Perplexity',        color: '#20808d', price: 1, defaultModel: 'sonar',                                   patterns: [/^pplx-/],                                                                hint: 'pplx-...', link: 'https://www.perplexity.ai/settings/api' },
  { id: 'lepton',      name: 'Lepton AI',         color: '#3b82f6', price: 1, defaultModel: 'llama3-8b',                               patterns: [/^[A-Za-z0-9]{32}$/],                                                     hint: '32-char token', link: 'https://www.lepton.ai/dashboard' },
  { id: 'anthropic',   name: 'Anthropic',         color: '#d97757', price: 2, defaultModel: 'claude-3-5-haiku-20241022',                 patterns: [/^sk-ant-/],                                                              hint: 'sk-ant-...', link: 'https://console.anthropic.com/settings/keys' },
  { id: 'cohere',      name: 'Cohere',            color: '#39594d', price: 2, defaultModel: 'command-r',                               patterns: [/^[A-Za-z0-9]{40}$/, /^co-/],                                            hint: '40-char or co-...', link: 'https://dashboard.cohere.com/api-keys' },
  { id: 'xai',         name: 'xAI / Grok',        color: '#111111', price: 2, defaultModel: 'grok-beta',                               patterns: [/^xai-/],                                                                 hint: 'xai-...', link: 'https://console.x.ai/' },
  { id: 'replicate',   name: 'Replicate',         color: '#111827', price: 2, defaultModel: 'meta/llama-2-7b-chat',           patterns: [/^r8_/],                                                                  hint: 'r8_...', link: 'https://replicate.com/account/api-tokens' },
  { id: 'voyage',      name: 'Voyage AI',         color: '#0066cc', price: 2, defaultModel: 'voyage-3',                                patterns: [/^pa-/],                                                                  hint: 'pa-...', link: 'https://dashboard.voyageai.com/' },
  { id: 'azure',       name: 'Azure OpenAI',      color: '#0078d4', price: 3, defaultModel: 'gpt-4o',                                  patterns: [/^[a-f0-9]{32}$/, /^[A-Za-z0-9+/]{40}={0,2}$/],                         hint: '32-char hex or base64', link: 'https://portal.azure.com/' },
  { id: 'aws',         name: 'AWS Bedrock',       color: '#ff9900', price: 3, defaultModel: 'anthropic.claude-3-sonnet',               patterns: [/^AKIA/],                                                                 hint: 'AKIA...', link: 'https://console.aws.amazon.com/bedrock/' },
  { id: 'nvidia',      name: 'NVIDIA NIM',        color: '#76b900', price: 3, defaultModel: 'meta/llama-3.1-8b-instruct',              patterns: [/^nvapi-/],                                                               hint: 'nvapi-...', link: 'https://build.nvidia.com/explore' },
  { id: 'anyscale',    name: 'Anyscale',          color: '#00b4d8', price: 3, defaultModel: 'meta/llama-3.1-8b-instruct',     patterns: [/^esecret_/],                                                             hint: 'esecret_...', link: 'https://app.endpoints.anyscale.com/' },
  { id: 'elevenlabs',  name: 'ElevenLabs',        color: '#f5c518', price: 1, defaultModel: 'eleven_turbo_v2',                         patterns: [/^[a-f0-9]{32}$/],                                                        hint: '32-char hex', link: 'https://elevenlabs.io/app/settings/api-keys' },
  { id: 'stability',   name: 'Stability AI',      color: '#7c3aed', price: 1, defaultModel: 'stable-diffusion-xl-1024-v1-0',           patterns: [/^sk-[A-Za-z0-9]{44}$/],                                                  hint: 'sk-... (44 chars)', link: 'https://platform.stability.ai/account/keys' },
  { id: 'fal',         name: 'fal.ai',            color: '#ff4b4b', price: 1, defaultModel: 'fal-ai/flux/schnell',                     patterns: [/^[a-f0-9-]{36}:[a-f0-9]{32}$/],                                          hint: 'key-id:secret', link: 'https://fal.ai/dashboard/keys' },
  { id: 'runpod',      name: 'RunPod',            color: '#673ab7', price: 2, defaultModel: 'serverless',                              patterns: [/^[A-Z0-9]{40}$/],                                                        hint: '40-char token', link: 'https://www.runpod.io/console/user/settings' },
  { id: 'upstage',     name: 'Upstage',           color: '#7c3aed', price: 1, defaultModel: 'solar-pro',                               patterns: [/^up_/],                                                                  hint: 'up_...', link: 'https://console.upstage.ai/' },
  { id: 'ai21',        name: 'AI21 Labs',         color: '#6c3fb5', price: 2, defaultModel: 'jamba-1.5-mini',                          patterns: [/^[a-zA-Z0-9]{28}$/],                                                     hint: '28-char token', link: 'https://studio.ai21.com/account/api-key' },
  { id: 'workers',     name: 'Cloudflare AI',     color: '#f38020', price: 1, defaultModel: '@cf/meta/llama-3-8b-instruct',            patterns: [/^[A-Za-z0-9_-]{40}$/],                                                   hint: '40-char token', link: 'https://dash.cloudflare.com/' },
  { id: 'ollama',      name: 'Ollama (Local)',    color: '#000000', price: 0, defaultModel: 'llama3',                                  patterns: [],                                                                        hint: 'Running locally on :11434', link: 'https://ollama.com/' },
  { id: 'vllm',        name: 'vLLM',              color: '#34d399', price: 0, defaultModel: 'meta-llama/Meta-Llama-3.1-8B-Instruct',   patterns: [],                                                                        hint: 'OpenAI-compatible server', link: 'https://github.com/vllm-project/vllm' },
  { id: 'lmstudio',    name: 'LM Studio',         color: '#8b5cf6', price: 0, defaultModel: 'local-model',                             patterns: [],                                                                        hint: 'Running locally', link: 'https://lmstudio.ai/' },
  { id: 'custom',      name: 'Custom / Other',    color: '#8b5cf6', price: 2, defaultModel: 'llama3',                                  patterns: [],                                                                        hint: 'any provider or local model', needsUrl: true },
];

export const PROVIDER_INFO = PROVIDERS.reduce((acc, p) => {
  acc[p.id] = { 
    ...p, 
    models: p.id === 'openai' ? ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o3-mini'] : [p.defaultModel].filter(Boolean) 
  };
  return acc;
}, {});

export const MODEL_LABELS = {
  'gpt-4o': 'GPT-4o',
  'gpt-4o-mini': 'GPT-4o Mini',
  'gpt-4-turbo': 'GPT-4 Turbo',
  'o3-mini': 'o3-mini (Reasoning)',
  'deepseek-chat': 'DeepSeek V3',
  'deepseek-reasoner': 'DeepSeek R1 (Reasoning)',
  'gemini-1.5-pro': 'Gemini 1.5 Pro',
  'gemini-2.0-flash': 'Gemini 2.0 Flash',
  'gemini-2.0-flash-lite': 'Gemini 2.0 Flash Lite',
  'claude-sonnet-4-20250514': 'Claude Sonnet 4',
  'claude-3-5-haiku-20241022': 'Claude 3.5 Haiku',
  'claude-3-haiku-20240307': 'Claude 3 Haiku',
  'openai/gpt-4o-mini': 'GPT-4o Mini (via OR)',
  'anthropic/claude-3.5-sonnet': 'Claude 3.5 Sonnet (via OR)',
  'google/gemini-2.0-flash-001': 'Gemini 2.0 Flash (via OR)',
  'deepseek/deepseek-r1': 'DeepSeek R1 (via OR)',
  'meta-llama/llama-3.3-70b-instruct': 'Llama 3.3 70B (via OR)',
  'llama-3.3-70b-versatile': 'Llama 3.3 70B (Groq)',
  'llama-3.1-8b-instant': 'Llama 3.1 8B (Groq)',
  'mixtral-8x7b-32768': 'Mixtral 8x7B (Groq)',
  'gemma2-9b-it': 'Gemma 2 9B (Groq)',
};

export const ALL_DEFAULT_MODELS = new Set(PROVIDERS.map(p => p.defaultModel).filter(Boolean));

export function detectProvider(apiKey) {
  if (!apiKey || apiKey.length < 5) return null;
  for (const p of PROVIDERS) {
    if (p.id === 'custom') continue;
    for (const rx of p.patterns) {
      if (rx.test(apiKey)) return p;
    }
  }
  return null;
}
