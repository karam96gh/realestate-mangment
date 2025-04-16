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
const { addFileUrls } = require('../utils/filePath');

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
  
  // Add file URLs to each reservation
  const reservationsWithUrls = reservations.map(reservation => 
    addFileUrls(reservation.toJSON(), { contractImage: 'contracts' })
  );
  
  // Return empty array if no reservations found
  res.status(200).json({
    status: 'success',
    results: reservations.length,
    data: reservationsWithUrls
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
  
  // Add file URLs to reservations and users
  const reservationsWithUrls = reservations.map(reservation => {
    const reservationJson = reservation.toJSON();
    
    // Add contract URL to reservation
    const reservationWithUrl = addFileUrls(reservationJson, { contractImage: 'contracts' });
    
    // Add identity URLs to user if present
    if (reservationWithUrl.user) {
      reservationWithUrl.user = addFileUrls(reservationWithUrl.user, {
        identityImage: 'identities',
        commercialRegisterImage: 'identities'
      });
    }
    
    return reservationWithUrl;
  });
  
  res.status(200).json({
    status: 'success',
    results: reservations.length,
    data: reservationsWithUrls
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
  
  // Add file URLs to reservation and user
  const reservationJson = reservation.toJSON();
  
  // Add contract URL to reservation
  const reservationWithUrl = addFileUrls(reservationJson, { contractImage: 'contracts' });
  
  // Add identity URLs to user if present
  if (reservationWithUrl.user) {
    reservationWithUrl.user = addFileUrls(reservationWithUrl.user, {
      identityImage: 'identities',
      commercialRegisterImage: 'identities'
    });
  }
  
  res.status(200).json({
    status: 'success',
    data: reservationWithUrl
  });
});

// Create new reservation (and create tenant user if not exists)
// Actualiza esta parte del método createReservation en controllers/reservation.controller.js

const createReservation = catchAsync(async (req, res, next) => {
  console.log('بدء إنشاء الحجز');
  console.log('بيانات الطلب:', req.body);
  console.log('الملفات المستلمة:', req.files);

  const {
    userId,
    unitId,
    startDate,
    endDate,
    notes,
    // معلومات المستخدم إذا كان سيتم إنشاء مستخدم جديد
    fullName,
    email,
    phone
  } = req.body;
  
  const password = generatePassword(10);

  // التحقق من وجود الوحدة وتوفرها
  const unit = await RealEstateUnit.findByPk(unitId);
  if (!unit) {
    return next(new AppError('الوحدة غير موجودة', 404));
  }
  
  if (unit.status !== 'available') {
    return next(new AppError('الوحدة غير متاحة للحجز', 400));
  }
  
  // التحقق من عدم وجود حجوزات متداخلة
  const overlappingReservation = await Reservation.findOne({
    where: {
      unitId,
      status: 'active',
      [Op.or]: [
        {
          startDate: { [Op.lte]: endDate },
          endDate: { [Op.gte]: startDate }
        }
      ]
    }
  });
  
  if (overlappingReservation) {
    return next(new AppError('الوحدة محجوزة بالفعل خلال هذه الفترة', 400));
  }
  
  let userToAssign;
    
  // إذا تم توفير userId، استخدم المستخدم الموجود
  if (userId) {
    userToAssign = await User.findByPk(userId);
    if (!userToAssign) {
      return next(new AppError('المستخدم غير موجود', 404));
    }
  } else {
    // إنشاء مستخدم مستأجر جديد إذا لم يكن موجودًا
    if (!fullName) {
      return next(new AppError('الاسم الكامل مطلوب للمستأجر الجديد', 400));
    }
    
    // إنشاء اسم مستخدم وكلمة مرور
    const username = `tenant${Date.now()}`;
    
    // معالجة صور الهوية والسجل التجاري
    let identityImage = null;
    let commercialRegisterImage = null;
    
    // التحقق من وجود ملفات مرفوعة
    console.log('معالجة ملفات الهوية...');
    if (req.files) {
      if (req.files.identityImage && req.files.identityImage.length > 0) {
        identityImage = req.files.identityImage[0].filename;
        console.log('تم استلام صورة الهوية:', identityImage);
      } else {
        console.log('لم يتم العثور على صورة الهوية');
      }
      
      if (req.files.commercialRegisterImage && req.files.commercialRegisterImage.length > 0) {
        commercialRegisterImage = req.files.commercialRegisterImage[0].filename;
        console.log('تم استلام صورة السجل التجاري:', commercialRegisterImage);
      } else {
        console.log('لم يتم العثور على صورة السجل التجاري');
      }
    } else {
      console.log('لم يتم استلام ملفات في req.files');
    }
    
    // إنشاء مستخدم جديد
    console.log('إنشاء مستخدم مستأجر جديد بالبيانات:', {
      username, fullName, email, phone, identityImage, commercialRegisterImage
    });
    
    try {
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
      
      console.log('تم إنشاء مستخدم مستأجر بالمعرف:', userToAssign.id);
    } catch (error) {
      console.error('خطأ في إنشاء المستخدم:', error);
      return next(new AppError('فشل في إنشاء حساب المستأجر: ' + error.message, 500));
    }
  }
  
  // معالجة صورة العقد
  let contractImage = null;
  console.log('معالجة صورة العقد...');
  if (req.files && req.files.contractImage && req.files.contractImage.length > 0) {
    contractImage = req.files.contractImage[0].filename;
    console.log('تم استلام صورة العقد:', contractImage);
  } else {
    console.log('لم يتم العثور على صورة العقد');
  }
  
  // إنشاء الحجز
  console.log('إنشاء حجز بالبيانات:', {
    userId: userToAssign.id,
    unitId,
    startDate,
    endDate,
    contractImage,
    status: 'active',
    notes
  });
  
  let newReservation;
  try {
    newReservation = await Reservation.create({
      userId: userToAssign.id,
      unitId,
      startDate,
      endDate,
      contractImage,
      status: 'active',
      notes
    });
    
    console.log('تم إنشاء الحجز بالمعرف:', newReservation.id);
    
    // تحديث حالة الوحدة إلى مؤجرة
    await unit.update({ status: 'rented' });
    console.log('تم تحديث حالة الوحدة إلى: مؤجرة');
  } catch (error) {
    console.error('خطأ في إنشاء الحجز:', error);
    return next(new AppError('فشل في إنشاء الحجز: ' + error.message, 500));
  }
  
  // إضافة روابط الملفات إن وجدت
  let responseReservation = newReservation.toJSON();
  if (contractImage) {
    responseReservation = addFileUrls(responseReservation, { contractImage: 'contracts' });
  }
  
  // إعادة الحجز مع بيانات المستخدم إذا تم إنشاء مستخدم جديد
  const responseData = {
    reservation: responseReservation,
    unit: unit
  };
  
  // إذا تم إنشاء مستخدم جديد، تضمين بيانات الاعتماد
  if (!userId) {
    let responseUser = userToAssign.toJSON();
    
    // إضافة روابط الصور إن وجدت
    responseUser = addFileUrls(responseUser, {
      identityImage: 'identities',
      commercialRegisterImage: 'identities'
    });
    
    responseData.newUser = {
      ...responseUser,
      password // ترسل مرة واحدة فقط عند الإنشاء
    };
  }
  
  console.log('تم إكمال الحجز بنجاح');
  
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
  
  // Add contract URL to response
  const reservationWithUrl = addFileUrls(reservation.toJSON(), { contractImage: 'contracts' });
  
  res.status(200).json({
    status: 'success',
    data: reservationWithUrl
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
  
  // Add contract URLs and user identity URLs
  const reservationsWithUrls = reservations.map(reservation => {
    const reservationJson = reservation.toJSON();
    
    // Add contract URL
    const reservationWithUrl = addFileUrls(reservationJson, { contractImage: 'contracts' });
    
    // Add user identity URLs if present
    if (reservationWithUrl.user) {
      reservationWithUrl.user = addFileUrls(reservationWithUrl.user, {
        identityImage: 'identities',
        commercialRegisterImage: 'identities'
      });
    }
    
    return reservationWithUrl;
  });
  
  res.status(200).json({
    status: 'success',
    results: reservations.length,
    data: reservationsWithUrls
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
  
  // Add contract URLs
  const reservationsWithUrls = reservations.map(reservation => 
    addFileUrls(reservation.toJSON(), { contractImage: 'contracts' })
  );
  
  res.status(200).json({
    status: 'success',
    results: reservations.length,
    data: reservationsWithUrls
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