// routes/expense.routes.js

const express = require('express');
const router = express.Router();
const expenseController = require('../controllers/expense.controller');
const authMiddleware = require('../middleware/auth.middleware');
const { 
  isAdminOrManager, 
  isAdminOrManagerOrAccountant,
  isAdminOrManagerOrOwner 
} = require('../middleware/role.middleware');
const { validate, expenseValidationRules } = require('../middleware/validation.middleware');

// تطبيق وسيط المصادقة على جميع المسارات
router.use(authMiddleware);

// المسارات العامة (للمسؤولين والمديرين والمحاسبين والمالكين)
router.get('/', isAdminOrManagerOrOwner, expenseController.getAllExpenses);
router.get('/statistics', isAdminOrManagerOrOwner, expenseController.getExpenseStatistics);

// الحصول على مصروف حسب المعرف
router.get('/:id', isAdminOrManagerOrOwner, expenseController.getExpenseById);

// الحصول على مصاريف وحدة معينة
router.get('/unit/:unitId', isAdminOrManagerOrOwner, expenseController.getExpensesByUnitId);

// إنشاء مصروف جديد (فقط للمسؤولين والمديرين والمحاسبين)
router.post(
  '/',
  isAdminOrManagerOrAccountant,
  expenseValidationRules,
  validate,
  expenseController.createExpense
);

// تحديث مصروف (فقط للمسؤولين والمديرين والمحاسبين)
router.put(
  '/:id',
  isAdminOrManagerOrAccountant,
  expenseValidationRules,
  validate,
  expenseController.updateExpense
);

// حذف مصروف (فقط للمسؤولين والمديرين)
router.delete('/:id', isAdminOrManager, expenseController.deleteExpense);

module.exports = router; 