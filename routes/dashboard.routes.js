// Dashboard routes 
const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboard.controller');
const authMiddleware = require('../middleware/auth.middleware');
const { isAdminOrManager } = require('../middleware/role.middleware');

// Apply auth middleware to all routes
router.use(authMiddleware);

// Admin/Manager only routes
router.use(isAdminOrManager);

// Dashboard statistics routes
router.get('/statistics', dashboardController.getGeneralStatistics);
router.get('/units-status', dashboardController.getUnitsStatusStatistics);
router.get('/services-status', dashboardController.getServiceOrdersStatusStatistics);

module.exports = router;