import mongoose from 'mongoose';

const versionSchema = new mongoose.Schema({
  content: { type: String, required: true },
  language: { type: String, default: null },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  version: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now },
}, { _id: false });

const artifactSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false,
    index: true,
  },
  sessionId: {
    type: String,
    required: true,
    index: true,
  },
  messageId: {
    type: String,
    default: null,
  },
  type: {
    type: String,
    enum: ['code', 'ui', 'document', 'table', 'diagram'],
    required: true,
  },
  title: {
    type: String,
    required: true,
    maxlength: 200,
  },
  content: {
    type: String,
    required: true,
    maxlength: 100000,
  },
  language: {
    type: String,
    default: null,
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  version: {
    type: Number,
    default: 1,
  },
  versions: {
    type: [versionSchema],
    default: [],
    validate: [
      (val) => val.length <= 50,
      '{PATH} exceeds the limit of 50 versions'
    ],
  },
}, { timestamps: true });

// Compound index for efficient session queries
artifactSchema.index({ sessionId: 1, createdAt: -1 });

// Pre-save: auto-push current state to version history on updates
artifactSchema.pre('save', function () {
  if (this.isNew) {
    // First save — initialize version history with the initial content
    this.versions = [{
      content: this.content,
      language: this.language,
      metadata: this.metadata,
      version: 1,
      createdAt: new Date(),
    }];
  }
});

const Artifact = mongoose.model('Artifact', artifactSchema);

export default Artifact;
