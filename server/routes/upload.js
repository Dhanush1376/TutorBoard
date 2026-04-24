import express from 'express';
import multer from 'multer';
import path from 'path';
import { uploadFile } from '../controllers/upload.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

// Apply authentication guard to all upload routes
router.use(protect);

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// File filter
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'text/plain'];
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.pdf', '.txt'];
  
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

router.post('/upload', upload.single('file'), uploadFile);

export default router;
