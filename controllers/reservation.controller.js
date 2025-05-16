// controllers/reservation.controller.js

const Reservation = require('../models/reservation.model');
const User = require('../models/user.model');
const Tenant = require('../models/tenant.model');
const RealEstateUnit = require('../models/realEstateUnit.model');
const Building = require('../models/building.model');
const Company = require('../models/company.model');
const { catchAsync, AppError } = require('../utils/errorHandler');
const fs = require('fs');
const path = require('path');
const { UPLOAD_PATHS } = require('../config/upload');
const { Op } = require('sequelize');
const generatePassword = require('../utils/generatePassword');
const { generatePaymentSchedule } = require('../utils/paymentScheduler');
const PaymentHistory = require('../models/paymentHistory.model');
const sequelize = require('../config/database');

// الحصول على حجوزاتي
const getMyReservations = catchAsync(async (req, res) => {
  // الحصول على حجوزات المستخدم المصادق عليه
  console.log('User ID:', req.user.id);
  
  // التحقق أولاً من وجود المستخدم
  const user = await User.findByPk(req.user.id);
  if (!user) {
    console.log('User not found in database');
    return res.status(404).json({
      status: 'fail',
      message: 'User not found'
    });
  }
  
  // حساب عدد الحجوزات لهذا المستخدم
  const reservationCount = await Reservation.count({
    where: { userId: req.user.id }
  });
  console.log('Reservation count for this user:', reservationCount);
  
  // الحصول على الحجوزات مع معلومات الوحدة والمبنى
  const reservations = await Reservation.findAll({
    where: { userId: req.user.id },
    include: [
      { 
        model: RealEstateUnit, 
        as: 'unit',
        include: [{
          model: Building,
          as: 'building',
          include: [{ model: Company, as: 'company' }]
        }]
      }
    ],
    order: [['createdAt', 'DESC']]
  });
  
  // إرجاع مصفوفة الحجوزات مع المعلومات التفصيلية
  res.status(200).json({
    status: 'success',
    results: reservations.length,
    data: reservations
  });
});

