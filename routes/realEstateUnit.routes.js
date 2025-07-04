// Real Estate Unit routes 
const express = require('express');
const router = express.Router();
const realEstateUnitController = require('../controllers/realEstateUnit.controller');
const authMiddleware = require('../middleware/auth.middleware');
const { isAdminOrManager, isAdminOrManagerOrOwner, isAdminOrManagerOrMaintenanceOrAccountant } = require('../middleware/role.middleware');
const { validate, unitValidationRules } = require('../middleware/validation.middleware');
// Protected routes
router.use(authMiddleware);
router.get('/:id', realEstateUnitController.getUnitById);

router.use(isAdminOrManagerOrMaintenanceOrAccountant);
// Public routes
router.get('/', realEstateUnitController.getAllUnits);
router.get('/parking/available/:buildingId', realEstateUnitController.getAvailableParkingSpots);

router.get('/unit-building/available', realEstateUnitController.getAvailableUnits);
router.get('/building/:buildingId', realEstateUnitController.getUnitsByBuildingId);

// Protected routes


// Create unit
router.post(
  '/',
  unitValidationRules,
  validate,
  realEstateUnitController.createUnit
);

// Update unit
router.put(
  '/:id',
//   unitValidationRules,
//   validate,
  realEstateUnitController.updateUnit
);

// Delete unit
router.delete('/:id', realEstateUnitController.deleteUnit);

module.exports = router;