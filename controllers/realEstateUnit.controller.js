// Real Estate Unit controller 
const RealEstateUnit = require('../models/realEstateUnit.model');
const Building = require('../models/building.model');
const Company = require('../models/company.model');
const { catchAsync, AppError } = require('../utils/errorHandler');
const { Op } = require('sequelize');

// Get all units
const getAllUnits = catchAsync(async (req, res, next) => {
  // المستأجرون لا يمكنهم رؤية كل الوحدات
  if(req.user.role === 'tenant') {
    return next(new AppError('غير مصرح لك بعرض جميع الوحدات', 403));
  }
  
  // إذا كان المستخدم مديرًا، فقط إظهار وحدات شركته
  const whereCondition = {};
  let includeOptions = [
    { 
      model: Building, 
      as: 'building',
      include: [
        { model: Company, as: 'company' }
      ]
    }
  ];
  
  if (req.user.role === 'manager') {
    if (!req.user.companyId) {
      return next(new AppError('المدير غير مرتبط بأي شركة', 403));
    }
    includeOptions[0].where = { companyId: req.user.companyId };
  }
  
  const units = await RealEstateUnit.findAll({
    where: whereCondition,
    include: includeOptions
  });
  
  res.status(200).json({
    status: 'success',
    results: units.length,
    data: units
  });
});

const getUnitById = catchAsync(async (req, res, next) => {
  const unit = await RealEstateUnit.findByPk(req.params.id, {
    include: [
      { 
        model: Building, 
        as: 'building',
        include: [
          { model: Company, as: 'company' }
        ]
      }
    ]
  });
  
  if (!unit) {
    return next(new AppError('لم يتم العثور على الوحدة', 404));
  }
  
  // تحقق إذا كان المستخدم مديرًا للشركة المالكة للوحدة
  if (req.user.role === 'manager') {
    if (!req.user.companyId || req.user.companyId !== unit.building.companyId) {
      return next(new AppError('غير مصرح لك بعرض هذه الوحدة', 403));
    }
  } else if (req.user.role === 'tenant') {
    // التحقق من وجود حجوزات للمستأجر لهذه الوحدة
    const hasReservation = await Reservation.findOne({
      where: { 
        userId: req.user.id,
        unitId: unit.id
      }
    });
    
    if (!hasReservation) {
      return next(new AppError('غير مصرح لك بعرض هذه الوحدة', 403));
    }
  }
  
  res.status(200).json({
    status: 'success',
    data: unit
  });
});

// Get unit by ID


// Create new unit
const createUnit = catchAsync(async (req, res, next) => {
  const { 
    buildingId, 
    unitNumber, 
    floor, 
    area, 
    bedrooms, 
    bathrooms, 
    price, 
    status, 
    description 
  } = req.body;
  
  // Check if building exists
  const building = await Building.findByPk(buildingId);
  if (!building) {
    return next(new AppError('Building not found', 404));
  }
  
  const newUnit = await RealEstateUnit.create({
    buildingId,
    unitNumber,
    floor,
    area,
    bedrooms,
    bathrooms,
    price,
    status: status || 'available',
    description
  });
  
  res.status(201).json({
    status: 'success',
    data: newUnit
  });
});

// Update unit
const updateUnit = catchAsync(async (req, res, next) => {
  const unit = await RealEstateUnit.findByPk(req.params.id);
  
  if (!unit) {
    return next(new AppError('Unit not found', 404));
  }
  
  const { 
    unitNumber, 
    floor, 
    area, 
    bedrooms, 
    bathrooms, 
    price, 
    status, 
    description 
  } = req.body;
  
  // If buildingId is being updated, check if the new building exists
  if (req.body.buildingId) {
    const building = await Building.findByPk(req.body.buildingId);
    if (!building) {
      return next(new AppError('Building not found', 404));
    }
  }
  
  // Update unit
  await unit.update({
    buildingId: req.body.buildingId || unit.buildingId,
    unitNumber: unitNumber || unit.unitNumber,
    floor: floor !== undefined ? floor : unit.floor,
    area: area !== undefined ? area : unit.area,
    bedrooms: bedrooms !== undefined ? bedrooms : unit.bedrooms,
    bathrooms: bathrooms !== undefined ? bathrooms : unit.bathrooms,
    price: price !== undefined ? price : unit.price,
    status: status || unit.status,
    description: description || unit.description
  });
  
  res.status(200).json({
    status: 'success',
    data: unit
  });
});

// Delete unit
const deleteUnit = catchAsync(async (req, res, next) => {
  const unit = await RealEstateUnit.findByPk(req.params.id);
  
  if (!unit) {
    return next(new AppError('Unit not found', 404));
  }
  
  await unit.destroy();
  
  res.status(204).json({
    status: 'success',
    data: null
  });
});

// Get units by building ID
const getUnitsByBuildingId = catchAsync(async (req, res, next) => {
  const buildingId = req.params.buildingId;
  
  // Check if building exists
  const building = await Building.findByPk(buildingId);
  if (!building) {
    return next(new AppError('Building not found', 404));
  }
  
  const units = await RealEstateUnit.findAll({
    where: { buildingId }
  });
  
  res.status(200).json({
    status: 'success',
    results: units.length,
    data: units
  });
});

// Get all available units
const getAvailableUnits = catchAsync(async (req, res) => {
  // Filter parameters
  const { 
    minPrice, 
    maxPrice, 
    bedrooms, 
    bathrooms, 
    buildingId,
    companyId 
  } = req.query;
  
  // Build filter object
  const filter = {
    status: 'available'
  };
  
  // Add price range if provided
  if (minPrice !== undefined || maxPrice !== undefined) {
    filter.price = {};
    if (minPrice !== undefined) filter.price[Op.gte] = parseFloat(minPrice);
    if (maxPrice !== undefined) filter.price[Op.lte] = parseFloat(maxPrice);
  }
  
  // Add bedrooms if provided
  if (bedrooms !== undefined) {
    filter.bedrooms = parseInt(bedrooms);
  }
  
  // Add bathrooms if provided
  if (bathrooms !== undefined) {
    filter.bathrooms = parseInt(bathrooms);
  }
  
  // Add building filter
  if (buildingId !== undefined) {
    filter.buildingId = parseInt(buildingId);
  }
  
  // Include options
  const includeOptions = [
    { 
      model: Building, 
      as: 'building',
      include: [
        { model: Company, as: 'company' }
      ]
    }
  ];
  
  // Add company filter if provided
  if (companyId !== undefined) {
    includeOptions[0].where = { companyId: parseInt(companyId) };
  }
  
  const availableUnits = await RealEstateUnit.findAll({
    where: filter,
    include: includeOptions
  });
  
  res.status(200).json({
    status: 'success',
    results: availableUnits.length,
    data: availableUnits
  });
});

module.exports = {
  getAllUnits,
  getUnitById,
  createUnit,
  updateUnit,
  deleteUnit,
  getUnitsByBuildingId,
  getAvailableUnits
};