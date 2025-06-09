// Auth routes 
const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const authMiddleware = require('../middleware/auth.middleware');
const { isAdmin,isAdminOrManager } = require('../middleware/role.middleware');
const { validate, loginValidationRules, userValidationRules,resetManagerPasswordvalidate } = require('../middleware/validation.middleware');
// routes/auth.routes.js

// Add this route to your existing routes
router.post(
    '/reset-manager-password',
    authMiddleware,
    isAdmin,
    
    resetManagerPasswordvalidate,
    validate,
    authController.resetManagerPassword
  );
// Login routes
router.post('/login', loginValidationRules, validate, authController.login);

// Admin routes (protected)
router.post(
  '/admin/register',
  authMiddleware,
  isAdmin,
  userValidationRules,
  validate,
  authController.registerAdmin
);

// Manager routes (protected)
router.post(
  '/manager/register',
  authMiddleware,
  isAdmin,
  userValidationRules,
  validate,
  authController.registerManager
);
// Accountant routes (protected)
router.post(
  '/accountant/register',
  authMiddleware,
  isAdminOrManager,
  userValidationRules,
  validate,
  authController.registerAccountant
);

// Maintenance routes (protected)
router.post(
  '/maintenance/register',
  authMiddleware,
  isAdminOrManager,
  userValidationRules,
  validate,
  authController.registerMaintenance
);

// Owner routes (protected)
router.post(
  '/owner/register',
  authMiddleware,
  isAdminOrManager,
  userValidationRules,
  validate,
  authController.registerOwner
);

// Protected routes
router.use(authMiddleware);

// Change password (any authenticated user)
router.post('/change-password', authController.changePassword);

// Get current user profile
router.get('/me', authController.getMe);

module.exports = router;