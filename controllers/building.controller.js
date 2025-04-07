// controllers/building.controller.js
const Building = require('../models/building.model');
const Company = require('../models/company.model');
const { catchAsync, AppError } = require('../utils/errorHandler');

// Get all buildings
const getAllBuildings = catchAsync(async (req, res) => {
  // If user is a manager, only show buildings from their company
  const whereCondition = {};
  
  if (req.user.role === 'manager' && req.user.companyId) {
    whereCondition.companyId = req.user.companyId;
  }
  
  const buildings = await Building.findAll({
    where: whereCondition,
    include: [
      { model: Company, as: 'company' }
    ]
  });
  
  res.status(200).json({
    status: 'success',
    results: buildings.length,
    data: buildings
  });
});

// Get building by ID
const getBuildingById = catchAsync(async (req, res, next) => {
  const building = await Building.findByPk(req.params.id, {
    include: [
      { model: Company, as: 'company' }
    ]
  });
  
  if (!building) {
    return next(new AppError('Building not found', 404));
  }
  
  // If user is a manager, verify they belong to the same company
  if (req.user.role === 'manager' && req.user.companyId !== building.companyId) {
    return next(new AppError('You are not authorized to view this building', 403));
  }
  
  res.status(200).json({
    status: 'success',
    data: building
  });
});

// Create new building
const createBuilding = catchAsync(async (req, res, next) => {
  let { companyId, name, address, buildingType, totalUnits, description } = req.body;
  
  // If user is a manager, use their companyId and ignore any provided companyId
  if (req.user.role === 'manager') {
    if (!req.user.companyId) {
      return next(new AppError('Manager is not associated with any company', 400));
    }
    companyId = req.user.companyId;
  }
  
  // Check if company exists
  const company = await Company.findByPk(companyId);
  if (!company) {
    return next(new AppError('Company not found', 404));
  }
  
  const newBuilding = await Building.create({
    companyId,
    name,
    address,
    buildingType,
    totalUnits,
    description
  });
  
  res.status(201).json({
    status: 'success',
    data: newBuilding
  });
});

// Update building
const updateBuilding = catchAsync(async (req, res, next) => {
  const building = await Building.findByPk(req.params.id);
  
  if (!building) {
    return next(new AppError('Building not found', 404));
  }
  
  // If user is a manager, verify they belong to the same company
  if (req.user.role === 'manager' && req.user.companyId !== building.companyId) {
    return next(new AppError('You are not authorized to update this building', 403));
  }
  
  const { name, address, buildingType, totalUnits, description } = req.body;
  
  // If companyId is being updated, check if the new company exists
  // Only allow admins to change the companyId
  let companyId = building.companyId;
  if (req.user.role === 'admin' && req.body.companyId) {
    const company = await Company.findByPk(req.body.companyId);
    if (!company) {
      return next(new AppError('Company not found', 404));
    }
    companyId = req.body.companyId;
  }
  
  // Update building
  await building.update({
    companyId,
    name: name || building.name,
    address: address || building.address,
    buildingType: buildingType || building.buildingType,
    totalUnits: totalUnits !== undefined ? totalUnits : building.totalUnits,
    description: description || building.description
  });
  
  res.status(200).json({
    status: 'success',
    data: building
  });
});

// Delete building
const deleteBuilding = catchAsync(async (req, res, next) => {
  const building = await Building.findByPk(req.params.id);
  
  if (!building) {
    return next(new AppError('Building not found', 404));
  }
  
  // If user is a manager, verify they belong to the same company
  if (req.user.role === 'manager' && req.user.companyId !== building.companyId) {
    return next(new AppError('You are not authorized to delete this building', 403));
  }
  
  await building.destroy();
  
  res.status(204).json({
    status: 'success',
    data: null
  });
});

// Get buildings by company ID
const getBuildingsByCompanyId = catchAsync(async (req, res, next) => {
  const companyId = req.params.companyId;
  
  // If user is a manager, they can only view buildings from their company
  if (req.user.role === 'manager' && req.user.companyId !== parseInt(companyId)) {
    return next(new AppError('You are not authorized to view buildings from this company', 403));
  }
  
  // Check if company exists
  const company = await Company.findByPk(companyId);
  if (!company) {
    return next(new AppError('Company not found', 404));
  }
  
  const buildings = await Building.findAll({
    where: { companyId }
  });
  
  res.status(200).json({
    status: 'success',
    results: buildings.length,
    data: buildings
  });
});

module.exports = {
  getAllBuildings,
  getBuildingById,
  createBuilding,
  updateBuilding,
  deleteBuilding,
  getBuildingsByCompanyId
};