// controllers/reservation.controller.js - تحديث مع التحقق المالي قبل الإلغاء

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

// ✅ استيراد دوال التحقق المالي
const { 
  canCancelReservation, 
  updatePendingPaymentsStatus,
  generateFinancialSummaryReport 
} = require('../utils/financialValidator');

// الحصول على حجوزاتي
const getMyReservations = catchAsync(async (req, res) => {
  console.log('User ID:', req.user.id);
  
  const user = await User.findByPk(req.user.id);
  if (!user) {
    console.log('User not found in database');
    return res.status(404).json({
      status: 'fail',
      message: 'User not found'
    });
  }
  
  const reservationCount = await Reservation.count({
    where: { userId: req.user.id }
  });
  console.log('Reservation count for this user:', reservationCount);
  
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
  
  res.status(200).json({
    status: 'success',
    results: reservations.length,
    data: reservations
  });
});

// استبدل دالة updateReservation في controllers/reservation.controller.js بهذه النسخة

const updateReservation = catchAsync(async (req, res, next) => {
  const { 
    contractType,
    startDate, 
    endDate, 
    status, 
    paymentMethod,      // ✅ سيتم تجاهل هذا الحقل
    paymentSchedule,    // ✅ سيتم تجاهل هذا الحقل
    
    // حقول التأمين المحدثة
    includesDeposit,
    depositAmount,
    depositPaymentMethod,
    depositStatus,
    depositPaidDate,
    depositReturnedDate,
    depositNotes,
    
    notes
  } = req.body;
  
  // التحقق من وجود الحجز مع معلومات المستأجر
  const reservation = await Reservation.findByPk(req.params.id, {
    include: [{
      model: User,
      as: 'user',
      attributes: { exclude: ['password'] },
      include: [{
        model: Tenant,
        as: 'tenantInfo',
        required: false
      }]
    }]
  });
  
  if (!reservation) {
    return next(new AppError('الحجز غير موجود', 404));
  }
  
  // ***** حفظ الحالة الأصلية قبل التحديث *****
  const originalStatus = reservation.status;
  
  console.log('الحالة الأصلية للحجز:', originalStatus);
  console.log('الحالة الجديدة:', status);

  // ✅ التحقق من محاولة تعديل طريقة الدفع أو آلية الدفع
  if (paymentMethod && paymentMethod !== reservation.paymentMethod) {
    return next(new AppError(
      'لا يمكن تعديل طريقة الدفع بعد إنشاء الحجز. طريقة الدفع الحالية: ' + 
      (reservation.paymentMethod === 'cash' ? 'نقدي' : 'شيكات'), 
      400
    ));
  }

  if (paymentSchedule && paymentSchedule !== reservation.paymentSchedule) {
    return next(new AppError(
      'لا يمكن تعديل آلية الدفع بعد إنشاء الحجز. آلية الدفع الحالية: ' + 
      getPaymentScheduleArabic(reservation.paymentSchedule), 
      400
    ));
  }
  
  // ✅ التحقق المالي قبل الإلغاء
  if (status === 'cancelled' && originalStatus !== 'cancelled') {
    console.log('🔍 بدء التحقق من المستحقات المالية قبل الإلغاء...');
    
    try {
      // التحقق من إمكانية الإلغاء
      const cancellationCheck = await canCancelReservation(reservation.id, reservation.userId);
      
      if (!cancellationCheck.canCancel) {
        // إرجاع تفاصيل المستحقات غير المدفوعة
        return res.status(400).json({
          status: 'fail',
          message: cancellationCheck.reason,
          code: 'OUTSTANDING_PAYMENTS',
          outstandingPayments: cancellationCheck.outstandingItems,
          details: {
            totalOutstanding: cancellationCheck.outstandingItems.totalOutstanding,
            unpaidPaymentsCount: cancellationCheck.outstandingItems.unpaidPayments.length,
            unpaidExpensesCount: cancellationCheck.outstandingItems.unpaidExpenses.length,
            summary: cancellationCheck.outstandingItems.summary
          }
        });
      }
      
      console.log('✅ جميع المستحقات المالية مدفوعة، يمكن متابعة الإلغاء');
      
    } catch (error) {
      console.error('❌ خطأ في التحقق من المستحقات المالية:', error);
      return next(new AppError('فشل في التحقق من الحالة المالية', 500));
    }
  }
  
  // معالجة الملفات المرفقة
  let contractImage = reservation.contractImage;
  let contractPdf = reservation.contractPdf;
  let depositCheckImage = reservation.depositCheckImage;
  
  if (req.files) {
    // معالجة صورة العقد
    if (req.files.contractImage && req.files.contractImage.length > 0) {
      if (reservation.contractImage) {
        const oldContractPath = path.join(UPLOAD_PATHS.contracts, reservation.contractImage);
        if (fs.existsSync(oldContractPath)) {
          fs.unlinkSync(oldContractPath);
        }
      }
      contractImage = req.files.contractImage[0].filename;
    }
    
    // معالجة ملف العقد PDF
    if (req.files.contractPdf && req.files.contractPdf.length > 0) {
      if (reservation.contractPdf) {
        const oldPdfPath = path.join(UPLOAD_PATHS.contracts, reservation.contractPdf);
        if (fs.existsSync(oldPdfPath)) {
          fs.unlinkSync(oldPdfPath);
        }
      }
      contractPdf = req.files.contractPdf[0].filename;
    }
    
    // معالجة صورة شيك التأمين
    if (req.files.depositCheckImage && req.files.depositCheckImage.length > 0) {
      if (reservation.depositCheckImage) {
        const oldDepositCheckPath = path.join(UPLOAD_PATHS.checks, reservation.depositCheckImage);
        if (fs.existsSync(oldDepositCheckPath)) {
          fs.unlinkSync(oldDepositCheckPath);
        }
      }
      depositCheckImage = req.files.depositCheckImage[0].filename;
    }
  }
  
  // تحضير بيانات التحديث (بدون paymentMethod و paymentSchedule)
  const updateData = {
    contractType: contractType || reservation.contractType,
    startDate: startDate || reservation.startDate,
    endDate: endDate || reservation.endDate,
    contractImage,
    contractPdf,
    // ✅ إزالة paymentMethod و paymentSchedule من التحديث
    // paymentMethod: paymentMethod || reservation.paymentMethod,
    // paymentSchedule: paymentSchedule || reservation.paymentSchedule,
    status: status || reservation.status,
    notes: notes !== undefined ? notes : reservation.notes
  };
  
  // تحديث بيانات التأمين
  if (includesDeposit !== undefined) {
    updateData.includesDeposit = includesDeposit === 'true' || includesDeposit === true;
  }
  
  if (depositAmount !== undefined) {
    updateData.depositAmount = depositAmount;
  }
  
  if (depositPaymentMethod !== undefined) {
    updateData.depositPaymentMethod = depositPaymentMethod;
  }
  
  if (depositCheckImage !== undefined) {
    updateData.depositCheckImage = depositCheckImage;
  }
  
  if (depositStatus !== undefined) {
    updateData.depositStatus = depositStatus;
  }
  
  if (depositPaidDate !== undefined) {
    updateData.depositPaidDate = depositPaidDate;
  }
  
  if (depositReturnedDate !== undefined) {
    updateData.depositReturnedDate = depositReturnedDate;
  }
  
  if (depositNotes !== undefined) {
    updateData.depositNotes = depositNotes;
  }
  
  const transaction = await sequelize.transaction();
  
  try {
    // تحديث الحجز
    await reservation.update(updateData, { transaction });
    
    // ✅ إذا تم إلغاء الحجز، قم بالإجراءات الإضافية
    if (status === 'cancelled' && originalStatus !== 'cancelled') {
      console.log('🔄 معالجة إلغاء الحجز...');
      
      // 1. تحديث حالة الدفعات المعلقة إلى ملغاة
      await updatePendingPaymentsStatus(
        reservation.id, 
        'cancelled', 
        'إلغاء الحجز - تم تسوية جميع المستحقات'
      );
      
      // 2. تعطيل حساب المستأجر
      const tenantUser = await User.findByPk(reservation.userId);
      if (tenantUser && tenantUser.role === 'tenant') {
        await tenantUser.deactivate('إنهاء العقد - تم إلغاء الحجز', { transaction });
        console.log(`🔒 تم تعطيل حساب المستأجر: ${tenantUser.fullName}`);
      }
      
      console.log('✅ تم إكمال جميع إجراءات الإلغاء بنجاح');
    }
    
    await transaction.commit();
    
    // ✅ إضافة رسالة توضيحية إذا حاول المستخدم تعديل طريقة الدفع
    let warningMessage = null;
    if (paymentMethod && paymentMethod !== reservation.paymentMethod) {
      warningMessage = 'تم تجاهل محاولة تعديل طريقة الدفع - غير مسموح بعد إنشاء الحجز';
    }
    if (paymentSchedule && paymentSchedule !== reservation.paymentSchedule) {
      warningMessage = warningMessage ? 
        warningMessage + ' وآلية الدفع' : 
        'تم تجاهل محاولة تعديل آلية الدفع - غير مسموح بعد إنشاء الحجز';
    }
    
    console.log(`📝 تم تحديث الحجز ${reservation.id} من ${originalStatus} إلى ${status || originalStatus}`);
    
    res.status(200).json({
      status: 'success',
      message: status === 'cancelled' ? 'تم إلغاء الحجز وتعطيل حساب المستأجر بنجاح' : 'تم تحديث الحجز بنجاح',
      warning: warningMessage,
      data: reservation
    });
    
  } catch (error) {
    await transaction.rollback();
    console.error('❌ خطأ في تحديث الحجز:', error);
    throw error;
  }
});

