import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import multerS3 from 'multer-s3';
import fs from 'fs';
import { s3, s3Enabled, S3_BUCKET } from '../utils/core/s3.js';
import { uploadFile } from '../controllers/upload.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { validateFile } from '../middleware/fileValidator.js';

const router = express.Router();

// Apply authentication guard to all upload routes
router.use(protect);


// Ensure upload directory is absolute to prevent traversal
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.join(__dirname, '..', 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

// Configure storage (S3 for production/Render, Disk for local development fallback)
const isProd = process.env.NODE_ENV === 'production';
const storage = isProd && s3
  ? multerS3({
      s3: s3,
      bucket: S3_BUCKET,
      acl: 'private',
      // SEC-GDPR: Files are private by default. Access via pre-signed URLs only.
      metadata: (req, file, cb) => {
        cb(null, { fieldName: file.fieldname });
      },
      key: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const safeName = path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, '_');
        cb(null, `uploads/${uniqueSuffix}-${safeName}`);
      }
    })
  : multer.diskStorage({
      destination: (req, file, cb) => {
        if (isProd) {
          return cb(new Error('Local storage is disabled in production. Please configure S3.'));
        }
        cb(null, uploadDir);
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
      }
    });

// File filter
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'text/plain'];
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.pdf', '.txt', '.csv', '.md'];
  
  const fileExt = path.extname(file.originalname).toLowerCase();
  const isMimeOk = allowedMimeTypes.includes(file.mimetype);
  const isExtOk = allowedExtensions.includes(fileExt);

  if (isMimeOk && isExtOk) {
    cb(null, true);
  } else {
    const error = !isExtOk 
      ? `Forbidden extension: ${fileExt}. Allowed: ${allowedExtensions.join(', ')}`
      : `Mismatched MIME type for ${fileExt}. Expected one of ${allowedMimeTypes.join(', ')}`;
    cb(new Error(error), false);
  }
};

const upload = multer({ 
  storage, 
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

router.post('/upload', (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: `Upload error: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ error: err.message });
    }
    next();
  });
}, validateFile, uploadFile);

export default router;
