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
      // Basic sanity check: ensure it's not actually a binary file reporting as text
      return next();
    }

    // 2. Perform magic byte inspection for binary files
    const type = await fileTypeFromFile(filePath);

    if (!type || !allowedMimeTypes.includes(type.mime)) {
      // SEC-18: Reject spoofed or unsupported files
      await fs.unlink(filePath).catch(() => {}); // Cleanup
      console.warn(`[Security] Blocked spoofed file upload: ${req.file.originalname} (Actual: ${type?.mime || 'unknown'})`);
      return res.status(400).json({ 
        error: `Security Alert: File content does not match reported type. (Detected: ${type?.mime || 'unknown'})` 
      });
    }

    // 3. Double-check that magic bytes match the browser-reported extension
    // e.g., if content is PDF but extension is JPG, reject.
    if (type.mime === 'application/pdf' && fileExt !== '.pdf') {
       await fs.unlink(filePath).catch(() => {});
       return res.status(400).json({ error: 'Security Alert: File extension mismatch.' });
    }

    next();
  } catch (error) {
    console.error('[FileValidator] Error:', error.message);
    // Cleanup on error to be safe
    await fs.unlink(filePath).catch(() => {});
    res.status(500).json({ error: 'Internal server error during file validation.' });
  }
};
