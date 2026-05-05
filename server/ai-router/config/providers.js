/**
 * AI Provider Configuration
 * Allows dynamic enabling/disabling and priority management
 */
export const AI_CONFIG = {
  // Priority list for fallbacks
  priority: ["gemini", "groq", "openrouter"],
  
  // Global timeout for any single provider request (increased for complex reasoning)
  timeout: 60000, 
  
  // Retry configuration
  maxRetries: 2,

  // Provider-specific settings
  providers: {
    gemini: {
      enabled: true,
      model: "gemini-1.5-flash",
      baseUrl: "https://generativelanguage.googleapis.com"
    },
    groq: {
      enabled: true,
      model: "llama-3.3-70b-versatile",
      baseUrl: "https://api.groq.com/openai/v1"
    },
    openrouter: {
      enabled: true,
      model: "anthropic/claude-3.5-sonnet",
      baseUrl: "https://openrouter.ai/api/v1"
    },
    huggingface: {
      enabled: true,
      model: "mistralai/Mistral-7B-Instruct-v0.2",
      baseUrl: "https://api-inference.huggingface.co/models/"
    }
  }
};
