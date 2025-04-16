// Upload configuration 
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// Define storage paths
const UPLOAD_PATHS = {
  contracts: 'public/uploads/contracts',
  identities: 'public/uploads/identities',
  checks: 'public/uploads/checks',
  attachments: 'public/uploads/attachments',
  logos: 'public/uploads/logos'
};

// Ensure upload directories exist
Object.values(UPLOAD_PATHS).forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Configure storage
const storage = (destination) => multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, destination);
  },
  filename: (req, file, cb) => {
    const uniqueFileName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueFileName);
  }
});

// File filter
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'application/pdf'
  ];
  
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, GIF and PDF are allowed.'), false);
  }
};

// Create upload middlewares
const createUploader = (destination) => multer({
  storage: storage(destination),
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE, 10) || 5 * 1024 * 1024 // Default to 5MB
  },
  fileFilter
});

// Export upload middlewares
module.exports = {
  contractUpload: createUploader(UPLOAD_PATHS.contracts),
  identityUpload: createUploader(UPLOAD_PATHS.identities),
  checkUpload: createUploader(UPLOAD_PATHS.checks),
  attachmentUpload: createUploader(UPLOAD_PATHS.attachments),
  logoUpload: createUploader(UPLOAD_PATHS.logos),
  UPLOAD_PATHS
};