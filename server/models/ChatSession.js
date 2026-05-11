import mongoose from 'mongoose';
import zlib from 'zlib';
import { s3Enabled, uploadBlob } from '../utils/core/s3.js';

const chatSessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false,
    index: true,
  },
  title: {
    type: String,
    default: 'Untitled Session',
  },
  // DEPRECATED: Messages are now stored in the ChatMessage collection.
  // This embedded array is kept only for backward compatibility during migration.
  // DO NOT write to this field — use ChatMessage.create() or sessionRepository.addMessage() instead.
  messages: {
    type: [mongoose.Schema.Types.Mixed],
    default: [],
    select: false, // MONGO-02: Prevent loading/writing to this deprecated embedded array
  },
  // Note: Messages are now stored in the ChatMessage collection to support infinite history
  // and prevent the 16MB MongoDB document limit.
  canvasState: {
    type: mongoose.Schema.Types.Mixed, // Store the serialized canvas objects array (may be Buffer if compressed)
    default: [],
    validate: [
      (val) => {
        const str = Buffer.isBuffer(val) ? val.toString() : JSON.stringify(val);
        return str.length < 2_000_000; // Increased limit to 2MB since we use compression
      },
      'Canvas state exceeds 2MB limit (pre-compression)'
    ]
  },
  canvasArchive: {
    type: [mongoose.Schema.Types.Mixed], // Store archived canvas objects for large sessions
    default: [],
  },
  canvasSteps: {
    type: [mongoose.Schema.Types.Mixed], // Store pedagogical timeline steps
    default: [],
  },
  canvasVersion: {
    type: Number,
    default: 0,
  },
  preferences: {
    type: Object, // Store tool settings (colors, sizes, grid prefs)
    default: {},
  },
  pinnedNotes: {
    type: [mongoose.Schema.Types.Mixed],
    default: [],
  },
  // ─── Engine State Persistence ───
  topic: {
    type: String,
    default: null,
  },
  currentTopic: {
    type: String,
    default: null,
  },
  explanationMode: {
    type: String,
    enum: ['basic', 'advanced'],
    default: 'basic',
  },
  userIntent: {
    type: String,
    default: null,
  },
  steps: {
    type: [mongoose.Schema.Types.Mixed],
    default: [],
    validate: [
      (val) => val.length <= 50,
      '{PATH} exceeds the limit of 50 steps'
    ]
  },
  currentStepIndex: {
    type: Number,
    default: 0,
  },
  engineSessionId: {
    type: String, // String ID used by sessionStore (socket-abc or api-123)
    default: null,
  },
  lastUpdated: {
    type: Date,
    default: Date.now,
  },
  snapshots: {
    type: [mongoose.Schema.Types.Mixed], // Serialized canvas versions
    default: [],
    validate: [
      (val) => val.length <= 20,
      '{PATH} exceeds the limit of 20 snapshots'
    ]
  },
  // ─── Optimistic Locking ───
  docVersion: {
    type: Number,
    default: 0,
  },
  // ─── Soft Delete ───
  isDeleted: {
    type: Boolean,
    default: false,
    index: true,
  },
  deletedAt: {
    type: Date,
    default: null,
  },
}, { timestamps: true });

/**
 * ─── INFRA-15: Canvas State Compression & S3 Offloading ───
 * Large canvas states (> 50KB) are compressed. 
 * Very large states (> 100KB) are offloaded to S3 if enabled.
 */
chatSessionSchema.pre('save', async function() {
  if (this.isModified('canvasState') && Array.isArray(this.canvasState)) {
    const raw = JSON.stringify(this.canvasState);
    if (raw.length > 512000) {
      throw new Error('canvasState exceeds 500KB limit');
    }
    
    // Enterprise Target: Offload to S3 if large and enabled
    if (s3Enabled && raw.length > 102400) {
      const key = `canvas/${this._id}/${Date.now()}.json`;
      try {
        await uploadBlob(key, raw);
        this.canvasState = { s3Key: key, length: raw.length, offloaded: true };
        this.markModified('canvasState');
        console.log(`[ChatSession] ☁️ Offloaded large canvasState to S3: ${key}`);
        return;
      } catch (err) {
        console.error('[ChatSession] S3 offload failed, falling back to compression:', err);
      }
    }

    if (raw.length > 51200) { // 50KB threshold
      try {
        const compressed = zlib.gzipSync(raw);
        this.canvasState = compressed;
        this.markModified('canvasState');
        console.log(`[ChatSession] 🧊 Compressed canvasState for ${this._id} (${raw.length} -> ${compressed.length})`);
      } catch (err) {
        console.error('[ChatSession] Compression failed:', err);
      }
    }
  }
});

