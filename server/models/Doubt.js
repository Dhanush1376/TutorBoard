import mongoose from 'mongoose';

const doubtSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  question: {
    type: String,
    required: [true, 'Question is required'],
    trim: true,
  },
  answer: {
    type: String,
    required: [true, 'Answer is required'],
    trim: true,
  },
  stepIndex: {
    type: Number,
    default: 0,
  },
  stepDescription: {
    type: String,
    trim: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Index for faster history retrieval
doubtSchema.index({ user: 1, createdAt: -1 });

const Doubt = mongoose.model('Doubt', doubtSchema);

export default Doubt;
