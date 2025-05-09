// controllers/building.controller.js
const Building = require('../models/building.model');
const Company = require('../models/company.model');
const RealEstateUnit = require('../models/realEstateUnit.model');
const Reservation = require('../models/reservation.model');
const User = require('../models/user.model');
const { catchAsync, AppError } = require('../utils/errorHandler');
const { Op } = require('sequelize');
// Get all buildings
const getAllBuildings = catchAsync(async (req, res) => {
  // إذا كان المستخدم مديرًا، فقط إظهار البنايات من شركته
  const whereCondition = {};
  
  if (req.user.role === 'manager') {
    if (!req.user.companyId) {
      return next(new AppError('المدير غير مرتبط بأي شركة', 403));
    }
    whereCondition.companyId = req.user.companyId;
  } else if (req.user.role === 'tenant') {
    // المستأجرون لا يمكنهم رؤية كل البنايات
    return next(new AppError('غير مصرح لك بعرض جميع البنايات', 403));
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

const getBuildingById = catchAsync(async (req, res, next) => {
  const building = await Building.findByPk(req.params.id, {
    include: [
      { model: Company, as: 'company' }
    ]
  });
  
  if (!building) {
    return next(new AppError('لم يتم العثور على البناية', 404));
  }
  
  // تحقق إذا كان المستخدم مديرًا أو مستأجرًا له علاقة بهذه البناية
  if (req.user.role === 'manager' && req.user.companyId !== building.companyId) {
    return next(new AppError('غير مصرح لك بعرض هذه البناية', 403));
  } else if (req.user.role === 'tenant') {
    // التحقق من وجود حجوزات للمستأجر في هذه البناية
    const hasReservation = await Reservation.findOne({
      where: { userId: req.user.id },
      include: [{
        model: RealEstateUnit,
        as: 'unit',
        where: { buildingId: building.id }
      }]
    });
    
    if (!hasReservation) {
      // بحث موسع عن كل الوحدات التي يستأجرها المستخدم
      const userReservations = await Reservation.findAll({
        where: { userId: req.user.id },
        include: [{
          model: RealEstateUnit,
          as: 'unit',
          attributes: ['buildingId']
        }]
      });
      
      const userBuildingIds = userReservations
        .filter(res => res.unit) // تأكد من وجود الوحدة
        .map(res => res.unit.buildingId);
        
      if (!userBuildingIds.includes(building.id)) {
        return next(new AppError('غير مصرح لك بعرض هذه البناية', 403));
      }
    }
  }
  
  res.status(200).json({
    status: 'success',
    data: building
  });
});


// تعديل دالة إنشاء المبنى
const createBuilding = catchAsync(async (req, res, next) => {
  let { 
    companyId, 
    buildingNumber,
    name, 
    address, 
    buildingType, 
    totalUnits, 
    totalFloors, 
    internalParkingSpaces,
    description 
  } = req.body;
  
  // If user is a manager, use their companyId and ignore any provided companyId
  if (req.user.role === 'manager') {
    if (!req.user.companyId) {
      return next(new AppError('المدير غير مرتبط بأي شركة', 400));
    }
    companyId = req.user.companyId;
  }
  
  // Check if company exists
  const company = await Company.findByPk(companyId);
  if (!company) {
    return next(new AppError('الشركة غير موجودة', 404));
  }
  
  const newBuilding = await Building.create({
    companyId,
    buildingNumber,
    name,
    address,
    buildingType,
    totalUnits,
    totalFloors: totalFloors || 1,
    internalParkingSpaces: internalParkingSpaces || 0,
    description
  });
  
  res.status(201).json({
    status: 'success',
    data: newBuilding
  });
});

// تعديل دالة تحديث المبنى
const updateBuilding = catchAsync(async (req, res, next) => {
  const building = await Building.findByPk(req.params.id);
  
  if (!building) {
    return next(new AppError('المبنى غير موجود', 404));
  }
  
  // If user is a manager, verify they belong to the same company
  if (req.user.role === 'manager' && req.user.companyId !== building.companyId) {
    return next(new AppError('غير مصرح لك بتحديث هذا المبنى', 403));
  }
  
  const { 
    buildingNumber,
    name, 
    address, 
    buildingType, 
    totalUnits, 
    totalFloors, 
    internalParkingSpaces,
    description 
  } = req.body;
  
  // If companyId is being updated, check if the new company exists
  // Only allow admins to change the companyId
  let companyId = building.companyId;
  if (req.user.role === 'admin' && req.body.companyId) {
    const company = await Company.findByPk(req.body.companyId);
    if (!company) {
      return next(new AppError('الشركة غير موجودة', 404));
    }
    companyId = req.body.companyId;
  }
  
  // Update building
  await building.update({
    companyId,
    buildingNumber: buildingNumber || building.buildingNumber,
    name: name || building.name,
    address: address || building.address,
    buildingType: buildingType || building.buildingType,
    totalUnits: totalUnits !== undefined ? totalUnits : building.totalUnits,
    totalFloors: totalFloors !== undefined ? totalFloors : building.totalFloors,
    internalParkingSpaces: internalParkingSpaces !== undefined ? internalParkingSpaces : building.internalParkingSpaces,
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