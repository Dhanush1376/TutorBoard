import { fileTypeFromBuffer } from 'file-type';
import fs from 'fs/promises';
import path from 'path';
import { s3, S3_BUCKET } from '../utils/core/s3.js';
import { GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

/**
 * SEC-11 & SEC-18: Magic Byte Validation Middleware
 * Inspects the actual binary content of an uploaded file to prevent MIME spoofing.
 * Supports both local disk and S3 uploads.
 */
export const validateFile = async (req, res, next) => {
  if (!req.file) return next();

  const isS3 = !!req.file.key;
  const fileName = req.file.originalname;
  const fileExt = path.extname(fileName).toLowerCase();
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'text/plain'];
  const textExtensions = ['.txt', '.csv', '.md'];

  try {
    let buffer;
    
    // 1. Get the first chunk of the file
    if (isS3) {
      // SEC-11: Validate S3 uploads by fetching the first 4KB
      const command = new GetObjectCommand({
        Bucket: req.file.bucket || S3_BUCKET,
        Key: req.file.key,
        Range: 'bytes=0-4095'
      });
      const response = await s3.send(command);
      buffer = Buffer.from(await response.Body.transformToByteArray());
    } else {
      const filePath = req.file.path;
      buffer = await fs.readFile(filePath);
    }

    // 2. Text file validation
    if (textExtensions.includes(fileExt)) {
      const isBinary = buffer.slice(0, 2048).some(byte => byte === 0);
      
      if (isBinary) {
        await cleanupFile(req.file);
        console.warn(`[Security] Blocked binary file disguised as text: ${fileName}`);
        return res.status(400).json({ error: 'Security Alert: File content is binary, but extension is text.' });
      }
      return next();
    }

    // 3. Perform magic byte inspection for binary files
    const type = await fileTypeFromBuffer(buffer);

    if (!type || !allowedMimeTypes.includes(type.mime)) {
      await cleanupFile(req.file);
      const detected = type?.mime || 'unknown';
      console.warn(`[Security] Blocked spoofed file upload: ${fileName} (Actual Content: ${detected})`);
      return res.status(400).json({ 
        error: `Security Alert: File content does not match reported type. (Detected: ${detected})` 
      });
    }

    // 4. Double-check that magic bytes match the browser-reported extension
    const isImage = type.mime.startsWith('image/');
    const mimeToExt = {
      'application/pdf': '.pdf',
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': '.png',
      'image/gif': '.gif'
    };

    const expectedExt = mimeToExt[type.mime];
    const isExtMatch = Array.isArray(expectedExt) 
      ? expectedExt.includes(fileExt) 
      : expectedExt === fileExt;

    if (!isExtMatch) {
       await cleanupFile(req.file);
       console.warn(`[Security] Extension mismatch: ${fileName} (Detected: ${type.mime}, Ext: ${fileExt})`);
       return res.status(400).json({ error: 'Security Alert: File extension does not match content type.' });
    }

    next();
  } catch (error) {
    console.error('[FileValidator] Error:', error.message);
    await cleanupFile(req.file);
    res.status(500).json({ error: 'Internal server error during file validation.' });
  }
};

/**
 * Helper to delete invalid files from local disk or S3
 */
async function cleanupFile(file) {
  if (!file) return;
  try {
    if (file.key) {
      await s3.send(new DeleteObjectCommand({
        Bucket: file.bucket || S3_BUCKET,
        Key: file.key
      }));
    } else if (file.path) {
      await fs.unlink(file.path).catch(() => {});
    }
  } catch (err) {
    console.error('[FileValidator] Cleanup failed:', err.message);
  }
}
