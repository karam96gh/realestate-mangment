// استيراد النماذج المطلوبة
const PaymentHistory = require('../models/paymentHistory.model');
const Reservation = require('../models/reservation.model');
const User = require('../models/user.model');
const RealEstateUnit = require('../models/realEstateUnit.model');
const Building = require('../models/building.model');
const Company = require('../models/company.model');
const { catchAsync, AppError } = require('../utils/errorHandler');
const fs = require('fs');
const path = require('path');
const { UPLOAD_PATHS } = require('../config/upload');
const { Op } = require('sequelize');

// الحصول على جميع الدفعات
const getAllPayments = catchAsync(async (req, res, next) => {
  // المستأجرون لا يمكنهم رؤية كل الدفعات
  if(req.user.role === 'tenant') {
    return next(new AppError('غير مصرح لك بعرض جميع الدفعات', 403));
  }
  
  let includeOptions = [
    { 
      model: Reservation, 
      as: 'reservation',
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
    }
  ];
  
  let whereCondition = {};
  
  // إذا كان المستخدم مديرًا، فقط إظهار دفعات شركته
  if (req.user.role === 'manager') {
    if (!req.user.companyId) {
      return next(new AppError('المدير غير مرتبط بأي شركة', 403));
    }
    
    // نحتاج لاستعلام متداخل للحصول على الدفعات المرتبطة بشركة المدير
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
    
    const companyReservations = await Reservation.findAll({
      where: { unitId: { [Op.in]: unitIds } },
      attributes: ['id']
    });
    
    const reservationIds = companyReservations.map(reservation => reservation.id);
    
    whereCondition.reservationId = { [Op.in]: reservationIds };
  }
  
  const payments = await PaymentHistory.findAll({
    where: whereCondition,
    include: includeOptions,
      order: [['paymentDate', 'ASC']] // ترتيب حسب تاريخ الدفع (الأقدم أولاً)

  });
  
  res.status(200).json({
    status: 'success',
    results: payments.length,
    data: payments
  });
});

// الحصول على دفعة حسب معرفها
const getPaymentById = catchAsync(async (req, res, next) => {
  const payment = await PaymentHistory.findByPk(req.params.id, {
    include: [
      { 
        model: Reservation, 
        as: 'reservation',
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
      }
    ]
  });
  
  if (!payment) {
    return next(new AppError('لم يتم العثور على الدفعة', 404));
  }
  
  // تحقق إذا كان المستخدم مستأجرًا، فيمكنه فقط رؤية دفعاته الخاصة
  if (req.user.role === 'tenant' && payment.reservation.userId !== req.user.id) {
    return next(new AppError('غير مصرح لك بعرض هذه الدفعة', 403));
  }
  
  // تحقق إذا كان المستخدم مديرًا، فيمكنه فقط رؤية دفعات شركته
  if (req.user.role === 'manager') {
    const companyId = payment.reservation.unit.building.companyId;
    if (!req.user.companyId || req.user.companyId !== companyId) {
      return next(new AppError('غير مصرح لك بعرض هذه الدفعة', 403));
    }
  }
  
  res.status(200).json({
    status: 'success',
    data: payment
  });
});

// إنشاء دفعة جديدة
const createPayment = catchAsync(async (req, res, next) => {
  const { reservationId, amount, paymentDate, paymentMethod, status, notes } = req.body;
  
  // التحقق من وجود الحجز
  const reservation = await Reservation.findByPk(reservationId, {
    include: [
      { model: User, as: 'user' },
      { 
        model: RealEstateUnit, 
        as: 'unit',
        include: [{
          model: Building,
          as: 'building'
        }]
      }
    ]
  });
  
  if (!reservation) {
    return next(new AppError('الحجز غير موجود', 404));
  }
  
  // التحقق من الصلاحيات
  if (req.user.role === 'tenant') {
    return next(new AppError('فقط المشرفون والمديرون يمكنهم إنشاء سجلات الدفع', 403));
  }
  
  // إذا كان المستخدم مديرًا، تحقق من أن الحجز ينتمي إلى شركته
  if (req.user.role === 'manager') {
    const companyId = reservation.unit.building.companyId;
    if (!req.user.companyId || req.user.companyId !== companyId) {
      return next(new AppError('غير مصرح لك بإنشاء دفعة لهذا الحجز', 403));
    }
  }
  
  // معالجة صورة الشيك إذا تم توفيرها
  let checkImage = null;
  if (req.file) {
    checkImage = req.file.filename;
  }
  
  // إنشاء الدفعة
  const newPayment = await PaymentHistory.create({
    reservationId,
    amount,
    paymentDate,
    paymentMethod,
    checkImage,
    status: status || 'pending',
    notes
  });
  
  res.status(201).json({
    status: 'success',
    data: newPayment
  });
});

