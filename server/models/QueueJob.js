import mongoose from 'mongoose';

const QueueJobSchema = new mongoose.Schema({
  queueName: { type: String, required: true, index: true },
  name: { type: String, required: true },
  data: { type: mongoose.Schema.Types.Mixed },
  status: { 
    type: String, 
    enum: ['waiting', 'active', 'completed', 'failed'], 
    default: 'waiting', 
    index: true 
  },
  attempts: { type: Number, default: 0 },
  maxAttempts: { type: Number, default: 3 },
  runAt: { type: Date, default: Date.now, index: true },
  error: { type: String },
  stack: { type: String }
}, { timestamps: true });

const QueueJob = mongoose.model('QueueJob', QueueJobSchema);
export default QueueJob;
