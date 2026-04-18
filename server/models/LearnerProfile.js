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
    of: Number, // 0.0 to 1.0
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
