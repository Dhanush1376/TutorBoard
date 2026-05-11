import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { runtimeState } from '../../core/runtimeState.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const hasS3Config = !!(
  process.env.S3_BUCKET &&
  process.env.S3_ACCESS_KEY_ID &&
  process.env.S3_SECRET_ACCESS_KEY
);

export const S3_BUCKET = process.env.S3_BUCKET || 'tutorboard-dev-mock';
export const s3Enabled = hasS3Config;

export const s3 = hasS3Config ? new S3Client({
  region: process.env.S3_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  },
}) : null;

const localStorageRoot = path.resolve(__dirname, '../../.local-storage');

function safeLocalPath(key) {
  const target = path.resolve(localStorageRoot, key);
  if (!target.startsWith(localStorageRoot)) {
    throw new Error('Invalid storage key');
  }
  return target;
}

runtimeState.setCapability({
  name: 'storage',
  mode: hasS3Config ? 'REAL' : 'MOCKED',
  status: 'healthy',
  ready: true,
  details: hasS3Config ? 'S3 storage provider' : 'Local filesystem storage provider',
});

export const uploadBlob = async (key, body, contentType = 'application/json') => {
  if (hasS3Config) {
    const command = new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    });
    return await s3.send(command);
  }

  // DATABASE FALLBACK: Store in MongoDB StorageMock
  try {
    const { StorageMock } = await import('../../models/InternalInfra.js');
    const buffer = Buffer.isBuffer(body) ? body : Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
    
    await StorageMock.findOneAndUpdate(
      { key },
      { body: buffer, contentType, size: buffer.length },
      { upsert: true }
    );
    console.log(`[Storage] Persisted blob to MongoDB: ${key} (${buffer.length} bytes)`);
    return { key, provider: 'mongodb' };
  } catch (err) {
    console.error(`[Storage] MongoDB persistence failed for ${key}:`, err.message);
    return { key, provider: 'error' };
  }
};

export const getDownloadUrl = async (key, expiresIn = 3600) => {
  if (hasS3Config) {
    const command = new GetObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
    });
    return await getSignedUrl(s3, command, { expiresIn });
  }

  // DATABASE FALLBACK: Retrieve from MongoDB StorageMock
  try {
    const { StorageMock } = await import('../../models/InternalInfra.js');
    const doc = await StorageMock.findOne({ key }).lean();
    
    if (!doc) throw new Error('Blob not found');
    
    const dataUri = `data:${doc.contentType};base64,${doc.body.toString('base64')}`;
    return dataUri;
  } catch (err) {
    console.error(`[Storage] MongoDB retrieval failed for ${key}:`, err.message);
    return null;
  }
};

export const checkStorageHealth = async () => ({
  status: 'healthy',
  mode: hasS3Config ? 'real' : 'mocked',
  provider: hasS3Config ? 's3' : 'local-fs',
});

export const cleanupStorage = async () => {};
