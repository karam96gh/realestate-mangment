// routes/reservation.routes.js - تحديث المسارات لدعم صورة شيك التأمين

const express = require('express');
const router = express.Router();
const reservationController = require('../controllers/reservation.controller');
const authMiddleware = require('../middleware/auth.middleware');
const { isAdminOrManager, isAdminOrManagerOrAccountant } = require('../middleware/role.middleware');
const { validate, reservationValidationRules, reservationUpdateValidationRules } = require('../middleware/validation.middleware');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { UPLOAD_PATHS } = require('../config/upload');

// إعداد تخزين ملفات متعدد الوجهات مع دعم شيك التأمين
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    let uploadPath;
    
    // تحديد المجلد المناسب حسب نوع الملف
    switch (file.fieldname) {
      case 'contractImage':
      case 'contractPdf':
        uploadPath = UPLOAD_PATHS.contracts;
        break;
      case 'identityImageFront':
      case 'identityImageBack':
      case 'commercialRegisterImage':
        uploadPath = UPLOAD_PATHS.identities;
        break;
      case 'depositCheckImage': // جديد - صورة شيك التأمين
        uploadPath = UPLOAD_PATHS.checks;
        break;
      default:
        uploadPath = UPLOAD_PATHS.attachments; // مجلد افتراضي
        break;
    }
    
    console.log(`حفظ الملف ${file.fieldname} في: ${uploadPath}`);
    cb(null, uploadPath);
  },
  filename: function(req, file, cb) {
    const uniqueFileName = `${uuidv4()}${path.extname(file.originalname)}`;
    console.log(`اسم الملف الجديد: ${uniqueFileName}`);
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
    cb(new Error(`نوع الملف غير مقبول: ${file.mimetype}. يسمح فقط بـ JPEG و PNG و GIF و PDF`), false);
  }
};

// معالجة أخطاء رفع الملفات
const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ 
        status: 'fail',
        message: 'حجم الملف كبير جداً. الحد الأقصى 5 ميجابايت' 
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

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // الحد 5 ميجابايت
  }
});

// دالة للتحقق من مسارات الحفظ (اختيارية - للتشخيص)
const logFileInfo = (req, res, next) => {
  if (req.files) {
    console.log('=== معلومات الملفات المرفوعة ===');
    Object.keys(req.files).forEach(fieldName => {
      req.files[fieldName].forEach(file => {
        console.log(`الحقل: ${fieldName}`);
        console.log(`اسم الملف: ${file.filename}`);
        console.log(`المسار: ${file.destination}`);
        console.log(`الحجم: ${file.size} بايت`);
        console.log('---');
      });
    });
  }
  next();
};

// تطبيق وسيط المصادقة على جميع المسارات
router.use(authMiddleware);

// الحصول على حجوزاتي
router.get('/my', reservationController.getMyReservations);

// مسارات المسؤولين والمديرين
router.get('/', isAdminOrManagerOrAccountant, reservationController.getAllReservations);

// الحصول على حجز حسب المعرف
router.get('/:id', reservationController.getReservationById);

// إنشاء حجز جديد مع رفع الملفات في المجلدات الصحيحة (مع دعم شيك التأمين)
router.post(
  '/',
  isAdminOrManager,
  upload.fields([
    { name: 'contractImage', maxCount: 1 },           // سيُحفظ في contracts
    { name: 'contractPdf', maxCount: 1 },             // سيُحفظ في contracts
    { name: 'identityImageFront', maxCount: 1 },      // سيُحفظ في identities
    { name: 'identityImageBack', maxCount: 1 },       // سيُحفظ في identities
    { name: 'commercialRegisterImage', maxCount: 1 }, // سيُحفظ في identities
    { name: 'depositCheckImage', maxCount: 1 }        // سيُحفظ في checks - جديد
  ]),
  handleUploadError,
  logFileInfo,
  reservationValidationRules,
  validate,
  reservationController.createReservation
);

// تحديث حجز (مع دعم تحديث شيك التأمين)
router.put(
  '/:id',
  isAdminOrManager,
  upload.fields([
    { name: 'contractImage', maxCount: 1 },    // سيُحفظ في contracts
    { name: 'contractPdf', maxCount: 1 },      // سيُحفظ في contracts
    { name: 'depositCheckImage', maxCount: 1 } // سيُحفظ في checks - جديد
  ]),
  handleUploadError,
  logFileInfo,
  reservationUpdateValidationRules,
  validate,
  reservationController.updateReservation
);

// حذف حجز
router.delete('/:id', isAdminOrManager, reservationController.deleteReservation);

// الحصول على الحجوزات حسب معرف الوحدة
router.get('/unit/:unitId', reservationController.getReservationsByUnitId);

// الحصول على الحجوزات حسب معرف المستخدم
router.get('/user/:userId', reservationController.getReservationsByUserId);

module.exports = router;