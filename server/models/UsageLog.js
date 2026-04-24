import mongoose from 'mongoose';

/**
 * UsageLog — Per-request analytics for API usage tracking
 * 
 * Every AI request is logged here for usage dashboards, cost estimation,
 * and smart routing optimization.
 */
const usageLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  provider: {
    type: String,
    enum: [
      'openrouter', 'openai', 'deepseek', 'google', 'anthropic', 'groq', 'custom',
      'mistral', 'cohere', 'together', 'perplexity', 'xai', 'fireworks', 'anyscale',
      'nvidia', 'ai21', 'deepinfra', 'huggingface', 'cerebras', 'sambanova',
      'novita', 'lepton', 'replicate', 'voyage', 'azure', 'aws', 'elevenlabs',
      'stability', 'fal', 'runpod', 'upstage', 'workers', 'ollama', 'vllm', 'lmstudio'
    ],
    required: true,
  },
  model: {
    type: String,
    required: true,
  },
  tokensUsed: {
    type: Number,
    default: 0,
  },
  promptTokens: {
    type: Number,
    default: 0,
  },
  completionTokens: {
    type: Number,
    default: 0,
  },
  responseTimeMs: {
    type: Number,
    default: 0,
  },
  taskType: {
    type: String,
    enum: ['simple_qa', 'coding', 'creative', 'deep_reasoning', 'teaching', 'doubt', 'visualization', 'unknown'],
    default: 'unknown',
  },
  success: {
    type: Boolean,
    default: true,
  },
  errorType: {
    type: String,
    enum: ['none', 'rate_limit', 'invalid_key', 'network', 'timeout', 'quota', 'server_error', 'unknown'],
    default: 'none',
  },
  costEstimate: {
    type: Number, // USD cents (normalized)
    default: 0,
  },
  currency: {
    type: String,
    default: 'USD',
  },
  unit: {
    type: String,
    default: 'cents',
  },
  isCustomKey: {
    type: Boolean,
    default: false,
  },
  wasFallback: {
    type: Boolean,
    default: false,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

// Compound index for efficient per-user queries
usageLogSchema.index({ userId: 1, timestamp: -1 });
usageLogSchema.index({ userId: 1, isCustomKey: 1, timestamp: -1 });
usageLogSchema.index({ userId: 1, provider: 1, timestamp: -1 });

// TTL index: automatically delete logs older than 90 days
usageLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

const UsageLog = mongoose.model('UsageLog', usageLogSchema);

export default UsageLog;
