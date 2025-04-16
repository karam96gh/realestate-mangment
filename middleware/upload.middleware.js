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

module.exports = uploadMiddleware;