import mongoose from 'mongoose';

/**
 * A step-through visualization of one program, tied to the chat session (and,
 * when it came from a code block in an answer, the message) it belongs to.
 * One per user + session + message + program: running the same code again
 * updates the saved one instead of adding a copy.
 */
const followUpSchema = new mongoose.Schema({
  step: { type: Number, required: true },
  question: { type: String, maxlength: 1000, default: '' },
  answer: { type: String, maxlength: 6000, required: true },
  createdAt: { type: Date, default: Date.now },
}, { _id: false });

const codeVisualizationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  sessionId: { type: String, required: true, maxlength: 100 },
  messageId: { type: String, default: null, maxlength: 100 },
  language: { type: String, enum: ['python', 'javascript', 'java', 'cpp', 'c'], required: true },
  sourceHash: { type: String, required: true, maxlength: 64 },
  title: { type: String, maxlength: 200, default: 'Code walkthrough' },
  source: { type: String, required: true, maxlength: 20000 },
  stdin: { type: String, default: '', maxlength: 10000 },
  mode: { type: String, enum: ['traced', 'instrumented', 'simulated'], required: true },
  stepCount: { type: Number, default: 0 },
  trace: { type: mongoose.Schema.Types.Mixed, required: true },
  followUps: { type: [followUpSchema], default: [] },
}, { timestamps: true, minimize: false });

codeVisualizationSchema.index({ userId: 1, sessionId: 1, messageId: 1, sourceHash: 1 }, { unique: true });
codeVisualizationSchema.index({ userId: 1, sessionId: 1, updatedAt: -1 });

const CodeVisualization = mongoose.models.CodeVisualization || mongoose.model('CodeVisualization', codeVisualizationSchema);
export default CodeVisualization;
