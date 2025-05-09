// routes/reservation.routes.js
const express = require('express');
const router = express.Router();
const reservationController = require('../controllers/reservation.controller');
const authMiddleware = require('../middleware/auth.middleware');
const { isAdminOrManager } = require('../middleware/role.middleware');
const { validate, reservationValidationRules } = require('../middleware/validation.middleware');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { UPLOAD_PATHS } = require('../config/upload');

// إعداد تخزين ملفات العقود
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, UPLOAD_PATHS.contracts);
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
    cb(new Error('نوع الملف غير مقبول. يسمح فقط بـ JPEG و PNG و GIF و PDF'), false);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // الحد 5 ميجابايت
  }
});

// تطبيق وسيط المصادقة على جميع المسارات
router.use(authMiddleware);

// الحصول على حجوزاتي
router.get('/my', reservationController.getMyReservations);

// مسارات المسؤولين والمديرين
router.get('/', isAdminOrManager, reservationController.getAllReservations);

// الحصول على حجز حسب المعرف
router.get('/:id', reservationController.getReservationById);

// إنشاء حجز جديد مع رفع الملفات
router.post(
  '/',
  isAdminOrManager,
  upload.fields([
    { name: 'contractImage', maxCount: 1 },
    { name: 'contractPdf', maxCount: 1 }
  ]),
  reservationValidationRules,
  validate,
  reservationController.createReservation
);

// تحديث حجز
router.put(
  '/:id',
  isAdminOrManager,
  upload.fields([
    { name: 'contractImage', maxCount: 1 },
    { name: 'contractPdf', maxCount: 1 }
  ]),
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