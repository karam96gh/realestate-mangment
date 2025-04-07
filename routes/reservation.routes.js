// Reservation routes 
const express = require('express');
const router = express.Router();
const reservationController = require('../controllers/reservation.controller');
const authMiddleware = require('../middleware/auth.middleware');
const { isAdminOrManager, isTenant } = require('../middleware/role.middleware');
const { validate, reservationValidationRules } = require('../middleware/validation.middleware');
const multer = require('multer');
const uploadMiddleware = require('../middleware/upload.middleware');

// Apply auth middleware to all routes
router.use(authMiddleware);

// Admin/Manager routes
router.get('/my', reservationController.getMyReservations);

router.get('/', isAdminOrManager, reservationController.getAllReservations);

// Get reservation by ID - accessible to admin/manager and the tenant who owns the reservation
router.get('/:id', reservationController.getReservationById);


// Create reservation (with multiple file uploads)
router.post(
  '/',
  isAdminOrManager,
  multer().fields([
    { name: 'contractImage', maxCount: 1 },
    { name: 'identityImage', maxCount: 1 },
    { name: 'commercialRegisterImage', maxCount: 1 }
  ]),
  reservationValidationRules,
  validate,
  reservationController.createReservation
);

// Update reservation (with contract image upload)
router.put(
  '/:id',
  isAdminOrManager,
  uploadMiddleware.contractImage,
  validate,
  reservationController.updateReservation
);

// Delete reservation
router.delete('/:id', isAdminOrManager, reservationController.deleteReservation);

// Get reservations by unit ID
router.get('/unit/:unitId', isAdminOrManager, reservationController.getReservationsByUnitId);

// Get reservations by user ID - admin can see any user's reservations, tenant can only see their own
router.get('/user/:userId', reservationController.getReservationsByUserId);

module.exports = router;