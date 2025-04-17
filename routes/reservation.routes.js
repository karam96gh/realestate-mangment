// routes/reservation.routes.js
const express = require('express');
const router = express.Router();
const reservationController = require('../controllers/reservation.controller');
const authMiddleware = require('../middleware/auth.middleware');
const { isAdminOrManager } = require('../middleware/role.middleware');
const { validate, reservationValidationRules } = require('../middleware/validation.middleware');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { UPLOAD_PATHS } = require('../config/upload');

// Set up storage for reservation-related files
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    if (file.fieldname === 'contractImage') {
      cb(null, UPLOAD_PATHS.contracts);
    } else if (file.fieldname === 'identityImage' || file.fieldname === 'commercialRegisterImage') {
      cb(null, UPLOAD_PATHS.identities);
    } else {
      cb(new Error('Invalid field name for file upload'));
    }
  },
  filename: function(req, file, cb) {
    const uniqueFileName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueFileName);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'application/pdf'
  ];
  
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, GIF and PDF are allowed.'), false);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Apply auth middleware to all routes
router.use(authMiddleware);

// Get my reservations
router.get('/my', reservationController.getMyReservations);

// Admin/Manager routes
router.get('/', isAdminOrManager, reservationController.getAllReservations);

// Get reservation by ID
router.get('/:id', reservationController.getReservationById);

// Create reservation with multiple file uploads
router.post(
  '/',
  isAdminOrManager,
  upload.fields([
    { name: 'contractImage', maxCount: 1 },
    { name: 'identityImage', maxCount: 1 },
    { name: 'commercialRegisterImage', maxCount: 1 }
  ]),
  reservationValidationRules,
  validate,
  reservationController.createReservation
);

// Update reservation
router.put(
  '/:id',
  isAdminOrManager,
  upload.single('contractImage'),
  validate,
  reservationController.updateReservation
);

// Delete reservation
router.delete('/:id', isAdminOrManager, reservationController.deleteReservation);

// Get reservations by unit ID
router.get('/unit/:unitId', isAdminOrManager, reservationController.getReservationsByUnitId);

// Get reservations by user ID
router.get('/user/:userId', reservationController.getReservationsByUserId);

module.exports = router;