/**
 * ─── Optimistic Locking Support ───
 * Increment docVersion on every update to detect concurrent modifications.
 */
chatSessionSchema.pre('save', function() {
  if (this.isModified()) {
    this.docVersion = (this.docVersion || 0) + 1;
  }
});

chatSessionSchema.post('init', function(doc) {
  if (Buffer.isBuffer(doc.canvasState)) {
    try {
      const decompressed = zlib.gunzipSync(doc.canvasState).toString();
      doc.canvasState = JSON.parse(decompressed);
    } catch (err) {
      console.error('[ChatSession] Decompression failed:', err);
    }
  }
});

chatSessionSchema.index({ userId: 1, createdAt: -1 });
chatSessionSchema.index({ engineSessionId: 1 }, { unique: true, sparse: true });
chatSessionSchema.index({ lastUpdated: 1 }, { expireAfterSeconds: 90 * 24 * 3600 });

// INFRA-12: Cap messages at 200 entries and ledger at 50 entries with TTL eviction.
chatSessionSchema.pre('validate', function() {
  // SEC-BLOAT: Cap canvasState to prevent massive document growth
  // Limit to 1000 objects which is plenty for a complex educational scene.
  // DL-06: Archive rather than delete to prevent losing foundational objects.
  if (this.canvasState && Array.isArray(this.canvasState) && this.canvasState.length > 1000) {
    console.warn(`[ChatSession] 📏 Archiving canvasState for ${this._id} (${this.canvasState.length} -> 1000)`);
    const toArchive = this.canvasState.slice(0, this.canvasState.length - 1000);
    this.canvasArchive = [...(this.canvasArchive || []), ...toArchive].slice(-5000); // Hard cap archive at 5k
    this.canvasState = this.canvasState.slice(-1000);
  }
  
  if (this.snapshots && this.snapshots.length > 20) {
    console.warn(`[ChatSession] 📏 Capping snapshots for ${this._id} (${this.snapshots.length} -> 20)`);
    this.snapshots = this.snapshots.slice(-20);
  }

  if (this.canvasSteps && this.canvasSteps.length > 50) {
    console.warn(`[ChatSession] 📏 Capping canvasSteps for ${this._id} (${this.canvasSteps.length} -> 50)`);
    this.canvasSteps = this.canvasSteps.slice(-50);
  }


  // NOTE: messages array no longer capped here — messages are persisted to ChatMessage collection
});

/**
 * Resolves the canvas state, whether it's stored in MongoDB (compressed) or S3 (offloaded).
 * Fulfills Enterprise Architecture Target for Session Storage.
 */
chatSessionSchema.methods.resolveCanvasState = async function() {
  if (!this.canvasState) return [];

  // 1. Handle S3 Offloading
  if (this.canvasState.offloaded && this.canvasState.s3Key) {
    try {
      const { getDownloadUrl } = await import('../utils/core/s3.js');
      const url = await getDownloadUrl(this.canvasState.s3Key);
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to fetch from S3: ${response.statusText}`);
      return await response.json();
    } catch (err) {
      console.error('[ChatSession] S3 resolution failed:', err.message);
      return []; // Return empty or handle as needed
    }
  }

  // 2. Handle MongoDB Compression
  if (Buffer.isBuffer(this.canvasState)) {
    try {
      const decompressed = zlib.gunzipSync(this.canvasState).toString();
      return JSON.parse(decompressed);
    } catch (err) {
      console.error('[ChatSession] Decompression failed:', err.message);
      return [];
    }
  }

  // 3. Fallback: Array (direct storage)
  return Array.isArray(this.canvasState) ? this.canvasState : [];
};

const ChatSession = mongoose.model('ChatSession', chatSessionSchema);

export default ChatSession;
