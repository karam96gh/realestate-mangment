// middleware/upload.middleware.js - محدث لدعم مرفقات المصاريف

const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { UPLOAD_PATHS } = require('../config/upload');

// إعداد التخزين للمرفقات العامة
const attachmentStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_PATHS.attachments);
  },
  filename: (req, file, cb) => {
    const uniqueFileName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueFileName);
  }
});

// إعداد التخزين المتعدد للملفات
const multiFieldStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    let destination = UPLOAD_PATHS.attachments; // افتراضي
    
    // تحديد المجلد حسب نوع الملف
    switch (file.fieldname) {
      case 'attachmentFile':
      case 'completionAttachment':
      case 'expenseAttachment':
        destination = UPLOAD_PATHS.attachments;
        break;
      case 'contractImage':
      case 'contractPdf':
        destination = UPLOAD_PATHS.contracts;
        break;
      case 'identityImageFront':
      case 'identityImageBack':
        destination = UPLOAD_PATHS.identities;
        break;
      case 'checkImage':
        destination = UPLOAD_PATHS.checks;
        break;
      default:
        destination = UPLOAD_PATHS.attachments;
    }
    
    cb(null, destination);
  },
  filename: (req, file, cb) => {
    const uniqueFileName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueFileName);
  }
});

// فلتر الملفات
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain'
  ];
  
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`نوع الملف غير مقبول: ${file.mimetype}. الأنواع المسموحة: JPEG, PNG, GIF, PDF, Word, Excel, Text`), false);
  }
};

// معالجة أخطاء الرفع
const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ 
        status: 'fail',
        message: 'حجم الملف كبير جداً. الحد الأقصى 10 ميجابايت' 
      });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ 
        status: 'fail',
        message: `حقل ملف غير متوقع: ${err.field}` 
      });
    }
    return res.status(400).json({ 
      status: 'fail',
      message: err.message 
    });
  } else if (err) {
    return res.status(400).json({ 
      status: 'fail',
      message: err.message 
    });
  }
  next();
};

// إعداد multer للمرفقات المفردة
const singleAttachmentUpload = multer({
  storage: attachmentStorage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10 ميجابايت
  }
});

// إعداد multer للملفات المتعددة
const multiFieldUpload = multer({
  storage: multiFieldStorage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10 ميجابايت
  }
});

// وسطاء رفع الملفات

// للمصاريف - ملف مرفق واحد
const uploadExpenseAttachment = (req, res, next) => {
  singleAttachmentUpload.single('attachmentFile')(req, res, (err) => {
    if (err) return handleUploadError(err, req, res, next);
    next();
  });
};

// لطلبات الخدمة - ملفات متعددة
const uploadServiceOrderFiles = (req, res, next) => {
  multiFieldUpload.fields([
    { name: 'attachmentFile', maxCount: 1 },
    { name: 'completionAttachment', maxCount: 1 }
  ])(req, res, (err) => {
    if (err) return handleUploadError(err, req, res, next);
    next();
  });
};

// للمرفقات العامة - ملف واحد
const uploadSingleAttachment = (req, res, next) => {
  singleAttachmentUpload.single('attachmentFile')(req, res, (err) => {
    if (err) return handleUploadError(err, req, res, next);
    next();
  });
};

// للحجوزات مع مرفقات متعددة
const uploadReservationFiles = (req, res, next) => {
  multiFieldUpload.fields([
    { name: 'contractImage', maxCount: 1 },
    { name: 'contractPdf', maxCount: 1 },
    { name: 'identityImageFront', maxCount: 1 },
    { name: 'identityImageBack', maxCount: 1 },
    { name: 'commercialRegisterImage', maxCount: 1 },
    { name: 'depositCheckImage', maxCount: 1 }
  ])(req, res, (err) => {
    if (err) return handleUploadError(err, req, res, next);
    next();
  });
};

// Middleware الموجود مسبقاً
const uploadMiddleware = {
  // الموجود مسبقاً
  contractImage: (req, res, next) => {
    singleAttachmentUpload.single('contractImage')(req, res, (err) => {
      if (err) return handleUploadError(err, req, res, next);
      next();
    });
  },
  
  checkImage: (req, res, next) => {
    singleAttachmentUpload.single('checkImage')(req, res, (err) => {
      if (err) return handleUploadError(err, req, res, next);
      next();
    });
  },
  
  attachmentFile: (req, res, next) => {
    singleAttachmentUpload.single('attachmentFile')(req, res, (err) => {
      if (err) return handleUploadError(err, req, res, next);
      next();
    });
  },

  // الجديد
  expenseAttachment: uploadExpenseAttachment,
  serviceOrderFiles: uploadServiceOrderFiles,
  singleAttachment: uploadSingleAttachment,
  reservationFiles: uploadReservationFiles
};

module.exports = {
  ...uploadMiddleware,
  handleUploadError
};