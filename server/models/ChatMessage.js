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
  guestId: {
    type: String,
    required: false,
    index: true,
  },
  role: {
    type: String,
    enum: ['user', 'assistant', 'system'],
    required: true,
  },
  // User input is capped at 10k by the API schema; assistant answers (lessons,
  // code walkthroughs) are routinely longer, and a 10k cap here made every
  // long answer fail to save after it had fully streamed.
  content: {
    type: String,
    required: true,
    maxlength: [200000, 'Message content cannot exceed 200000 characters'],
  },
  /**
   * Lifecycle of the message. Only `completed` messages are real answers:
   * `cancelled` keeps the partial text the learner saw before pressing Stop.
   * Old documents have no status and are treated as completed.
   */
  status: {
    type: String,
    enum: ['completed', 'failed', 'cancelled'],
    default: 'completed',
  },
  /** Client request (idempotency key) that produced this message. */
  requestId: {
    type: String,
    default: undefined,
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
    activeVersionIndex: { type: Number, default: 0 },
    // Generation output the chat card and history reload read back. These were
    // written by ChatService but silently dropped by strict mode, so a refreshed
    // conversation lost its visuals.
    visuals: { type: mongoose.Schema.Types.Mixed, default: undefined },
    narration: { type: mongoose.Schema.Types.Mixed, default: undefined },
    plan: { type: mongoose.Schema.Types.Mixed, default: undefined },
    orchestration: { type: mongoose.Schema.Types.Mixed, default: undefined },
    model: { type: String, default: undefined },
  },
}, { timestamps: true });

// Optimize for fetching session history
chatMessageSchema.index({ sessionId: 1, timestamp: 1 });
chatMessageSchema.index({ sessionId: 1, timestamp: -1, _id: -1 });
chatMessageSchema.index({ sessionId: 1, guestId: 1 });
chatMessageSchema.index({ sessionId: 1, role: 1, timestamp: -1 });
// One user message and one assistant message per request: a retried or
// duplicated submission can never insert a second copy.
chatMessageSchema.index(
  { sessionId: 1, requestId: 1, role: 1 },
  { unique: true, partialFilterExpression: { requestId: { $type: 'string' } } }
);

const ChatMessage = mongoose.model('ChatMessage', chatMessageSchema);

export default ChatMessage;
