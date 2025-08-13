// routes/auth.routes.js - تحديث مع المسارات الجديدة

const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const authMiddleware = require('../middleware/auth.middleware');
const { isAdmin, isAdminOrManager } = require('../middleware/role.middleware');
const { validate, loginValidationRules, userValidationRules, resetManagerPasswordvalidate } = require('../middleware/validation.middleware');

// ✅ قواعد التحقق الجديدة للتعطيل والتفعيل
const { check } = require('express-validator');

const deactivateUserValidationRules = [
  check('userId').isInt().withMessage('معرف المستخدم يجب أن يكون رقمًا صحيحًا'),
  check('reason').optional().isLength({ min: 3, max: 500 }).withMessage('السبب يجب أن يكون بين 3 و 500 حرف')
];

const activateUserValidationRules = [
  check('userId').isInt().withMessage('معرف المستخدم يجب أن يكون رقمًا صحيحًا')
];

// مسار إعادة تعيين كلمة مرور المدير
router.post(
  '/reset-manager-password',
  authMiddleware,
  isAdmin,
  resetManagerPasswordvalidate,
  validate,
  authController.resetManagerPassword
);

// مسارات تسجيل الدخول
router.post('/login', loginValidationRules, validate, authController.login);

// مسارات المسؤول (محمية)
router.post(
  '/admin/register',
  authMiddleware,
  isAdmin,
  userValidationRules,
  validate,
  authController.registerAdmin
);

// مسارات المدير (محمية)
router.post(
  '/manager/register',
  authMiddleware,
  isAdmin,
  userValidationRules,
  validate,
  authController.registerManager
);

// مسارات المحاسب (محمية)
router.post(
  '/accountant/register',
  authMiddleware,
  isAdminOrManager,
  userValidationRules,
  validate,
  authController.registerAccountant
);

// مسارات عامل الصيانة (محمية)
router.post(
  '/maintenance/register',
  authMiddleware,
  isAdminOrManager,
  userValidationRules,
  validate,
  authController.registerMaintenance
);

// مسارات مالك العقار (محمية)
router.post(
  '/owner/register',
  authMiddleware,
  isAdminOrManager,
  userValidationRules,
  validate,
  authController.registerOwner
);

// ✅ المسارات الجديدة لإدارة حالة المستخدمين
router.post(
  '/deactivate-user',
  authMiddleware,
  isAdminOrManager,
  deactivateUserValidationRules,
  validate,
  authController.deactivateUser
);

router.post(
  '/activate-user',
  authMiddleware,
  isAdminOrManager,
  activateUserValidationRules,
  validate,
  authController.activateUser
);

// الحصول على قائمة المستخدمين المعطلين
router.get(
  '/deactivated-users',
  authMiddleware,
  isAdminOrManager,
  authController.getDeactivatedUsers
);

// تطبيق وسيط المصادقة على جميع المسارات التالية
router.use(authMiddleware);

// تغيير كلمة المرور (أي مستخدم مصادق عليه)
router.post('/change-password', authController.changePassword);

// الحصول على ملف المستخدم الحالي
router.get('/me', authController.getMe);

module.exports = router;