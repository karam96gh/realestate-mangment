// تعديل في routes/company.routes.js لإضافة دعم رفع الصور الإضافية

const express = require('express');
const router = express.Router();
const companyController = require('../controllers/company.controller');
const authMiddleware = require('../middleware/auth.middleware');
const { isAdminOrManager } = require('../middleware/role.middleware');
const { validate, companyValidationRules } = require('../middleware/validation.middleware');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const { UPLOAD_PATHS } = require('../config/upload');

// إعداد تخزين الملفات
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    let destination;
    
    // تحديد مجلد الوجهة حسب نوع الملف
    if (file.fieldname === 'logoImage') {
      destination = UPLOAD_PATHS.logos;
    } else if (file.fieldname === 'identityImageFront' || file.fieldname === 'identityImageBack') {
      destination = UPLOAD_PATHS.identities;
    } else {
      destination = UPLOAD_PATHS.attachments; // مجلد افتراضي
    }
    
    cb(null, destination);
  },
  filename: function(req, file, cb) {
    const uniqueFileName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueFileName);
  }
});

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
    cb(new Error('نوع الملف غير صالح. يسمح فقط بملفات JPEG و PNG و GIF و PDF'), false);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5 ميجابايت
  }
});

router.use(authMiddleware);
router.use(isAdminOrManager);

// المسارات العامة
router.get('/', companyController.getAllCompanies);
router.get('/:id', companyController.getCompanyById);

// إنشاء شركة (مع رفع ملفات متعددة)
router.post(
  '/',
  upload.fields([
    { name: 'logoImage', maxCount: 1 },
    { name: 'identityImageFront', maxCount: 1 },
    { name: 'identityImageBack', maxCount: 1 }
  ]),
  companyValidationRules,
  validate,
  companyController.createCompany
);

// تحديث شركة (مع رفع ملفات متعددة)
router.put(
  '/:id',
  upload.fields([
    { name: 'logoImage', maxCount: 1 },
    { name: 'identityImageFront', maxCount: 1 },
    { name: 'identityImageBack', maxCount: 1 }
  ]),
  companyValidationRules,
  validate,
  companyController.updateCompany
);

// حذف شركة
router.delete('/:id', companyController.deleteCompany);

module.exports = router;