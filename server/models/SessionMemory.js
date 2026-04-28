import mongoose from 'mongoose';

const SessionMemorySchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true, 
    index: true 
  },
  sessions: [{
    topic:        String,
    domain:       String,
    keyConcepts:  [String],
    doubts:       [{ question: String, pathway: String }],
    masteryDelta: { type: Map, of: Number }, // topic → delta gained this session
    stepCount:    Number,
    completedAt:  { type: Date, default: Date.now },
  }]
}, { timestamps: true });

// Cap at 10 sessions (gives style detector more signal)
SessionMemorySchema.pre('save', function(next) {
  if (this.sessions && this.sessions.length > 10) {
    this.sessions = this.sessions.slice(-10);
  }
  next();
});

const SessionMemory = mongoose.model('SessionMemory', SessionMemorySchema);
export default SessionMemory;
