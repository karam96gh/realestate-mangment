// controllers/building.controller.js
const Building = require('../models/building.model');
const Company = require('../models/company.model');
const RealEstateUnit = require('../models/realEstateUnit.model');
const Reservation = require('../models/reservation.model');
const ServiceOrder = require('../models/serviceOrder.model');

const User = require('../models/user.model');
const { catchAsync, AppError } = require('../utils/errorHandler');
const { Op } = require('sequelize');
// Get all buildings
const getAllBuildings = catchAsync(async (req, res, next) => {
  let whereCondition = {};
  let includeConditions = [
    { model: Company, as: 'company' }
  ];
  
  if (req.user.role === 'admin') {
    // Admin يمكنه رؤية جميع البنايات
    // لا توجد قيود
  } 
  else if (req.user.role === 'manager'||req.user.role === 'accountant') {
    // المدير يرى فقط بنايات شركته
    if (!req.user.companyId) {
      return next(new AppError('المدير غير مرتبط بأي شركة', 403));
    }
    whereCondition.companyId = req.user.companyId;
  } 
  else if (req.user.role === 'owner') {
    // تحديد نوع المستأجر: مستأجر عادي أم مالك
    // الحصول على الوحدات المملوكة للمستخدم
    const ownedUnits = await RealEstateUnit.findAll({
      where: { ownerId: req.user.id },
      attributes: ['buildingId'],
      group: ['buildingId']
    });
    
    if (ownedUnits.length > 0) {
      // المستخدم مالك - إظهار البنايات التي يملك فيها وحدات
      const buildingIds = ownedUnits.map(unit => unit.buildingId);
      whereCondition.id = { [Op.in]: buildingIds };
      
      // إضافة معلومات الوحدات المملوكة في كل بناية
      includeConditions.push({
        model: RealEstateUnit,
        as: 'units',
        where: { ownerId: req.user.id },
        attributes: ['id', 'unitNumber', 'unitType', 'price', 'status'],
        required: false
      });
    }
  }
  else {
    // دور غير معروف
    return next(new AppError('دور المستخدم غير صحيح', 403));
  }
  
  const buildings = await Building.findAll({
    where: whereCondition,
    include: includeConditions,
    order: [['name', 'ASC']]
  });
  
  // إضافة معلومات إضافية للاستجابة
  let responseData = buildings;
  let additionalInfo = {};
  
  if (req.user.role === 'owner') {
    // إضافة إحصائيات للمستأجر/المالك
    const ownedUnitsCount = await RealEstateUnit.count({
      where: { ownerId: req.user.id }
    });
    
    const activeReservationsCount = await Reservation.count({
      where: { 
        userId: req.user.id,
        status: { [Op.in]: ['active', 'pending'] }
      }
    });
    
    additionalInfo = {
      userStats: {
        ownedUnitsCount,
        activeReservationsCount,
        userType: ownedUnitsCount > 0 ? 'owner' : 'tenant'
      }
    };
  }
  
  res.status(200).json({
    status: 'success',
    results: buildings.length,
    data: responseData,
    ...additionalInfo
  });
});

