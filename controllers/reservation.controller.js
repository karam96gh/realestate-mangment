const Reservation = require('../models/reservation.model');
const User = require('../models/user.model');
const RealEstateUnit = require('../models/realEstateUnit.model');
const Building = require('../models/building.model');
const Company = require('../models/company.model');
const { catchAsync, AppError } = require('../utils/errorHandler');
const generatePassword = require('../utils/generatePassword');
const fs = require('fs');
const path = require('path');
const { UPLOAD_PATHS } = require('../config/upload');
const { Op } = require('sequelize');


const getMyReservations = catchAsync(async (req, res) => {
  // Get reservations for the authenticated user
  console.log('User ID:', req.user.id);
  
  // First check if the user exists
  const user = await User.findByPk(req.user.id);
  if (!user) {
    console.log('User not found in database');
    return res.status(404).json({
      status: 'fail',
      message: 'User not found'
    });
  }
  
  // Count reservations for this user
  const reservationCount = await Reservation.count({
    where: { userId: req.user.id }
  });
  console.log('Reservation count for this user:', reservationCount);
  
  // Get the reservations with unit and building information
  const reservations = await Reservation.findAll({
    where: { userId: req.user.id },
    include: [
      { 
        model: RealEstateUnit, 
        as: 'unit',
        include: [
          {
            model: Building,
            as: 'building'
          }
        ] 
      }
    ],
    order: [['createdAt', 'DESC']]
  });
  
  // Return empty array if no reservations found
  res.status(200).json({
    status: 'success',
    results: reservations.length,
    data: reservations
  });
});
// Get all reservations
const getAllReservations = catchAsync(async (req, res, next) => {
  // المستأجرون لا يمكنهم رؤية كل الحجوزات
  if(req.user.role === 'tenant') {
    return next(new AppError('غير مصرح لك بعرض جميع الحجوزات', 403));
  }
  
  let whereCondition = {};
  let includeOptions = [
    { model: User, as: 'user', attributes: { exclude: ['password'] } },
    { 
      model: RealEstateUnit, 
      as: 'unit',
      include: [{
        model: Building,
        as: 'building',
        include: [{ model: Company, as: 'company' }]
      }]
    }
  ];
  
  // إذا كان المستخدم مديرًا، فقط إظهار حجوزات شركته
  if (req.user.role === 'manager') {
    if (!req.user.companyId) {
      return next(new AppError('المدير غير مرتبط بأي شركة', 403));
    }
    
    // نحتاج للتأكد من أن الاستعلام يتم بشكل صحيح
    // نحتاج لاستعلام متداخل للحصول على الحجوزات المرتبطة بشركة المدير
    const companyBuildings = await Building.findAll({
      where: { companyId: req.user.companyId },
      attributes: ['id']
    });
    
    const buildingIds = companyBuildings.map(building => building.id);
    
    const companyUnits = await RealEstateUnit.findAll({
      where: { buildingId: buildingIds },
      attributes: ['id']
    });
    
    const unitIds = companyUnits.map(unit => unit.id);
    
    whereCondition.unitId = { [Op.in]: unitIds };
  }
  
  const reservations = await Reservation.findAll({
    where: whereCondition,
    include: includeOptions
  });
  
  res.status(200).json({
    status: 'success',
    results: reservations.length,
    data: reservations
  });
});

const getReservationById = catchAsync(async (req, res, next) => {
  const reservation = await Reservation.findByPk(req.params.id, {
    include: [
      { model: User, as: 'user', attributes: { exclude: ['password'] } },
      { 
        model: RealEstateUnit, 
        as: 'unit',
        include: [{
          model: Building,
          as: 'building',
          include: [{ model: Company, as: 'company' }]
        }]
      }
    ]
  });
  
  if (!reservation) {
    return next(new AppError('لم يتم العثور على الحجز', 404));
  }
  
  // تحقق إذا كان المستخدم مستأجرًا، فيمكنه فقط رؤية حجوزاته الخاصة
  if (req.user.role === 'tenant' && reservation.userId !== req.user.id) {
    return next(new AppError('غير مصرح لك بعرض هذا الحجز', 403));
  }
  
  // تحقق إذا كان المستخدم مديرًا، فيمكنه فقط رؤية حجوزات شركته
  if (req.user.role === 'manager') {
    if (!req.user.companyId || req.user.companyId !== reservation.unit.building.companyId) {
      return next(new AppError('غير مصرح لك بعرض هذا الحجز', 403));
    }
  }
  
  res.status(200).json({
    status: 'success',
    data: reservation
  });
});

// Get reservation by ID


