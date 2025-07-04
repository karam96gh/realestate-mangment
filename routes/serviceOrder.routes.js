// Service Order routes 
const express = require('express');
const router = express.Router();
const serviceOrderController = require('../controllers/serviceOrder.controller');
const authMiddleware = require('../middleware/auth.middleware');
const { isAdminOrManager, isTenantOrManagerWithAccess, isAdminOrManagerOrMaintenance, isAdminOrManagerOrMaintenanceOrAccountant } = require('../middleware/role.middleware');
const { validate, serviceOrderValidationRules } = require('../middleware/validation.middleware');
const uploadMiddleware = require('../middleware/upload.middleware');

// Apply auth middleware to all routes
router.use(authMiddleware);

// Admin/Manager routes
router.get('/', isAdminOrManagerOrMaintenanceOrAccountant, serviceOrderController.getAllServiceOrders);

// Get service order by ID - accessible to admin/manager and the tenant who owns the service order
router.get('/:id', serviceOrderController.getServiceOrderById);

// Get service order history by ID
router.get('/:id/history', serviceOrderController.getServiceOrderHistory);

// Get allowed statuses for a service order (NEW ROUTE)
router.get('/:id/allowed-statuses', serviceOrderController.getAllowedStatusesForServiceOrder);

// Create service order (with attachment upload)
router.post(
  '/',
  uploadMiddleware.attachmentFile,
  serviceOrderValidationRules,
  validate,
  serviceOrderController.createServiceOrder
);

// Update service order (with attachment upload)
router.put(
  '/:id',
  uploadMiddleware.attachmentFile,
  validate,
  serviceOrderController.updateServiceOrder
);

// Delete service order
router.delete('/:id', serviceOrderController.deleteServiceOrder);

// Get service orders by reservation ID
router.get('/reservation/:reservationId', isTenantOrManagerWithAccess, serviceOrderController.getServiceOrdersByReservationId);

module.exports = router;