import mongoose from 'mongoose';

const versionSchema = new mongoose.Schema({
  content: { type: String, required: true },
  sceneGraph: { type: mongoose.Schema.Types.Mixed, default: null },
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
  guestId: {
    type: String,
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
    enum: ['code', 'ui', 'document', 'table', 'diagram', 'visual', 'interactive'],
    required: true,
  },
  artifactClass: {
    type: String,
    enum: [
      'flowchart', 'system_architecture', 'mindmap', 'timeline',
      'kanban', 'erd', 'uml', 'infographic', 'wireframe',
      'chart', 'table', 'whiteboard', 'roadmap', 'network',
      'tree', 'concept_map', 'presentation', 'dashboard',
      'code', 'document', 'ui_mockup'
    ],
    default: null,
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
  sceneGraph: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  language: {
    type: String,
    default: null,
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  editHistory: {
    type: [{
      instruction: String,
      patchApplied: mongoose.Schema.Types.Mixed,
      previousVersion: Number,
      timestamp: { type: Date, default: Date.now },
    }],
    default: [],
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
  isDeleted: {
    type: Boolean,
    default: false,
    index: true,
  },
  // Where the owner last was in this lesson (the step they last viewed, not the
  // last one they finished, and the sliders as they left them). `savedAt` is the client's clock at the change: an
  // older save arriving late never overwrites a newer one (other tab / device).
  lessonProgress: {
    type: new mongoose.Schema({
      step: { type: Number, min: 0, required: true },
      totalSteps: { type: Number, min: 1, required: true },
      completed: { type: Boolean, default: false },
      version: { type: Number, default: 1 },
      savedAt: { type: Number, required: true },
      // slider values (Engine v2 lesson parameters) the owner left the lesson at
      params: { type: Map, of: Number, default: undefined },
      updatedAt: { type: Date, default: Date.now },
    }, { _id: false }),
    default: null,
  },
}, { timestamps: true });

// Compound index for efficient session and owner queries
artifactSchema.index({ sessionId: 1, createdAt: -1 });
artifactSchema.index({ userId: 1, createdAt: -1 });
artifactSchema.index({ guestId: 1, createdAt: -1 });

// Pre-save: auto-push current state to version history on updates
artifactSchema.pre('save', function () {
  if (this.isNew) {
    // First save — initialize version history with the initial content
    this.versions = [{
      content: this.content,
      sceneGraph: this.sceneGraph,
      language: this.language,
      metadata: this.metadata,
      version: 1,
      createdAt: new Date(),
    }];
  } else if (!this.isModified('versions') && (this.isModified('content') || this.isModified('sceneGraph'))) {
    const latestVersion = this.versions[this.versions.length - 1]?.version || 0;
    const newVersionNumber = latestVersion + 1;
    this.version = newVersionNumber;
    this.versions.push({
      content: this.content,
      sceneGraph: this.sceneGraph,
      language: this.language,
      metadata: this.metadata,
      version: newVersionNumber,
      createdAt: new Date(),
    });
  }
});

const Artifact = mongoose.model('Artifact', artifactSchema);

export default Artifact;
