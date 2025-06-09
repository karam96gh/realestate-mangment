// Building routes 
const express = require('express');
const router = express.Router();
const buildingController = require('../controllers/building.controller');
const authMiddleware = require('../middleware/auth.middleware');
const { isAdminOrManager, isAdminOrManagerOrOwner } = require('../middleware/role.middleware');
const { validate, buildingValidationRules } = require('../middleware/validation.middleware');

// Public routes
router.use(authMiddleware);
router.use(isAdminOrManagerOrOwner);

router.get('/', buildingController.getAllBuildings);
router.get('/:id', buildingController.getBuildingById);
router.get('/company/:companyId', buildingController.getBuildingsByCompanyId);

// Protected routes

// Create building
router.post(
  '/',
  buildingValidationRules,
  validate,
  buildingController.createBuilding
);

// Update building
router.put(
  '/:id',
  buildingValidationRules,
  validate,
  buildingController.updateBuilding
);

// Delete building
router.delete('/:id', buildingController.deleteBuilding);

module.exports = router;