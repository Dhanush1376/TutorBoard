import mongoose from 'mongoose';

const LearnerProfileSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  topicsMastery: {
    type: Map,
    of: new mongoose.Schema({
      mastery:           { type: Number, default: 0 },     // 0.0 to 1.0
      easeFactor:        { type: Number, default: 2.5 },   // SM-2 E-factor
      interval:          { type: Number, default: 1 },     // days until next review
      repetitions:       { type: Number, default: 0 },     // SM-2 n
      lastTaught:        { type: Date },
      reinforcementDue:  { type: Date },
      prerequisites:     [String],                          // concept ids
    }, { _id: false }),
    default: {}
  },
  doubtHistory: [
    {
      topic: String,
      question: String,
      resolved: Boolean,
      confusionScore: Number,
      timestamp: { type: Date, default: Date.now }
    }
  ],
  learningStyle: {
    type: String,
    enum: ['visual', 'textual', 'granular', 'high-level'],
    default: 'visual'
  },
  engagementMetrics: {
    visualStepsCompleted:    { type: Number, default: 0 },
    conceptualDoubtsAsked:   { type: Number, default: 0 },
    avgStepDuration:         { type: Number, default: 0 }, // ms
    styleDetected:           { type: String, enum: ['visual', 'conceptual', 'balanced', 'unknown'], default: 'unknown' },
    styleDetectedAt:         { type: Number, default: 0 }, // totalSessions when detected
  },
  lastSessionDate: {
    type: Date,
    default: Date.now
  },
  totalSessions: {
    type: Number,
    default: 0
  }
}, { timestamps: true });

const LearnerProfile = mongoose.model('LearnerProfile', LearnerProfileSchema);
export default LearnerProfile;
