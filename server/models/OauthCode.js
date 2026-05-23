import mongoose from 'mongoose';

const OauthCodeSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, index: true },
  token: { type: String, required: true },
  expiresAt: { type: Date, required: true }
}, { timestamps: true });

OauthCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const OauthCode = mongoose.model('OauthCode', OauthCodeSchema);
export default OauthCode;
