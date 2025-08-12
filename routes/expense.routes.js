// routes/expense.routes.js - محدث مع المسارات الجديدة

const express = require('express');
const router = express.Router();
const expenseController = require('../controllers/expense.controller');
const authMiddleware = require('../middleware/auth.middleware');
const { 
  isAdminOrManager, 
  isAdminOrManagerOrAccountant,
  isAccountant
} = require('../middleware/role.middleware');
const { 
  validate, 
  expenseValidationRules,
  expenseFromServiceOrderValidationRules,
  validateExpenseData,
  validateExpenseAttachment
} = require('../middleware/validation.middleware');
const uploadMiddleware = require('../middleware/upload.middleware');

// تطبيق وسيط المصادقة على جميع المسارات
router.use(authMiddleware);

// المسارات العامة (للمسؤولين والمديرين والمحاسبين والمالكين والمستأجرين)
router.get('/', expenseController.getAllExpenses);

// الحصول على مصروف حسب المعرف
router.get('/:id', expenseController.getExpenseById);

// الحصول على مصاريف مبنى معين
router.get('/building/:buildingId', expenseController.getExpensesByBuildingId);

// الحصول على مصاريف وحدة معينة
router.get('/unit/:unitId', expenseController.getExpensesByUnitId);

// الحصول على إحصائيات المصاريف
router.get('/statistics/summary', expenseController.getExpenseStatistics);

// === مسارات المحاسب ===

// الحصول على طلبات الخدمة المكتملة التي تحتاج إنشاء مصروف
router.get(
  '/service-orders/completed-for-expense', 
  isAccountant, 
  expenseController.getCompletedServiceOrdersForExpense
);

// إنشاء مصروف من طلب خدمة مكتمل
router.post(
  '/create-from-service-order/:serviceOrderId',
  isAccountant,
  expenseFromServiceOrderValidationRules,
  validate,
  expenseController.createExpenseFromServiceOrder
);

// === مسارات إنشاء وتعديل المصاريف ===

// إنشاء مصروف جديد (فقط للمسؤولين والمديرين والمحاسبين)
router.post(
  '/',
  isAdminOrManagerOrAccountant,
  uploadMiddleware.expenseAttachment,
  expenseValidationRules,
  validate,
  validateExpenseData,
  validateExpenseAttachment,
  expenseController.createExpense
);

// تحديث مصروف (فقط للمسؤولين والمديرين والمحاسبين)
router.put(
  '/:id',
  isAdminOrManagerOrAccountant,
  uploadMiddleware.expenseAttachment,
  expenseValidationRules,
  validate,
  validateExpenseData,
  validateExpenseAttachment,
  expenseController.updateExpense
);

// حذف مصروف (فقط للمسؤولين والمديرين)
router.delete('/:id', isAdminOrManager, expenseController.deleteExpense);

module.exports = router;