const getBuildingById = catchAsync(async (req, res, next) => {
  let includeConditions = [
    { model: Company, as: 'company' }
  ];
  
  const building = await Building.findByPk(req.params.id, {
    include: includeConditions
  });
  
  if (!building) {
    return next(new AppError('لم يتم العثور على البناية', 404));
  }
  
  // تحقق من الصلاحيات والوصول
  if (req.user.role === 'manager' || req.user.role === 'accountant') {
    if (req.user.companyId !== building.companyId) {
      return next(new AppError('غير مصرح لك بعرض هذه البناية', 403));
    }
  } 
  else if (req.user.role === 'tenant') {
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
  else if (req.user.role === 'owner') {
    // التحقق من أن المالك يملك وحدات في هذه البناية
    const ownedUnitsInBuilding = await RealEstateUnit.count({
      where: { 
        ownerId: req.user.id,
        buildingId: building.id 
      }
    });
    
    if (ownedUnitsInBuilding === 0) {
      return next(new AppError('غير مصرح لك بعرض هذه البناية - لا تملك وحدات فيها', 403));
    }
  }
  
  // إعداد البيانات الأساسية للاستجابة
  let responseData = building.toJSON();
  let additionalInfo = {};
  
  // إضافة معلومات خاصة للمالك
  if (req.user.role === 'owner') {
    // جلب الوحدات المملوكة في هذه البناية مع تفاصيل كاملة
    const ownedUnits = await RealEstateUnit.findAll({
      where: { 
        ownerId: req.user.id,
        buildingId: building.id 
      },
      include: [{
        model: User,
        as: 'owner',
        attributes: ['id', 'fullName', 'email', 'phone'],
        required: false
      }],
      order: [['unitNumber', 'ASC']]
    });
    
    // تحويل بيانات الوحدات لإضافة المعلومات المستخرجة
    const unitsWithCompleteInfo = ownedUnits.map(unit => {
      const unitData = unit.toJSON();
      return {
        // معلومات الوحدة الأساسية
        id: unitData.id,
        unitNumber: unitData.unitNumber,
        unitType: unitData.unitType,
        unitLayout: unitData.unitLayout,
        floor: unitData.floor,
        area: unitData.area,
        bathrooms: unitData.bathrooms,
        parkingNumber: unitData.parkingNumber,
        price: unitData.price,
        status: unitData.status,
        description: unitData.description,
        
        // معلومات المالك المستخرجة
        ownerName: unitData.owner ? unitData.owner.fullName : null,
        ownerEmail: unitData.owner ? unitData.owner.email : null,
        ownerPhone: unitData.owner ? unitData.owner.phone : null,
        
        // الكائن الأصلي للمرجعية
        owner: unitData.owner
      };
    });
    
    // إحصائيات الوحدات المملوكة في هذه البناية
    const unitStats = {
      totalOwnedUnits: ownedUnits.length,
      availableUnits: ownedUnits.filter(unit => unit.status === 'available').length,
      rentedUnits: ownedUnits.filter(unit => unit.status === 'rented').length,
      maintenanceUnits: ownedUnits.filter(unit => unit.status === 'maintenance').length,
      totalRevenue: ownedUnits
        .filter(unit => unit.status === 'rented')
        .reduce((sum, unit) => sum + parseFloat(unit.price), 0)
    };
    
    // معلومات الحجوزات النشطة للوحدات المملوكة
    const activeReservations = await Reservation.findAll({
      where: {
        status: { [Op.in]: ['active', 'pending'] }
      },
      include: [{
        model: RealEstateUnit,
        as: 'unit',
        where: { 
          ownerId: req.user.id,
          buildingId: building.id 
        },
        attributes: ['id', 'unitNumber']
      }, {
        model: User,
        as: 'user',
        attributes: ['id', 'fullName', 'phone', 'email']
      }],
      order: [['startDate', 'DESC']]
    });
    
    // طلبات الخدمة المعلقة للوحدات المملوكة
    const pendingServiceOrders = await ServiceOrder.count({
      where: { status: 'pending' },
      include: [{
        model: Reservation,
        as: 'reservation',
        include: [{
          model: RealEstateUnit,
          as: 'unit',
          where: { 
            ownerId: req.user.id,
            buildingId: building.id 
          }
        }]
      }]
    });
    
    // إضافة المعلومات للاستجابة
    responseData.ownedUnits = unitsWithCompleteInfo;
    
    additionalInfo = {
      ownerInfo: {
        buildingStats: unitStats,
        occupancyRate: unitStats.totalOwnedUnits > 0 ? 
          ((unitStats.rentedUnits / unitStats.totalOwnedUnits) * 100).toFixed(2) : 0,
        monthlyRevenue: unitStats.totalRevenue,
        activeReservations: activeReservations.length,
        pendingServiceOrders
      },
      activeReservationDetails: activeReservations.map(reservation => ({
        id: reservation.id,
        unitNumber: reservation.unit.unitNumber,
        tenantName: reservation.user.fullName,
        tenantPhone: reservation.user.phone,
        startDate: reservation.startDate,
        endDate: reservation.endDate,
        status: reservation.status
      }))
    };
  }
  
  // للمديرين والمحاسبين - إضافة معلومات عامة عن البناية
  else if (req.user.role === 'manager' || req.user.role === 'accountant') {
    // إحصائيات عامة للبناية
    const [
      totalUnits,
      availableUnits,
      rentedUnits,
      maintenanceUnits,
      totalRevenue,
      activeReservations
    ] = await Promise.all([
      RealEstateUnit.count({ where: { buildingId: building.id } }),
      RealEstateUnit.count({ where: { buildingId: building.id, status: 'available' } }),
      RealEstateUnit.count({ where: { buildingId: building.id, status: 'rented' } }),
      RealEstateUnit.count({ where: { buildingId: building.id, status: 'maintenance' } }),
      RealEstateUnit.sum('price', { where: { buildingId: building.id, status: 'rented' } }),
      Reservation.count({
        where: { status: { [Op.in]: ['active', 'pending'] } },
        include: [{
          model: RealEstateUnit,
          as: 'unit',
          where: { buildingId: building.id }
        }]
      })
    ]);
    
    additionalInfo = {
      buildingStats: {
        totalUnits,
        availableUnits,
        rentedUnits,
        maintenanceUnits,
        occupancyRate: totalUnits > 0 ? ((rentedUnits / totalUnits) * 100).toFixed(2) : 0,
        monthlyRevenue: totalRevenue || 0,
        activeReservations
      }
    };
  }
  
  // للمستأجرين - إضافة معلومات حجوزاتهم في هذه البناية
  else if (req.user.role === 'tenant') {
    const userReservations = await Reservation.findAll({
      where: { userId: req.user.id },
      include: [{
        model: RealEstateUnit,
        as: 'unit',
        where: { buildingId: building.id },
        attributes: ['id', 'unitNumber', 'unitType', 'price']
      }],
      order: [['createdAt', 'DESC']]
    });
    
    additionalInfo = {
      tenantInfo: {
        reservationsInBuilding: userReservations.length,
        reservationDetails: userReservations.map(reservation => ({
          id: reservation.id,
          unitNumber: reservation.unit.unitNumber,
          unitType: reservation.unit.unitType,
          price: reservation.unit.price,
          startDate: reservation.startDate,
          endDate: reservation.endDate,
          status: reservation.status
        }))
      }
    };
  }
  
  res.status(200).json({
    status: 'success',
    data: responseData,
    ...additionalInfo
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