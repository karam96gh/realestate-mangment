// routes/ownerReport.routes.js

const express = require('express');
const router = express.Router();
const ownerReportController = require('../controllers/ownerReport.controller');
const authMiddleware = require('../middleware/auth.middleware');
const { isOwner } = require('../middleware/role.middleware');

// تطبيق وسيط المصادقة على جميع المسارات
router.use(authMiddleware);

// مسار للحصول على التقرير المالي الشامل (فقط للمالكين)
router.get('/financial-report', isOwner, ownerReportController.getOwnerFinancialReport);

module.exports = router;