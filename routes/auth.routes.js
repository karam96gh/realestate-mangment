// Auth routes 
const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const authMiddleware = require('../middleware/auth.middleware');
const { isAdmin } = require('../middleware/role.middleware');
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

// Protected routes
router.use(authMiddleware);

// Change password (any authenticated user)
router.post('/change-password', authController.changePassword);

// Get current user profile
router.get('/me', authController.getMe);

module.exports = router;