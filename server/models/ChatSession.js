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
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

const chatSessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  title: {
    type: String,
    default: 'Untitled Session',
  },
  messages: [messageSchema],
  canvasState: {
    type: [mongoose.Schema.Types.Mixed], // Store the serialized canvas objects array
    default: [],
  },
  preferences: {
    type: Object, // Store tool settings (colors, sizes, grid prefs)
    default: {},
  },
  // ─── Engine State Persistence ───
  topic: {
    type: String,
    default: null,
  },
  steps: {
    type: [mongoose.Schema.Types.Mixed],
    default: [],
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
  },
}, { timestamps: true });

const ChatSession = mongoose.model('ChatSession', chatSessionSchema);

export default ChatSession;
