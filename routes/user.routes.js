// User routes 
const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const authMiddleware = require('../middleware/auth.middleware');
const { isAdmin } = require('../middleware/role.middleware');
const { validate, userValidationRules } = require('../middleware/validation.middleware');
const multer = require('multer');

// Apply auth middleware to all routes
router.use(authMiddleware);

// Get all users (admin only)
router.get('/', isAdmin, userController.getAllUsers);

// Get user by ID
router.get('/:id', userController.getUserById);

// Update user (with identity and commercial register image uploads)
router.put(
  '/:id',
  multer().fields([
    { name: 'identityImage', maxCount: 1 },
    { name: 'commercialRegisterImage', maxCount: 1 }
  ]),
  validate,
  userController.updateUser
);

// Delete user (admin only)
router.delete('/:id', isAdmin, userController.deleteUser);

module.exports = router;