// تحديث دفعة
const updatePayment = catchAsync(async (req, res, next) => {
  const payment = await PaymentHistory.findByPk(req.params.id, {
    include: [
      { 
        model: Reservation, 
        as: 'reservation',
        include: [
          { 
            model: RealEstateUnit, 
            as: 'unit',
            include: [{
              model: Building,
              as: 'building'
            }]
          }
        ]
      }
    ]
  });
  
  if (!payment) {
    return next(new AppError('لم يتم العثور على الدفعة', 404));
  }
  
  // التحقق من الصلاحيات
  if (req.user.role === 'tenant') {
    return next(new AppError('فقط المشرفون والمديرون يمكنهم تحديث سجلات الدفع', 403));
  }
  
  // إذا كان المستخدم مديرًا، تحقق من أن الدفعة تنتمي إلى شركته
  if (req.user.role === 'manager') {
    const companyId = payment.reservation.unit.building.companyId;
    if (!req.user.companyId || req.user.companyId !== companyId) {
      return next(new AppError('غير مصرح لك بتحديث هذه الدفعة', 403));
    }
  }
  
  const { amount, paymentDate, paymentMethod, status, notes } = req.body;
  
  // معالجة صورة الشيك إذا تم توفيرها
  let checkImage = payment.checkImage;
  if (req.file) {
    // حذف صورة الشيك القديمة إذا كانت موجودة
    if (payment.checkImage) {
      const oldCheckPath = path.join(UPLOAD_PATHS.checks, payment.checkImage);
      if (fs.existsSync(oldCheckPath)) {
        fs.unlinkSync(oldCheckPath);
      }
    }
    checkImage = req.file.filename;
  }
  
  // تحديث الدفعة
  await payment.update({
    amount: amount || payment.amount,
    paymentDate: paymentDate || payment.paymentDate,
    paymentMethod: paymentMethod || payment.paymentMethod,
    checkImage,
    status: status || payment.status,
    notes: notes || payment.notes
  });
  
  res.status(200).json({
    status: 'success',
    data: payment
  });
});

// حذف دفعة
const deletePayment = catchAsync(async (req, res, next) => {
  const payment = await PaymentHistory.findByPk(req.params.id, {
    include: [
      { 
        model: Reservation, 
        as: 'reservation',
        include: [
          { 
            model: RealEstateUnit, 
            as: 'unit',
            include: [{
              model: Building,
              as: 'building'
            }]
          }
        ]
      }
    ]
  });
  
  if (!payment) {
    return next(new AppError('لم يتم العثور على الدفعة', 404));
  }
  
  // التحقق من الصلاحيات
  if (req.user.role === 'tenant') {
    return next(new AppError('فقط المشرفون والمديرون يمكنهم حذف سجلات الدفع', 403));
  }
  
  // إذا كان المستخدم مديرًا، تحقق من أن الدفعة تنتمي إلى شركته
  if (req.user.role === 'manager') {
    const companyId = payment.reservation.unit.building.companyId;
    if (!req.user.companyId || req.user.companyId !== companyId) {
      return next(new AppError('غير مصرح لك بحذف هذه الدفعة', 403));
    }
  }
  
  // حذف صورة الشيك إذا كانت موجودة
  if (payment.checkImage) {
    const checkPath = path.join(UPLOAD_PATHS.checks, payment.checkImage);
    if (fs.existsSync(checkPath)) {
      fs.unlinkSync(checkPath);
    }
  }
  
  await payment.destroy();
  
  res.status(204).json({
    status: 'success',
    data: null
  });
});

// الحصول على الدفعات حسب معرف الحجز
const getPaymentsByReservationId = catchAsync(async (req, res, next) => {
  const reservationId = req.params.reservationId;
  
  // التحقق من وجود الحجز
  const reservation = await Reservation.findByPk(reservationId, {
    include: [
      { model: User, as: 'user' },
      { 
        model: RealEstateUnit, 
        as: 'unit',
        include: [{
          model: Building,
          as: 'building'
        }]
      }
    ],

  });
  
  if (!reservation) {
    return next(new AppError('الحجز غير موجود', 404));
  }
  
  // تحقق إذا كان المستخدم مستأجرًا، فيمكنه فقط رؤية دفعاته الخاصة
  if (req.user.role === 'tenant' && reservation.userId !== req.user.id) {
    return next(new AppError('يمكنك فقط عرض الدفعات لحجوزاتك الخاصة', 403));
  }
  
  // تحقق إذا كان المستخدم مديرًا، فيمكنه فقط رؤية دفعات شركته
  if (req.user.role === 'manager') {
    const companyId = reservation.unit.building.companyId;
    if (!req.user.companyId || req.user.companyId !== companyId) {
      return next(new AppError('غير مصرح لك بعرض دفعات هذا الحجز', 403));
    }
  }
  
  const payments = await PaymentHistory.findAll({
    where: { reservationId },
      order: [['paymentDate', 'ASC']] // ترتيب حسب تاريخ الدفع (الأقدم أولاً)

  });
  
  res.status(200).json({
    status: 'success',
    results: payments.length,
    data: payments
  });
});

module.exports = {
  getAllPayments,
  getPaymentById,
  createPayment,
  updatePayment,
  deletePayment,
  getPaymentsByReservationId
};