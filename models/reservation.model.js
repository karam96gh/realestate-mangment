// تحديث ملف المسارات للحجوزات
const express = require('express');
const router = express.Router();
const reservationController = require('../controllers/reservation.controller');
const authMiddleware = require('../middleware/auth.middleware');
const { isAdminOrManager, isTenant } = require('../middleware/role.middleware');
const { validate, reservationValidationRules } = require('../middleware/validation.middleware');
const { multiUpload } = require('../config/upload'); // استخدام الدالة المُحسّنة للتحميل المتعدد

// تطبيق وسيط التحقق من الهوية على جميع المسارات
router.use(authMiddleware);

// مسارات الحجوزات الخاصة بالمستخدم
router.get('/my', reservationController.getMyReservations);

// مسارات المدير/المسؤول
router.get('/', isAdminOrManager, reservationController.getAllReservations);

// الحصول على حجز حسب المعرف - متاح للمدير/المسؤول والمستأجر صاحب الحجز
router.get('/:id', reservationController.getReservationById);

// إنشاء حجز جديد (مع تحميل ملفات متعددة)
// استخدام multiUpload لتحميل الملفات المتعددة بطريقة أفضل
router.post(
  '/',
  isAdminOrManager,
  (req, res, next) => {
    // تهيئة middleware التحميل المتعدد
    const upload = multiUpload();
    upload(req, res, (err) => {
      if (err) {
        return res.status(400).json({ 
          status: 'error', 
          message: `خطأ في تحميل الملفات: ${err.message}` 
        });
      }
      next();
    });
  },
  reservationValidationRules,
  validate,
  reservationController.createReservation
);

// تحديث حجز (مع تحميل صورة العقد)
router.put(
  '/:id',
  isAdminOrManager,
  (req, res, next) => {
    // تهيئة middleware التحميل المتعدد مع التركيز على صورة العقد
    const upload = multiUpload();
    upload(req, res, (err) => {
      if (err) {
        return res.status(400).json({ 
          status: 'error', 
          message: `خطأ في تحميل الملفات: ${err.message}` 
        });
      }
      next();
    });
  },
  validate,
  reservationController.updateReservation
);

// حذف حجز
router.delete('/:id', isAdminOrManager, reservationController.deleteReservation);

// الحصول على الحجوزات حسب معرف الوحدة
router.get('/unit/:unitId', isAdminOrManager, reservationController.getReservationsByUnitId);

// الحصول على الحجوزات حسب معرف المستخدم - يمكن للمدير مشاهدة حجوزات أي مستخدم، ويمكن للمستأجر مشاهدة حجوزاته فقط
router.get('/user/:userId', reservationController.getReservationsByUserId);

module.exports = router;