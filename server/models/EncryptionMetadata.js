import mongoose from 'mongoose';

const EncryptionMetadataSchema = new mongoose.Schema({
  resourceId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  iv: {
    type: String,
    required: true
  },
  tag: {
    type: String,
    required: true
  }
}, {
  timestamps: true
});

const EncryptionMetadata = mongoose.model('EncryptionMetadata', EncryptionMetadataSchema);

export default EncryptionMetadata;
