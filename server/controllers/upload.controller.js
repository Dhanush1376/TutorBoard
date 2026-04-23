import path from 'path';

export const uploadFile = (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  // Generate URL for the uploaded file
  // In a real prod environment, this would be an S3/Cloudinary URL
  const baseUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`;
  const fileUrl = `${baseUrl}/uploads/${req.file.filename}`;

  res.status(200).json({
    message: 'File uploaded successfully',
    url: fileUrl,
    filename: req.file.filename,
    mimetype: req.file.mimetype,
    size: req.file.size
  });
};
