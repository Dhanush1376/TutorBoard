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
    type: Object, // Store the serialized canvas objects
    default: [],
  },
  preferences: {
    type: Object, // Store tool settings (colors, sizes, grid prefs)
    default: {},
  },
  lastUpdated: {
    type: Date,
    default: Date.now,
  },
}, { timestamps: true });

const ChatSession = mongoose.model('ChatSession', chatSessionSchema);

export default ChatSession;
