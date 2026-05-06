import { fileTypeFromFile } from 'file-type';
import fs from 'fs/promises';
import path from 'path';

/**
 * SEC-18: Magic Byte Validation Middleware
 * Inspects the actual binary content of an uploaded file to prevent MIME spoofing.
 */
export const validateFile = async (req, res, next) => {
  if (!req.file) return next();

  const filePath = req.file.path;
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
  const textExtensions = ['.txt', '.csv', '.md'];

  try {
    const fileExt = path.extname(req.file.originalname).toLowerCase();

    // 1. Skip magic byte check for plain text files (they don't have consistent magic bytes)
    if (textExtensions.includes(fileExt)) {
      // Basic sanity check: read first 2KB to ensure it doesn't contain null bytes or suspicious binary sequences
      const buffer = await fs.readFile(filePath);
      const isBinary = buffer.slice(0, 2048).some(byte => byte === 0);
      
      if (isBinary) {
        await fs.unlink(filePath).catch(() => {});
        console.warn(`[Security] Blocked binary file disguised as text: ${req.file.originalname}`);
        return res.status(400).json({ error: 'Security Alert: File content is binary, but extension is text.' });
      }
      return next();
    }

    // 2. Perform magic byte inspection for binary files
    const type = await fileTypeFromFile(filePath);

    if (!type || !allowedMimeTypes.includes(type.mime)) {
      // SEC-18: Reject spoofed or unsupported files
      await fs.unlink(filePath).catch(() => {}); // Cleanup
      const detected = type?.mime || 'unknown';
      console.warn(`[Security] Blocked spoofed file upload: ${req.file.originalname} (Actual Content: ${detected})`);
      return res.status(400).json({ 
        error: `Security Alert: File content does not match reported type. (Detected: ${detected})` 
      });
    }

    // 3. Double-check that magic bytes match the browser-reported extension
    // e.g., if content is PDF but extension is JPG, reject.
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
       await fs.unlink(filePath).catch(() => {});
       console.warn(`[Security] Extension mismatch: ${req.file.originalname} (Detected: ${type.mime}, Ext: ${fileExt})`);
       return res.status(400).json({ error: 'Security Alert: File extension does not match content type.' });
    }

    next();
  } catch (error) {
    console.error('[FileValidator] Error:', error.message);
    // Cleanup on error to be safe
    await fs.unlink(filePath).catch(() => {});
    res.status(500).json({ error: 'Internal server error during file validation.' });
  }
};
