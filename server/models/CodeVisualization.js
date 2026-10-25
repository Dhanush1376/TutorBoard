import mongoose from 'mongoose';

/**
 * A step-through visualization of one program, tied to the chat session (and,
 * when it came from a code block in an answer, the message) it belongs to.
 * One per user + session + message + program: running the same code again
 * updates the saved one instead of adding a copy. Changed code or input is a
 * different program (a new sourceHash), so an old trace is never shown for it.
 *
 * Retention: deleted with its chat session, with "wipe cloud data" and with the
 * account; each user keeps their most recent MAX_PER_USER (older ones are
 * pruned when a new one is saved).
 */
export const MAX_PER_USER = 300;
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
  // Who recorded the run: TutorBoard's sandbox (C, C++, Java — signature checked on save)
  // or the learner's own browser (Python, JavaScript — saved as the browser reported it).
  provenance: { type: String, enum: ['sandbox', 'browser'], default: 'browser' },
  // How the run ended: completed | error (compile/runtime/timeout/setup) | truncated (step limit).
  status: { type: String, enum: ['completed', 'error', 'truncated'], default: 'completed' },
  stepCount: { type: Number, default: 0 },
  trace: { type: mongoose.Schema.Types.Mixed, required: true },
  // Where the learner left off, so reopening the walkthrough lands on the same step.
  lastStep: { type: Number, default: 0, min: 0 },
  lastOpenedAt: { type: Date, default: null },
  followUps: { type: [followUpSchema], default: [] },
}, { timestamps: true, minimize: false });

codeVisualizationSchema.index({ userId: 1, sessionId: 1, messageId: 1, sourceHash: 1 }, { unique: true });
codeVisualizationSchema.index({ userId: 1, sessionId: 1, updatedAt: -1 });

const CodeVisualization = mongoose.models.CodeVisualization || mongoose.model('CodeVisualization', codeVisualizationSchema);
export default CodeVisualization;
