// Service Order routes 
const express = require('express');
const router = express.Router();
const serviceOrderController = require('../controllers/serviceOrder.controller');
const authMiddleware = require('../middleware/auth.middleware');
const { isAdminOrManager,isTenantOrManagerWithAccess } = require('../middleware/role.middleware');
const { validate, serviceOrderValidationRules } = require('../middleware/validation.middleware');
const uploadMiddleware = require('../middleware/upload.middleware');

// Apply auth middleware to all routes
router.use(authMiddleware);

// Admin/Manager routes
router.get('/', isAdminOrManager, serviceOrderController.getAllServiceOrders);

// Get service order by ID - accessible to admin/manager and the tenant who owns the service order
router.get('/:id', serviceOrderController.getServiceOrderById);

// Create service order (with attachment upload)


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

// استخدام الدالة في مسار الحصول على طلبات الخدمة لحجز معين
router.get('/reservation/:reservationId', isTenantOrManagerWithAccess, serviceOrderController.getServiceOrdersByReservationId);

// وأيضًا يمكن استخدامها في مسار إنشاء طلب خدمة جديد
router.post(
  '/',
  uploadMiddleware.attachmentFile,
  serviceOrderValidationRules,
  validate,
  serviceOrderController.createServiceOrder
);
module.exports = router;