// Upload middleware 
const multer = require('multer');
const { contractUpload, identityUpload, checkUpload, attachmentUpload, logoUpload } = require('../config/upload');

// Single file upload handlers
const uploadContractImage = contractUpload.single('contractImage');
const uploadIdentityImage = identityUpload.single('identityImage');
const uploadCommercialRegisterImage = identityUpload.single('commercialRegisterImage');
const uploadCheckImage = checkUpload.single('checkImage');
const uploadAttachment = attachmentUpload.single('attachmentFile');
const uploadLogo = logoUpload.single('logoImage');
// Add this to middleware/upload.middleware.js

// Multiple files upload handler for reservations
const uploadReservationFiles = (req, res, next) => {
  const upload = multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => {
        let uploadPath;
        if (file.fieldname === 'contractImage') {
          uploadPath = UPLOAD_PATHS.contracts;
        } else if (file.fieldname === 'identityImage' || file.fieldname === 'commercialRegisterImage') {
          uploadPath = UPLOAD_PATHS.identities;
        } else {
          uploadPath = UPLOAD_PATHS.attachments; // Default
        }
        cb(null, uploadPath);
      },
      filename: (req, file, cb) => {
        const uniqueFileName = `${uuidv4()}${path.extname(file.originalname)}`;
        cb(null, uniqueFileName);
      }
    }),
    limits: {
      fileSize: parseInt(process.env.MAX_FILE_SIZE, 10) || 5 * 1024 * 1024 // Default to 5MB
    },
    fileFilter: (req, file, cb) => {
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
    }
  }).fields([
    { name: 'contractImage', maxCount: 1 },
    { name: 'identityImage', maxCount: 1 },
    { name: 'commercialRegisterImage', maxCount: 1 }
  ]);

  upload(req, res, (err) => {
    if (err) return handleUploadError(err, req, res, next);
    next();
  });
};


// Handle multer errors
const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'File is too large' });
    }
    return res.status(400).json({ message: err.message });
  } else if (err) {
    return res.status(400).json({ message: err.message });
  }
  next();
};

// Middleware wrappers to handle errors
const uploadMiddleware = {
  contractImage: (req, res, next) => {
    uploadContractImage(req, res, (err) => {
      if (err) return handleUploadError(err, req, res, next);
      next();
    });
  },
  identityImage: (req, res, next) => {
    uploadIdentityImage(req, res, (err) => {
      if (err) return handleUploadError(err, req, res, next);
      next();
    });
  },
  commercialRegisterImage: (req, res, next) => {
    uploadCommercialRegisterImage(req, res, (err) => {
      if (err) return handleUploadError(err, req, res, next);
      next();
    });
  },
  checkImage: (req, res, next) => {
    uploadCheckImage(req, res, (err) => {
      if (err) return handleUploadError(err, req, res, next);
      next();
    });
  },
  attachmentFile: (req, res, next) => {
    uploadAttachment(req, res, (err) => {
      if (err) return handleUploadError(err, req, res, next);
      next();
    });
  },
  logoImage: (req, res, next) => {
    uploadLogo(req, res, (err) => {
      if (err) return handleUploadError(err, req, res, next);
      next();
    });
  }
};

// Export the new middleware
module.exports = {
  // ...existing exports
  uploadReservationFiles,uploadMiddleware
};