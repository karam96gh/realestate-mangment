// routes/serviceOrder.routes.js - محدث مع المسارات الجديدة

const express = require('express');
const router = express.Router();
const serviceOrderController = require('../controllers/serviceOrder.controller');
const authMiddleware = require('../middleware/auth.middleware');
const { 
  isAdminOrManager, 
  isTenantOrManagerWithAccess, 
  isAdminOrManagerOrMaintenance, 
  isAdminOrManagerOrMaintenanceOrAccountant,
  isAccountant
} = require('../middleware/role.middleware');
const { 
  validate, 
  serviceOrderValidationRules,
  serviceOrderUpdateValidationRules,
  serviceOrderConditionalValidation,
  validateServiceOrderFiles
} = require('../middleware/validation.middleware');
const uploadMiddleware = require('../middleware/upload.middleware');

// تطبيق وسيط المصادقة على جميع المسارات
router.use(authMiddleware);

// المسارات العامة
router.get('/', isAdminOrManagerOrMaintenanceOrAccountant, serviceOrderController.getAllServiceOrders);

// الحصول على طلب خدمة حسب المعرف
router.get('/:id', serviceOrderController.getServiceOrderById);

// الحصول على تاريخ طلب الخدمة
router.get('/:id/history', serviceOrderController.getServiceOrderHistory);

// الحصول على الحالات المسموحة لطلب خدمة
router.get('/:id/allowed-statuses', serviceOrderController.getAllowedStatusesForServiceOrder);

// === مسارات المحاسب الجديدة ===

// الحصول على طلبات الخدمة المكتملة للمحاسب
router.get(
  '/accountant/completed-orders', 
  isAccountant, 
  serviceOrderController.getCompletedServiceOrdersForAccountant
);

// الحصول على تفاصيل طلب خدمة لإنشاء مصروف
router.get(
  '/accountant/for-expense/:id', 
  isAccountant, 
  serviceOrderController.getServiceOrderForExpenseCreation
);

// === مسارات إنشاء وتعديل طلبات الخدمة ===

// إنشاء طلب خدمة (مع مرفق)
router.post(
  '/',
  uploadMiddleware.singleAttachment,
  serviceOrderValidationRules,
  validate,
  serviceOrderController.createServiceOrder
);

// تحديث طلب خدمة (مع مرفقات متعددة)
router.put(
  '/:id',
  uploadMiddleware.serviceOrderFiles,
  serviceOrderUpdateValidationRules,
  serviceOrderConditionalValidation,
  validate,
  validateServiceOrderFiles,
  serviceOrderController.updateServiceOrder
);

// حذف طلب خدمة
router.delete('/:id', serviceOrderController.deleteServiceOrder);

// الحصول على طلبات الخدمة حسب معرف الحجز
router.get(
  '/reservation/:reservationId', 
  isTenantOrManagerWithAccess, 
  serviceOrderController.getServiceOrdersByReservationId
);

// الحصول على إحصائيات طلبات الخدمة
router.get(
  '/statistics/summary', 
  isAdminOrManagerOrMaintenanceOrAccountant, 
  serviceOrderController.getServiceOrderStats
);

module.exports = router;