// ✅ دالة مساعدة لترجمة آلية الدفع
const getPaymentScheduleArabic = (schedule) => {
  const schedules = {
    'monthly': 'شهري',
    'quarterly': 'ربع سنوي',
    'triannual': 'ثلاث دفعات سنوياً',
    'biannual': 'نصف سنوي',
    'annual': 'سنوي'
  };
  return schedules[schedule] || schedule;
};

// ✅ دالة جديدة للتحقق من المستحقات المالية قبل الإلغاء
const checkFinancialStatus = catchAsync(async (req, res, next) => {
  const reservationId = req.params.id;
  
  const reservation = await Reservation.findByPk(reservationId);
  
  if (!reservation) {
    return next(new AppError('الحجز غير موجود', 404));
  }
  
  try {
    const financialReport = await generateFinancialSummaryReport(reservationId, reservation.userId);
    
    res.status(200).json({
      status: 'success',
      data: financialReport
    });
    
  } catch (error) {
    console.error('خطأ في فحص الحالة المالية:', error);
    return next(new AppError('فشل في فحص الحالة المالية', 500));
  }
});

// باقي الدوال الموجودة (بدون تغيير)...

// الحصول على جميع الحجوزات مع معلومات المستأجر الكاملة
const getAllReservations = catchAsync(async (req, res, next) => {
  // المستأجرون لا يمكنهم رؤية كل الحجوزات
  if(req.user.role === 'tenant') {
    return next(new AppError('غير مصرح لك بعرض جميع الحجوزات', 403));
  }
  
  let whereCondition = {};
  let includeOptions = [
    { 
      model: User, 
      as: 'user', 
      attributes: { exclude: ['password'] },
      include: [{
        model: Tenant,
        as: 'tenantInfo',
        required: false
      }]
    },
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
  if (req.user.role === 'manager' || req.user.role === 'accountant') {
    if (!req.user.companyId) {
      return next(new AppError('المدير غير مرتبط بأي شركة', 403));
    }
    
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

// الحصول على حجز حسب المعرف مع معلومات المستأجر الكاملة
const getReservationById = catchAsync(async (req, res, next) => {
  const reservation = await Reservation.findByPk(req.params.id, {
    include: [
      { 
        model: User, 
        as: 'user',
        attributes: { exclude: ['password'] },
        include: [{
          model: Tenant,
          as: 'tenantInfo',
          required: false
        }]
      },
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

// إنشاء حجز جديد مع حقول التأمين المحدثة
const createReservation = catchAsync(async (req, res, next) => {
  console.log("Files received:", req.files);
  console.log("Form data:", req.body);
  const transaction = await sequelize.transaction();

  try {
    const {
      unitId,
      contractType,
      startDate,
      endDate,
      paymentMethod,
      paymentSchedule,
      
      // حقول التأمين المحدثة
      includesDeposit,
      depositAmount,
      depositPaymentMethod,
      depositStatus,
      depositPaidDate,
      depositReturnedDate,
      depositNotes,
      
      notes,
      // Tenant data
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
    
    // Check if unit exists and is available
    const unit = await RealEstateUnit.findByPk(unitId);
    if (!unit) {
      return next(new AppError('الوحدة غير موجودة', 404));
    }
    
    if (unit.status !== 'available') {
      return next(new AppError('الوحدة غير متاحة للحجز', 400));
    }
    
    // Check for required tenant data
    if (!tenantFullName) {
      return next(new AppError('اسم المستأجر مطلوب', 400));
    }
    
    // Process uploaded files
    let contractImage = null;
    let contractPdf = null;
    let identityImageFront = null;
    let identityImageBack = null;
    let commercialRegisterImage = null;
    let depositCheckImage = null;
        
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
      
      // معالجة صورة شيك التأمين
      if (req.files.depositCheckImage && req.files.depositCheckImage.length > 0) {
        depositCheckImage = req.files.depositCheckImage[0].filename;
        console.log("Deposit check image saved:", depositCheckImage);
      }
    }
    
    // Create unique username
    const baseUsername = tenantFullName.replace(/\s+/g, '_').toLowerCase();
    const timestamp = Date.now().toString().slice(-6);
    const username = `${baseUsername}_${timestamp}`;
    
    // Create random password
    const password = generatePassword(8);
    const copassword = password;
    
    // Create tenant user
    const user = await User.create({
      username,
      password,
      copassword,
      fullName: tenantFullName,
      email: tenantEmail,
      phone: tenantPhone,
      whatsappNumber: tenantWhatsappNumber,
      idNumber: tenantIdNumber,
      identityImageFront,
      identityImageBack,
      commercialRegisterImage,
      role: 'tenant'
    }, { transaction });
    
    // Create tenant record
    const tenant = await Tenant.create({
      userId: user.id,
      tenantType: tenantType || 'person',
      businessActivities: tenantBusinessActivities,
      contactPerson: tenantContactPerson,
      contactPosition: tenantContactPosition,
      notes: tenantNotes
    }, { transaction });
    
    // تحضير بيانات التأمين
    const depositData = {};
    if (includesDeposit === 'true' || includesDeposit === true) {
      depositData.includesDeposit = true;
      depositData.depositAmount = depositAmount || null;
      depositData.depositPaymentMethod = depositPaymentMethod || null;
      depositData.depositCheckImage = depositCheckImage;
      depositData.depositStatus = depositStatus || 'unpaid';
      depositData.depositPaidDate = depositPaidDate || null;
      depositData.depositReturnedDate = depositReturnedDate || null;
      depositData.depositNotes = depositNotes || null;
    } else {
      depositData.includesDeposit = false;
    }
    
    // Create reservation
    const newReservation = await Reservation.create({
      userId: user.id,
      unitId,
      contractType: contractType || 'residential',
      startDate,
      endDate,
      contractImage,
      contractPdf,
      paymentMethod: paymentMethod || 'cash',
      paymentSchedule: paymentSchedule || 'monthly',
      
      // إضافة بيانات التأمين
      ...depositData,
      
      status: 'active',
      notes
    }, { transaction });
    
    // Update unit status to rented
    await unit.update({ status: 'rented' }, { transaction });
    
    // Generate payment schedule
    const paymentScheduleData = generatePaymentSchedule(newReservation, unit.price);
    
    // Create payment records
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

    // Create file URLs
    const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
    
    // Prepare response data مع معلومات المستأجر الكاملة
    const responseData = {
      reservation: {
        ...newReservation.get({ plain: true }),
        contractImageUrl: contractImage ? `${BASE_URL}/uploads/contracts/${contractImage}` : null,
        contractPdfUrl: contractPdf ? `${BASE_URL}/uploads/contracts/${contractPdf}` : null,
        depositCheckImageUrl: depositCheckImage ? `${BASE_URL}/uploads/checks/${depositCheckImage}` : null
      },
      unit: unit,
      tenant: {
        ...tenant.get({ plain: true }),
        user: {
          ...user.toJSON(),
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
    // Rollback transaction on error
    await transaction.rollback();

    // Delete uploaded files if any
    if (req.files) {
      Object.keys(req.files).forEach(fieldName => {
        req.files[fieldName].forEach(file => {
          let filePath;
          if (fieldName.includes('contract')) {
            filePath = path.join(UPLOAD_PATHS.contracts, file.filename);
          } else if (fieldName === 'depositCheckImage') {
            filePath = path.join(UPLOAD_PATHS.checks, file.filename);
          } else {
            filePath = path.join(UPLOAD_PATHS.identities, file.filename);
          }
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        });
      });
    }
    
    throw error;
  }
});

// حذف حجز - بدون تغيير حالة الوحدة
const deleteReservation = catchAsync(async (req, res, next) => {
  const reservation = await Reservation.findByPk(req.params.id);
  
  if (!reservation) {
    return next(new AppError('الحجز غير موجود', 404));
  }
  
  console.log('🗑️ حذف الحجز رقم:', reservation.id);
  console.log('معرف الوحدة:', reservation.unitId);
  
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
  
  // حذف صورة شيك التأمين إذا وجدت
  if (reservation.depositCheckImage) {
    const depositCheckPath = path.join(UPLOAD_PATHS.checks, reservation.depositCheckImage);
    if (fs.existsSync(depositCheckPath)) {
      fs.unlinkSync(depositCheckPath);
    }
  }
  
  console.log(`📝 تم حذف الحجز ${reservation.id} بدون تغيير حالة الوحدة`);
  
  await reservation.destroy();
  
  res.status(204).json({
    status: 'success',
    data: null
  });
});

// الحصول على الحجوزات حسب معرف الوحدة مع معلومات المستأجر
const getReservationsByUnitId = catchAsync(async (req, res) => {
  const reservations = await Reservation.findAll({
    where: { unitId: req.params.unitId },
    include: [
      { 
        model: User, 
        as: 'user', 
        attributes: { exclude: ['password'] },
        include: [{
          model: Tenant,
          as: 'tenantInfo',
          required: false
        }]
      }
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
      { 
        model: RealEstateUnit, 
        as: 'unit' 
      }
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
  getMyReservations,
  // ✅ إضافة الدالة الجديدة
  checkFinancialStatus
};