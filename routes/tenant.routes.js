// routes/tenant.routes.js
const express = require('express');
const router = express.Router();
const tenantController = require('../controllers/tenant.controller');
const authMiddleware = require('../middleware/auth.middleware');
const { isAdmin, isAdminOrManager, isAdminOrManagerOrAccountant } = require('../middleware/role.middleware');
const { validate } = require('../middleware/validation.middleware');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { UPLOAD_PATHS } = require('../config/upload');

// إعداد تخزين الملفات
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, UPLOAD_PATHS.identities);
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

// الحصول على جميع المستأجرين (فقط للمسؤولين والمديرين)
router.get('/', isAdminOrManagerOrAccountant, tenantController.getAllTenants);

// الحصول على معلومات المستأجر الحالي
router.get('/my-info', tenantController.getTenantByUserId);

// الحصول على مستأجر حسب معرف المستخدم
router.get('/user/:userId', isAdminOrManager, tenantController.getTenantByUserId);

// الحصول على مستأجر حسب المعرف
router.get('/:id', tenantController.getTenantById);

// إنشاء مستأجر جديد (مع دعم رفع الملفات)
router.post(
  '/',
  isAdminOrManager,
  upload.fields([
    { name: 'identityImageFront', maxCount: 1 },
    { name: 'identityImageBack', maxCount: 1 },
    { name: 'commercialRegisterImage', maxCount: 1 }
  ]),
  validate,
  tenantController.createTenant
);

// تحديث بيانات مستأجر
router.put(
  '/:id',
  upload.fields([
    { name: 'identityImageFront', maxCount: 1 },
    { name: 'identityImageBack', maxCount: 1 },
    { name: 'commercialRegisterImage', maxCount: 1 }
  ]),
  validate,
  tenantController.updateTenant
);

// حذف مستأجر (فقط للمسؤولين)
router.delete('/:id', isAdmin, tenantController.deleteTenant);

module.exports = router;