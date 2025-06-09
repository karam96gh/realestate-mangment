// Payment History routes 
const express = require('express');
const router = express.Router();
const paymentHistoryController = require('../controllers/paymentHistory.controller');
const authMiddleware = require('../middleware/auth.middleware');
const { isAdminOrManager,isAdminOrManagerOrAccountant } = require('../middleware/role.middleware');
const { validate, paymentValidationRules } = require('../middleware/validation.middleware');
const uploadMiddleware = require('../middleware/upload.middleware');

// Apply auth middleware to all routes
router.use(authMiddleware);

// Admin/Manager routes
router.get('/', isAdminOrManagerOrAccountant, paymentHistoryController.getAllPayments);

// Get payment by ID - accessible to admin/manager and the tenant related to the payment
router.get('/:id', paymentHistoryController.getPaymentById);

// Create payment (with check image upload) - admin/manager only
router.post(
  '/',
  isAdminOrManager,
  uploadMiddleware.checkImage,
  paymentValidationRules,
  validate,
  paymentHistoryController.createPayment
);

// Update payment (with check image upload) - admin/manager only
router.put(
  '/:id',
  isAdminOrManagerOrAccountant,
  uploadMiddleware.checkImage,
  validate,
  paymentHistoryController.updatePayment
);

// Delete payment - admin/manager only
router.delete('/:id', isAdminOrManager, paymentHistoryController.deletePayment);

// Get payments by reservation ID
router.get('/reservation/:reservationId', paymentHistoryController.getPaymentsByReservationId);

module.exports = router;