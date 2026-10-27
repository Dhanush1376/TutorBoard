import mongoose from 'mongoose';

/**
 * A platform-level AI provider configured by an administrator (distinct from
 * the per-user BYO keys on User.apiKeys). The key is AES-256-GCM encrypted with
 * ENCRYPTION_KEY, which lives in the environment, never in the database.
 */
const aiProviderSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 60 },
  // 'openai-compatible' covers any endpoint implementing /chat/completions;
  // the named adapters pin the base URL and known quirks.
  adapter: {
    type: String,
    enum: ['openai-compatible', 'openai', 'google', 'groq', 'openrouter', 'deepseek', 'mistral', 'together'],
    required: true,
  },
  baseUrl: { type: String, required: true },
  encryptedKey: { type: String, required: true },
  iv: { type: String, required: true },
  tag: { type: String, required: true },
  maskedKey: { type: String, default: '' },
  models: [{
    id: { type: String, required: true, maxlength: 200 },
    label: { type: String, default: '' },
    capabilities: { type: [String], default: ['text'] }, // text | stream | vision | json
    enabled: { type: Boolean, default: true },
  }],
  defaultModel: { type: String, required: true },
  priority: { type: Number, default: 100 }, // lower runs first
  timeoutMs: { type: Number, default: 60000, min: 2000, max: 300000 },
  maxRetries: { type: Number, default: 1, min: 0, max: 3 },
  enabled: { type: Boolean, default: false },
  health: {
    status: { type: String, enum: ['unknown', 'healthy', 'degraded', 'failing'], default: 'unknown' },
    checkedAt: { type: Date, default: null },
    latencyMs: { type: Number, default: null },
    lastError: { type: String, default: '' },
  },
  // config the last successful test passed with (no secret), for rollback
  lastKnownGood: { type: mongoose.Schema.Types.Mixed, default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

aiProviderSchema.index({ enabled: 1, priority: 1 });

const AiProvider = mongoose.model('AiProvider', aiProviderSchema);
export default AiProvider;
