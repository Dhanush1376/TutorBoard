import mongoose from 'mongoose';

const chatMessageSchema = new mongoose.Schema({
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChatSession',
    required: true,
    index: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false,
    index: true,
  },
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
  canvasType: {
    type: String,
    default: null,
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
    searchPerformed: { type: Boolean, default: false },
    artifactId: { type: String, default: null },
    artifactData: { type: mongoose.Schema.Types.Mixed, default: null },
    artifactTitle: { type: String, default: null },
    artifactStatus: { type: String, default: null },
    hasVisualArtifact: { type: Boolean, default: false },
    rendererType: { type: String, default: null },
    versions: { type: [mongoose.Schema.Types.Mixed], default: [] },
    activeVersionIndex: { type: Number, default: 0 }
  },
}, { timestamps: true });

// Optimize for fetching session history
chatMessageSchema.index({ sessionId: 1, timestamp: 1 });
chatMessageSchema.index({ sessionId: 1, role: 1, timestamp: -1 });

const ChatMessage = mongoose.model('ChatMessage', chatMessageSchema);

export default ChatMessage;
