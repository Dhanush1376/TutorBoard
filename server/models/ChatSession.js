import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ['user', 'assistant', 'system'],
    required: true,
  },
  content: {
    type: String,
    required: true,
    maxlength: [10000, 'Message content cannot exceed 10000 characters'],
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  hasCanvas: {
    type: Boolean,
    default: false,
  },
  canvasSnapshot: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  metadata: {
    edited: { type: Boolean, default: false },
    regenerated: { type: Boolean, default: false },
    feedback: { type: String, enum: ['positive', 'negative', null], default: null },
    thought: { type: String, default: null },
    sources: [{ title: String, url: String, snippet: String }],
    versions: { type: [mongoose.Schema.Types.Mixed], default: [] }, // Array of { text, subsequentMessages }
    activeVersionIndex: { type: Number, default: 0 }
  },
});

const chatSessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false,
    index: true,
  },
  title: {
    type: String,
    default: 'Untitled Session',
  },
  messages: {
    type: [messageSchema],
    validate: [
      (val) => val.length <= 200,
      '{PATH} exceeds the limit of 200 messages to prevent document bloat'
    ]
  },
  canvasState: {
    type: [mongoose.Schema.Types.Mixed], // Store the serialized canvas objects array
    default: [],
  },
  canvasSteps: {
    type: [mongoose.Schema.Types.Mixed], // Store pedagogical timeline steps
    default: [],
  },
  canvasVersion: {
    type: Number,
    default: 0,
  },
  preferences: {
    type: Object, // Store tool settings (colors, sizes, grid prefs)
    default: {},
  },
  pinnedNotes: {
    type: [mongoose.Schema.Types.Mixed],
    default: [],
  },
  // ─── Engine State Persistence ───
  topic: {
    type: String,
    default: null,
  },
  currentTopic: {
    type: String,
    default: null,
  },
  explanationMode: {
    type: String,
    enum: ['basic', 'advanced'],
    default: 'basic',
  },
  userIntent: {
    type: String,
    default: null,
  },
  steps: {
    type: [mongoose.Schema.Types.Mixed],
    default: [],
    validate: [
      (val) => val.length <= 50,
      '{PATH} exceeds the limit of 50 steps'
    ]
  },
  currentStepIndex: {
    type: Number,
    default: 0,
  },
  engineSessionId: {
    type: String, // String ID used by sessionStore (socket-abc or api-123)
    default: null,
    index: true,
  },
  lastUpdated: {
    type: Date,
    default: Date.now,
    index: { expireAfterSeconds: 90 * 24 * 3600 }
  },
  snapshots: {
    type: [mongoose.Schema.Types.Mixed], // Serialized canvas versions
    default: [],
  },
}, { timestamps: true });

// INFRA-12: Cap messages at 200 entries to prevent MongoDB document size limits.
chatSessionSchema.pre('save', function() {
  if (this.messages && this.messages.length > 200) {
    this.messages = this.messages.slice(-200);
  }
});

const ChatSession = mongoose.model('ChatSession', chatSessionSchema);

export default ChatSession;