// Create new reservation (and create tenant user if not exists)
const createReservation = catchAsync(async (req, res, next) => {
    console.log('kkkk');

  const {
    userId,
    unitId,
    startDate,
    endDate,
    notes,
    // User info if new user is to be created
    fullName,
    email,
    phone
  } = req.body;
  const password = generatePassword(10);

  // Check if unit exists and is available
  const unit = await RealEstateUnit.findByPk(unitId);
  if (!unit) {
    return next(new AppError('Unit not found', 404));
  }
  
  if (unit.status !== 'available') {
    return next(new AppError('Unit is not available for reservation', 400));
  }
  
  let userToAssign;
    
  // If userId is provided, use existing user
  if (userId) {
    userToAssign = await User.findByPk(userId);
    if (!userToAssign) {
      return next(new AppError('User not found', 404));
    }
  } else {
    // Create new tenant user if not exists
    if (!fullName) {
      return next(new AppError('Full name is required for new tenant', 400));
    }
    
    // Generate username and password
    const username = `tenant${Date.now()}`;
    
    // Handle identity and commercial register images
    let identityImage = null;
    let commercialRegisterImage = null;
    
    if (req.files) {
      if (req.files.identityImage) {
        identityImage = req.files.identityImage[0].filename;
      }
      if (req.files.commercialRegisterImage) {
        commercialRegisterImage = req.files.commercialRegisterImage[0].filename;
      }
    }
    
    // Create new user
    userToAssign = await User.create({
      username,
      password,
      fullName,
      email,
      phone,
      role: 'tenant',
      identityImage,
      commercialRegisterImage
    });
  }
  
  // Handle contract image upload
  let contractImage = null;
  if (req.files && req.files.contractImage) {
    contractImage = req.files.contractImage[0].filename;
  }
  
  // Create reservation
  const newReservation = await Reservation.create({
    userId: userToAssign.id,
    unitId,
    startDate,
    endDate,
    contractImage,
    status: 'active',
    notes
  });
  
  // Update unit status to rented
  await unit.update({ status: 'rented' });
  
  // Return reservation with user credentials if a new user was created
  const responseData = {
    reservation: newReservation,
    unit: unit
  };
  
  // If new user was created, include credentials
  if (!userId) {
    responseData.newUser = {
      id: userToAssign.id,
      username: userToAssign.username,
      password: password, // Only sent once when created
      fullName: userToAssign.fullName
    };
  }
  
  res.status(201).json({
    status: 'success',
    data: responseData
  });
});

// Update reservation
const updateReservation = catchAsync(async (req, res, next) => {
  const { startDate, endDate, status, notes } = req.body;
  
  // Check if reservation exists
  const reservation = await Reservation.findByPk(req.params.id);
  if (!reservation) {
    return next(new AppError('Reservation not found', 404));
  }
  
  // Handle contract image upload if provided
  let contractImage = reservation.contractImage;
  if (req.file) {
    // Delete old contract image if it exists
    if (reservation.contractImage) {
      const oldContractPath = path.join(UPLOAD_PATHS.contracts, reservation.contractImage);
      if (fs.existsSync(oldContractPath)) {
        fs.unlinkSync(oldContractPath);
      }
    }
    contractImage = req.file.filename;
  }
  
  // Update reservation
  await reservation.update({
    startDate: startDate || reservation.startDate,
    endDate: endDate || reservation.endDate,
    contractImage,
    status: status || reservation.status,
    notes: notes || reservation.notes
  });
  
  // If status changed to cancelled or expired, update unit status to available
  if ((status === 'cancelled' || status === 'expired') && reservation.status === 'active') {
    const unit = await RealEstateUnit.findByPk(reservation.unitId);
    if (unit) {
      await unit.update({ status: 'available' });
    }
  }
  
  res.status(200).json({
    status: 'success',
    data: reservation
  });
});

// Delete reservation
const deleteReservation = catchAsync(async (req, res, next) => {
  const reservation = await Reservation.findByPk(req.params.id);
  
  if (!reservation) {
    return next(new AppError('Reservation not found', 404));
  }
  
  // Delete contract image if it exists
  if (reservation.contractImage) {
    const contractPath = path.join(UPLOAD_PATHS.contracts, reservation.contractImage);
    if (fs.existsSync(contractPath)) {
      fs.unlinkSync(contractPath);
    }
  }
  
  // Update unit status to available if reservation was active
  if (reservation.status === 'active') {
    const unit = await RealEstateUnit.findByPk(reservation.unitId);
    if (unit) {
      await unit.update({ status: 'available' });
    }
  }
  
  await reservation.destroy();
  
  res.status(204).json({
    status: 'success',
    data: null
  });
});

// Get reservations by unit ID
const getReservationsByUnitId = catchAsync(async (req, res) => {
  const reservations = await Reservation.findAll({
    where: { unitId: req.params.unitId },
    include: [
      { model: User, as: 'user', attributes: { exclude: ['password'] } }
    ]
  });
  
  res.status(200).json({
    status: 'success',
    results: reservations.length,
    data: reservations
  });
});

// Get reservations by user ID
const getReservationsByUserId = catchAsync(async (req, res) => {
  const reservations = await Reservation.findAll({
    where: { userId: req.params.userId },
    include: [
      { model: RealEstateUnit, as: 'unit' }
    ]
  });
  
  res.status(200).json({
    status: 'success',
    results: reservations.length,
    data: reservations
  });
});

module.exports = {
  getAllReservations,
  getReservationById,
  createReservation,
  updateReservation,
  deleteReservation,
  getReservationsByUnitId,
  getReservationsByUserId,
  getMyReservations
};