// الحصول على جميع الحجوزات
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
  
  // إذا كان المستخدم مديرًا، يُظهر فقط حجوزات شركته
  if (req.user.role === 'manager') {
    if (!req.user.companyId) {
      return next(new AppError('المدير غير مرتبط بأي شركة', 403));
    }
    
    // نحتاج إلى استعلامات متداخلة للحصول على الحجوزات المرتبطة بشركة المدير
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

// الحصول على حجز حسب المعرف
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
  
  // التحقق إذا كان المستخدم مستأجرًا، فيمكنه فقط رؤية حجوزاته الخاصة
  if (req.user.role === 'tenant' && reservation.userId !== req.user.id) {
    return next(new AppError('غير مصرح لك بعرض هذا الحجز', 403));
  }
  
  // التحقق إذا كان المستخدم مديرًا، فيمكنه فقط رؤية حجوزات شركته
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

// إنشاء حجز جديد
// إنشاء حجز جديد مع إنشاء مستأجر جديد
const createReservation = catchAsync(async (req, res, next) => {
  console.log("Files received:", req.files); // سجل تصحيح
  console.log("Form data:", req.body);       // سجل تصحيح
    const transaction = await sequelize.transaction();

  const {
    unitId,
    contractType,
    startDate,
    endDate,
    paymentMethod,
    paymentSchedule,
    includesDeposit,
    depositAmount,
    notes,
    // بيانات المستأجر الجديد
    tenantFullName,
    tenantEmail,
    tenantPhone,
    tenantWhatsappNumber,
    tenantIdNumber,
    tenantType,
    tenantBusinessActivities,
    tenantContactPerson,
    tenantContactPosition,
    tenantNotes
  } = req.body;
  
  // التحقق من وجود الوحدة وما إذا كانت متاحة
  const unit = await RealEstateUnit.findByPk(unitId);
  if (!unit) {
    return next(new AppError('الوحدة غير موجودة', 404));
  }
  
  if (unit.status !== 'available') {
    return next(new AppError('الوحدة غير متاحة للحجز', 400));
  }
  
  // التحقق من البيانات المطلوبة للمستأجر الجديد
  if (!tenantFullName) {
    return next(new AppError('اسم المستأجر مطلوب', 400));
  }
  
  try {
    // معالجة الملفات المرفقة
    let contractImage = null;
    let contractPdf = null;
    let identityImageFront = null;
    let identityImageBack = null;
    let commercialRegisterImage = null;
      
    if (req.files) {
      if (req.files.contractImage && req.files.contractImage.length > 0) {
        contractImage = req.files.contractImage[0].filename;
        console.log("Contract image saved:", contractImage);
      }
      
      if (req.files.contractPdf && req.files.contractPdf.length > 0) {
        contractPdf = req.files.contractPdf[0].filename;
        console.log("Contract PDF saved:", contractPdf);
      }
      
      if (req.files.identityImageFront && req.files.identityImageFront.length > 0) {
        identityImageFront = req.files.identityImageFront[0].filename;
        console.log("Identity front image saved:", identityImageFront);
      }
      
      if (req.files.identityImageBack && req.files.identityImageBack.length > 0) {
        identityImageBack = req.files.identityImageBack[0].filename;
        console.log("Identity back image saved:", identityImageBack);
      }
      
      if (req.files.commercialRegisterImage && req.files.commercialRegisterImage.length > 0) {
        commercialRegisterImage = req.files.commercialRegisterImage[0].filename;
        console.log("Commercial register image saved:", commercialRegisterImage);
      }
    }
    
    // إنشاء اسم مستخدم فريد
    const baseUsername = tenantFullName.replace(/\s+/g, '_').toLowerCase();
    const timestamp = Date.now().toString().slice(-6);
    const username = `${baseUsername}_${timestamp}`;
    
    // إنشاء كلمة مرور عشوائية
    const password = generatePassword(8);
    
    // إنشاء مستخدم جديد من نوع مستأجر
    const user = await User.create({
      username,
      password, // سيتم تشفيرها تلقائيًا بواسطة hooks في النموذج
      fullName: tenantFullName,
      email: tenantEmail,
      phone: tenantPhone,
      whatsappNumber: tenantWhatsappNumber,
      idNumber: tenantIdNumber,
      identityImageFront,
      identityImageBack,
      commercialRegisterImage,
      role: 'tenant'
    });
    
    // إنشاء سجل مستأجر مرتبط بالمستخدم
    const tenant = await Tenant.create({
      userId: user.id,
      tenantType: tenantType || 'person',
      businessActivities: tenantBusinessActivities,
      contactPerson: tenantContactPerson,
      contactPosition: tenantContactPosition,
      notes: tenantNotes
    });
    
    // إنشاء الحجز
    const newReservation = await Reservation.create({
      userId: user.id, // استخدام معرف المستخدم الجديد
      unitId,
      contractType: contractType || 'residential',
      startDate,
      endDate,
      contractImage,
      contractPdf,
      paymentMethod: paymentMethod || 'cash',
      paymentSchedule: paymentSchedule || 'monthly',
      includesDeposit: includesDeposit === 'true' || includesDeposit === true,
      depositAmount: depositAmount || null,
      status: 'active',
      notes
    });
    
    // تحديث حالة الوحدة إلى مؤجرة
    await unit.update({ status: 'rented' });
    
    const totalRentalAmount = unit.price;
    const paymentScheduleData = generatePaymentSchedule(newReservation, totalRentalAmount);
 const paymentPromises = paymentScheduleData.map(paymentData => {
      return PaymentHistory.create({
        reservationId: newReservation.id,
        amount: paymentData.amount,
        paymentDate: paymentData.paymentDate,
        paymentMethod: newReservation.paymentMethod,
        status: 'pending',
        notes: paymentData.notes
      }, { transaction });
    });
        const createdPayments = await Promise.all(paymentPromises);
    await transaction.commit();






    // إنشاء عناوين URL للملفات
    const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
    
    // إرجاع بيانات الحجز وبيانات دخول المستأجر
    const responseData = {
      reservation: {
        ...newReservation.get({ plain: true }),
        contractImageUrl: contractImage ? `${BASE_URL}/uploads/contracts/${contractImage}` : null,
        contractPdfUrl: contractPdf ? `${BASE_URL}/uploads/contracts/${contractPdf}` : null
      },
      unit: unit,
      tenant: {
        ...tenant.get({ plain: true }),
        user: {
          ...user.toJSON(), // استخدام toJSON لضمان عدم إرجاع كلمة المرور المشفرة
          // إضافة كلمة المرور النصية للإرجاع مرة واحدة فقط
          rawPassword: password
        }
      },
            paymentSchedule: createdPayments.map(payment => payment.toJSON())

    };
    
    res.status(201).json({
      status: 'success',
      data: responseData
    });
  } catch (error) {
    // حذف الملفات المرفقة في حالة فشل الإنشاء
    // تنظيف الملفات إذا تم رفعها
        await transaction.rollback();

    if (req.files) {
      Object.keys(req.files).forEach(fieldName => {
        req.files[fieldName].forEach(file => {
          const filePath = path.join(
            fieldName.includes('contract') ? UPLOAD_PATHS.contracts : UPLOAD_PATHS.identities, 
            file.filename
          );
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        });
      });
    }
    
    // رمي الخطأ لمعالجته في وحدة التحكم بالأخطاء المركزية
    throw error;
  }
});
// تحديث حجز
const updateReservation = catchAsync(async (req, res, next) => {
  const { 
    contractType,
    startDate, 
    endDate, 
    status, 
    paymentMethod,
    paymentSchedule,
    includesDeposit,
    depositAmount,
    notes
  } = req.body;
  
  // التحقق من وجود الحجز
  const reservation = await Reservation.findByPk(req.params.id);
  if (!reservation) {
    return next(new AppError('الحجز غير موجود', 404));
  }
  
  // معالجة الملفات المرفقة
  let contractImage = reservation.contractImage;
  let contractPdf = reservation.contractPdf;
  
  if (req.files) {
    // معالجة صورة العقد إذا تم توفيرها
    if (req.files.contractImage && req.files.contractImage.length > 0) {
      // حذف صورة العقد القديمة إذا وجدت
      if (reservation.contractImage) {
        const oldContractPath = path.join(UPLOAD_PATHS.contracts, reservation.contractImage);
        if (fs.existsSync(oldContractPath)) {
          fs.unlinkSync(oldContractPath);
        }
      }
      contractImage = req.files.contractImage[0].filename;
    }
    
    // معالجة ملف العقد PDF إذا تم توفيره
    if (req.files.contractPdf && req.files.contractPdf.length > 0) {
      // حذف ملف العقد القديم إذا وجد
      if (reservation.contractPdf) {
        const oldPdfPath = path.join(UPLOAD_PATHS.contracts, reservation.contractPdf);
        if (fs.existsSync(oldPdfPath)) {
          fs.unlinkSync(oldPdfPath);
        }
      }
      contractPdf = req.files.contractPdf[0].filename;
    }
  }
  
  // تحديث الحجز
  await reservation.update({
    contractType: contractType || reservation.contractType,
    startDate: startDate || reservation.startDate,
    endDate: endDate || reservation.endDate,
    contractImage,
    contractPdf,
    paymentMethod: paymentMethod || reservation.paymentMethod,
    paymentSchedule: paymentSchedule || reservation.paymentSchedule,
    includesDeposit: includesDeposit !== undefined ? 
      (includesDeposit === 'true' || includesDeposit === true) : 
      reservation.includesDeposit,
    depositAmount: depositAmount !== undefined ? depositAmount : reservation.depositAmount,
    status: status || reservation.status,
    notes: notes !== undefined ? notes : reservation.notes
  });
  
  // إذا تغيرت الحالة إلى ملغاة أو منتهية، قم بتحديث حالة الوحدة إلى متاحة
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

// حذف حجز
const deleteReservation = catchAsync(async (req, res, next) => {
  const reservation = await Reservation.findByPk(req.params.id);
  
  if (!reservation) {
    return next(new AppError('الحجز غير موجود', 404));
  }
  
  // حذف صورة العقد إذا وجدت
  if (reservation.contractImage) {
    const contractPath = path.join(UPLOAD_PATHS.contracts, reservation.contractImage);
    if (fs.existsSync(contractPath)) {
      fs.unlinkSync(contractPath);
    }
  }
  
  // حذف ملف العقد PDF إذا وجد
  if (reservation.contractPdf) {
    const pdfPath = path.join(UPLOAD_PATHS.contracts, reservation.contractPdf);
    if (fs.existsSync(pdfPath)) {
      fs.unlinkSync(pdfPath);
    }
  }
  
  // تحديث حالة الوحدة إلى متاحة إذا كان الحجز نشطًا
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

// الحصول على الحجوزات حسب معرف الوحدة
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

// الحصول على الحجوزات حسب معرف المستخدم
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