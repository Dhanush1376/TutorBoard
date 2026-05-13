import path from 'path';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
// @ts-ignore
import { s3 } from '../utils/core/s3.js';

export const uploadFile = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  // Generate URL for the uploaded file
  let fileUrl;

  if (req.file.location) {
    // SEC-20: S3 File — Generate a secure, temporary pre-signed URL
    try {
      fileUrl = await getSignedUrl(s3, 
        new GetObjectCommand({ 
          Bucket: process.env.S3_BUCKET, 
          Key: req.file.key 
        }),
        { expiresIn: 900 } // URL valid for 15 minutes (SEC-11: Hardened TTL)
      );
    } catch (err) {
      console.error('[Upload] Failed to generate signed URL:', err);
      return res.status(500).json({ error: 'Failed to generate secure access URL' });
    }
  } else {
    // Local File — Generate a relative path URL
    let baseUrl = process.env.SERVER_URL || process.env.BACKEND_URL;
    if (!baseUrl) {
      const protocol = (req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' || process.env.NODE_ENV === 'production') ? 'https' : 'http';
      baseUrl = `${protocol}://${req.get('host')}`;
    }
    fileUrl = `${baseUrl}/uploads/${req.file.filename}`;
  }

  res.status(200).json({
    message: 'File uploaded successfully',
    url: fileUrl,
    filename: req.file.filename || req.file.key,
    mimetype: req.file.mimetype,
    size: req.file.size
  });
};
