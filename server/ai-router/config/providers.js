/**
 * AI Provider Configuration
 * Allows dynamic enabling/disabling and priority management
 */
export const AI_CONFIG = {
  // Priority list for fallbacks (GROQ moved to top as it is the only working provider currently)
  priority: ["groq", "gemini", "openrouter"],
  
  // Global timeout for any single provider request (increased for complex reasoning)
  timeout: 90000, 
  
  // Retry configuration
  maxRetries: 2,

  // Provider-specific settings
  providers: {
    gemini: {
      enabled: true,
      model: "gemini-2.0-flash",
      baseUrl: "https://generativelanguage.googleapis.com"
    },
    groq: {
      enabled: true,
      model: "llama-3.3-70b-versatile",
      baseUrl: "https://api.groq.com/openai/v1"
    },
    openrouter: {
      enabled: true,
      model: "google/gemini-2.0-flash-001",
      baseUrl: "https://openrouter.ai/api/v1"
    },
    huggingface: {
      enabled: true,
      model: "mistralai/Mistral-7B-Instruct-v0.2",
      baseUrl: "https://api-inference.huggingface.co/models/"
    }
  }
};
