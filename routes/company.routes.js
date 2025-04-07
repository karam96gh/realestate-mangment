// Company routes 
const express = require('express');
const router = express.Router();
const companyController = require('../controllers/company.controller');
const authMiddleware = require('../middleware/auth.middleware');
const { isAdminOrManager } = require('../middleware/role.middleware');
const { validate, companyValidationRules } = require('../middleware/validation.middleware');
const uploadMiddleware = require('../middleware/upload.middleware');

// Public routes
router.get('/', companyController.getAllCompanies);
router.get('/:id', companyController.getCompanyById);

// Protected routes
router.use(authMiddleware);
router.use(isAdminOrManager);

// Create company (with logo upload)
router.post(
  '/',
  uploadMiddleware.logoImage,
  companyValidationRules,
  validate,
  companyController.createCompany
);

// Update company (with logo upload)
router.put(
  '/:id',
  uploadMiddleware.logoImage,
  companyValidationRules,
  validate,
  companyController.updateCompany
);

// Delete company
router.delete('/:id', companyController.deleteCompany);

module.exports = router;