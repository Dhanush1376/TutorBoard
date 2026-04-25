import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters'],
    maxlength: [50, 'Name must be at most 50 characters'],
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
  },
  password: {
    type: String,
    // Password is required for manual signup, but not social
    required: false,
    minlength: [6, 'Password must be at least 6 characters'],
    maxlength: [128, 'Password cannot exceed 128 characters'],
    select: false,
  },
  googleId: {
    type: String,
    unique: true,
    sparse: true, // Allows multiple null/undefined values
  },
  githubId: {
    type: String,
    unique: true,
    sparse: true,
  },
  avatar: {
    type: String, // Store profile photo from social login
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  settings: {
    general: {
      nickname: { type: String, default: '' },
      role: { type: String, default: '' },
      preferences: { type: String, default: '' },
      notifCompletion: { type: Boolean, default: true },
      notifSound: { type: Boolean, default: true }
    },
    appearance: {
      theme: { type: String, default: 'system' },
      showMinimap: { type: Boolean, default: true },
      showGrid: { type: Boolean, default: true },
      layoutView: { type: String, default: 'left' }
    },
    canvas: {
      drawWidth: { type: Number, default: 4 },
      textToolSize: { type: Number, default: 24 },
      gridType: { type: String, default: 'dots' },
      isSnapToGrid: { type: Boolean, default: false },
      noteColor: { type: String, default: '#fef9c3' },
      noteSize: { type: String, default: 'M' }
    },
    privacy: {
      cloudSync: { type: Boolean, default: true },
      localHistory: { type: Boolean, default: true }
    }
  },
  // ── API Key Management ──
  apiKeys: [{
    provider: {
      type: String,
      enum: ['openai', 'deepseek', 'google', 'anthropic', 'openrouter', 'groq', 'custom'],
      required: true,
    },
    encryptedKey: { type: String, required: true },
    iv: { type: String, required: true },
    tag: { type: String, required: true },
    model: { type: String, default: '' },
    label: { type: String, default: '' },
    maskedKey: { type: String, default: '' }, // BUG FIX: Safe masking stored at rest
    baseUrl: { type: String, default: '' }, // For custom providers
    isActive: { type: Boolean, default: true },
    isValid: { type: Boolean, default: false },
    isLowCredits: { type: Boolean, default: false }, // NEW: Status tracking
    isExpired: { type: Boolean, default: false },     // NEW: Status tracking
    lastValidated: { type: Date },
    createdAt: { type: Date, default: Date.now },
  }],
  apiPreferences: {
    useCustomApi: { type: Boolean, default: false },
    fallbackToDefault: { type: Boolean, default: true },
    smartRouting: { type: Boolean, default: false },
    enableRacing: { type: Boolean, default: false },
    enableAdaptive: { type: Boolean, default: false },
    routingMode: { type: String, enum: ['auto', 'manual'], default: 'auto' },
    modelOverride: { type: String, default: '' },
    costControl: {
      monthlyLimitCents: { type: Number, default: 0 }, // 0 = unlimited
      warningThresholdPct: { type: Number, default: 80 },
      hardStop: { type: Boolean, default: true },
    },
  },
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Hash password before saving
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Remove password from JSON output
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

const User = mongoose.model('User', userSchema);

export default User;
