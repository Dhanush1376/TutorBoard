import path from 'path';

export const uploadFile = (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  // Generate URL for the uploaded file
  // SEC-20: Use https in production to prevent mixed-content blocks
  let baseUrl = process.env.SERVER_URL || process.env.BACKEND_URL;
  
  if (!baseUrl) {
    const protocol = (req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' || process.env.NODE_ENV === 'production') ? 'https' : 'http';
    baseUrl = `${protocol}://${req.get('host')}`;
  }
  
  const fileUrl = `${baseUrl}/uploads/${req.file.filename}`;

  res.status(200).json({
    message: 'File uploaded successfully',
    url: fileUrl,
    filename: req.file.filename,
    mimetype: req.file.mimetype,
    size: req.file.size
  });
};
