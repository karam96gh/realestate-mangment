// Real Estate Unit controller 
const RealEstateUnit = require('../models/realEstateUnit.model');
const Building = require('../models/building.model');
const Company = require('../models/company.model');
const Reservation = require('../models/reservation.model');
const User = require('../models/user.model');
const { catchAsync, AppError } = require('../utils/errorHandler');
const { Op } = require('sequelize');

// Get all units
// تعديل دالة getAllUnits في realEstateUnit.controller.js
const getAllUnits = catchAsync(async (req, res, next) => {
  // المستأجرون لا يمكنهم رؤية كل الوحدات
  if(req.user.role === 'tenant') {
    return next(new AppError('غير مصرح لك بعرض جميع الوحدات', 403));
  }
  
  // إذا كان المستخدم مديرًا، فقط إظهار وحدات شركته
  let whereCondition = {};
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

const getAvailableUnits = catchAsync(async (req, res, next) => {
  try {
    console.log("getAvailableUnits function called");
    console.log("Query parameters:", req.query);
    console.log("User:", req.user);
    
    // Get building ID from query
    const { buildingId } = req.query;
    
    // Build filter object
    const filter = {
      status: 'available'
    };
    
    // Add building filter if provided
    if (buildingId !== undefined) {
      filter.buildingId = parseInt(buildingId);
      console.log("Filtering by buildingId:", buildingId);
    }
    
    // Include options for eager loading related models
    const includeOptions = [
      { 
        model: Building, 
        as: 'building',
        include: [
          { model: Company, as: 'company' }
        ]
      }
    ];
    
    // If user is a manager, filter by their company ID
    if (req.user && req.user.role === 'manager' && req.user.companyId) {
      console.log("Manager filter applied, companyId:", req.user.companyId);
      includeOptions[0].where = { companyId: req.user.companyId };
    }
    
    console.log("Final filter:", JSON.stringify(filter));
    console.log("Include options:", JSON.stringify(includeOptions));
    
    // Find all available units matching the criteria
    const availableUnits = await RealEstateUnit.findAll({
      where: filter,
      include: includeOptions
    });
    
    console.log("Query successful, found units:", availableUnits.length);
    
    // Send response
    res.status(200).json({
      status: 'success',
      results: availableUnits.length,
      data: availableUnits
    });
  } catch (error) {
    console.error("Error in getAvailableUnits:", error);
    return next(new AppError('Error fetching available units: ' + error.message, 500));
  }
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
      // هنا نقوم بفحص إضافي للتحقق من رقم الوحدة في جميع حجوزات المستأجر
      const userReservations = await Reservation.findAll({
        where: { userId: req.user.id },
        attributes: ['unitId']
      });
      
      const userUnitIds = userReservations.map(res => res.unitId);
      if (!userUnitIds.includes(unit.id)) {
        return next(new AppError('غير مصرح لك بعرض هذه الوحدة', 403));
      }
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
    unitType,
    unitLayout,
    floor, 
    area, 
    // bedrooms field removed
    bathrooms, 
    price, 
    status, 
    description 
  } = req.body;
  
  // Check if building exists
  const building = await Building.findByPk(buildingId);
  if (!building) {
    return next(new AppError('المبنى غير موجود', 404));
  }
  
  // If user is a manager, verify they belong to the same company
  if (req.user.role === 'manager') {
    if (building.companyId !== req.user.companyId) {
      return next(new AppError('غير مصرح لك بإنشاء وحدات في مبنى لا ينتمي لشركتك', 403));
    }
  }
  
  const newUnit = await RealEstateUnit.create({
    buildingId,
    unitNumber,
    unitType,
    unitLayout,
    floor,
    area,
    // bedrooms removed
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

const updateUnit = catchAsync(async (req, res, next) => {
  const unit = await RealEstateUnit.findByPk(req.params.id, {
    include: [{ 
      model: Building, 
      as: 'building'
    }]
  });
  
  if (!unit) {
    return next(new AppError('الوحدة غير موجودة', 404));
  }
  
  // If user is a manager, verify they belong to the same company
  if (req.user.role === 'manager') {
    if (unit.building.companyId !== req.user.companyId) {
      return next(new AppError('غير مصرح لك بتعديل وحدات لا تنتمي لشركتك', 403));
    }
  }
  
  const { 
    unitNumber, 
    unitType,
    unitLayout,
    floor, 
    area, 
    // bedrooms removed
    bathrooms, 
    price, 
    status, 
    description 
  } = req.body;
  
  // If buildingId is being updated, check if the new building exists
  if (req.body.buildingId) {
    const building = await Building.findByPk(req.body.buildingId);
    if (!building) {
      return next(new AppError('المبنى غير موجود', 404));
    }
    
    // If user is a manager, verify the new building belongs to their company
    if (req.user.role === 'manager' && building.companyId !== req.user.companyId) {
      return next(new AppError('غير مصرح لك بنقل الوحدة إلى مبنى لا ينتمي لشركتك', 403));
    }
  }
  
  // Update unit
  await unit.update({
    buildingId: req.body.buildingId || unit.buildingId,
    unitNumber: unitNumber || unit.unitNumber,
    unitType: unitType || unit.unitType,
    unitLayout: unitLayout !== undefined ? unitLayout : unit.unitLayout,
    floor: floor !== undefined ? floor : unit.floor,
    area: area !== undefined ? area : unit.area,
    // bedrooms removed
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



module.exports = {
  getAllUnits,
  getUnitById,
  createUnit,
  updateUnit,
  deleteUnit,
  getUnitsByBuildingId,
  getAvailableUnits
};