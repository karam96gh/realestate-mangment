const ServiceOrder = require('../models/serviceOrder.model');
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

// Get all service orders
const getAllServiceOrders = catchAsync(async (req, res, next) => {
  // المستأجرون لا يمكنهم رؤية كل طلبات الخدمة
  if(req.user.role === 'tenant') {
    return next(new AppError('غير مصرح لك بعرض جميع طلبات الخدمة', 403));
  }
  
  let whereCondition = {};
  
  // نهج مختلف للتصفية: سنحصل أولاً على قائمة معرفات الحجوزات المسموح بها
  if (req.user.role === 'manager') {
    if (!req.user.companyId) {
      return next(new AppError('المدير غير مرتبط بأي شركة', 403));
    }
    
    // الحصول على معرفات المباني التابعة للشركة
    const companyBuildings = await Building.findAll({
      where: { companyId: req.user.companyId },
      attributes: ['id']
    });
    
    const buildingIds = companyBuildings.map(building => building.id);
    
    if (buildingIds.length === 0) {
      return res.status(200).json({
        status: 'success',
        results: 0,
        data: []
      });
    }
    
    // الحصول على معرفات الوحدات في هذه المباني
    const unitIds = await RealEstateUnit.findAll({
      where: { buildingId: { [Op.in]: buildingIds } },
      attributes: ['id']
    }).then(units => units.map(unit => unit.id));
    
    if (unitIds.length === 0) {
      return res.status(200).json({
        status: 'success',
        results: 0,
        data: []
      });
    }
    
    // الحصول على معرفات الحجوزات لهذه الوحدات
    const reservationIds = await Reservation.findAll({
      where: { unitId: { [Op.in]: unitIds } },
      attributes: ['id']
    }).then(reservations => reservations.map(reservation => reservation.id));
    
    if (reservationIds.length === 0) {
      return res.status(200).json({
        status: 'success',
        results: 0,
        data: []
      });
    }
    
    // تحديد حالة البحث لطلبات الخدمة
    whereCondition.reservationId = { [Op.in]: reservationIds };
  }
  
  // الاستعلام عن طلبات الخدمة مع تضمين جميع المعلومات المطلوبة
  const serviceOrders = await ServiceOrder.findAll({
    where: whereCondition,
    include: [
      { model: User, as: 'user', attributes: { exclude: ['password'] } },
      { 
        model: Reservation, 
        as: 'reservation',
        include: [{
          model: RealEstateUnit,
          as: 'unit',
          include: [{
            model: Building,
            as: 'building',
            include: [{ model: Company, as: 'company' }]
          }]
        }]
      }
    ]
  });
  
  res.status(200).json({
    status: 'success',
    results: serviceOrders.length,
    data: serviceOrders
  });
});

const getServiceOrderById = catchAsync(async (req, res, next) => {
  const serviceOrder = await ServiceOrder.findByPk(req.params.id, {
    include: [
      { model: User, as: 'user', attributes: { exclude: ['password'] } },
      { 
        model: Reservation, 
        as: 'reservation',
        include: [{
          model: RealEstateUnit,
          as: 'unit',
          include: [{
            model: Building,
            as: 'building',
            include: [{ model: Company, as: 'company' }]
          }]
        }]
      }
    ]
  });
  
  if (!serviceOrder) {
    return next(new AppError('لم يتم العثور على طلب الخدمة', 404));
  }
  
  // تحقق إذا كان المستخدم مستأجرًا، فيمكنه فقط رؤية طلبات الخدمة الخاصة به
  if (req.user.role === 'tenant' && serviceOrder.userId !== req.user.id) {
    return next(new AppError('غير مصرح لك بعرض طلب الخدمة هذا', 403));
  }
  
  // تحقق إذا كان المستخدم مديرًا، فيمكنه فقط رؤية طلبات الخدمة لشركته
  if (req.user.role === 'manager') {
    const companyId = serviceOrder.reservation.unit.building.companyId;
    if (!req.user.companyId || req.user.companyId !== companyId) {
      return next(new AppError('غير مصرح لك بعرض طلب الخدمة هذا', 403));
    }
  }
  
  res.status(200).json({
    status: 'success',
    data: serviceOrder
  });
});

// Create new service order
const createServiceOrder = catchAsync(async (req, res, next) => {
  const { reservationId, serviceType, serviceSubtype, description } = req.body;
  
  // Verify reservation exists
  const reservation = await Reservation.findByPk(reservationId, {
    include: [{
      model: RealEstateUnit,
      as: 'unit',
      include: [{
        model: Building,
        as: 'building'
      }]
    }]
  });
  
  if (!reservation) {
    return next(new AppError('Reservation not found', 404));
  }
  
  // If user is a tenant, they can only create service orders for their own reservations
  if (req.user.role === 'tenant' && reservation.userId !== req.user.id) {
    return next(new AppError('You can only create service orders for your own reservations', 403));
  }
  
  // Handle attachment upload
  let attachmentFile = null;
  if (req.file) {
    attachmentFile = req.file.filename;
  }
  
  // Create service order مع السجل التاريخي الأولي
  const newServiceOrder = await ServiceOrder.create({
    userId: req.user.id,
    reservationId,
    serviceType,
    serviceSubtype,
    description,
    attachmentFile,
    status: 'pending',
    serviceHistory: [{
      status: 'pending',
      date: new Date().toISOString()
    }]
  });
  
  res.status(201).json({
    status: 'success',
    data: newServiceOrder
  });
});

// Update service order
const updateServiceOrder = catchAsync(async (req, res, next) => {
  const serviceOrder = await ServiceOrder.findByPk(req.params.id);
  
  if (!serviceOrder) {
    return next(new AppError('Service order not found', 404));
  }
  
  // Only admin/manager can update status, tenant can only update description if status is pending
  if (req.user.role === 'tenant') {
    if (serviceOrder.userId !== req.user.id) {
      return next(new AppError('You can only update your own service orders', 403));
    }
    
    if (serviceOrder.status !== 'pending' && req.body.description) {
      return next(new AppError('You can only update the description of pending service orders', 403));
    }
    
    if (req.body.status) {
      return next(new AppError('Tenants cannot update the status of service orders', 403));
    }
  }
  
  // تحقق من صحة الحالة الجديدة إذا تم تمريرها
  if (req.body.status) {
    const validStatuses = ['pending', 'in-progress', 'completed', 'rejected'];
    if (!validStatuses.includes(req.body.status)) {
      return next(new AppError('Invalid status value', 400));
    }
  }
  
  const { serviceType, serviceSubtype, description, status } = req.body;
  
  // Handle attachment upload if provided
  let attachmentFile = serviceOrder.attachmentFile;
  if (req.file) {
    // Delete old attachment if it exists
    if (serviceOrder.attachmentFile) {
      const oldAttachmentPath = path.join(UPLOAD_PATHS.attachments, serviceOrder.attachmentFile);
      if (fs.existsSync(oldAttachmentPath)) {
        fs.unlinkSync(oldAttachmentPath);
      }
    }
    attachmentFile = req.file.filename;
  }
  
  // إعداد البيانات للتحديث
  const updateData = {
    serviceType: serviceType || serviceOrder.serviceType,
    serviceSubtype: serviceSubtype || serviceOrder.serviceSubtype,
    description: description || serviceOrder.description,
    attachmentFile
  };
  
  // إضافة سجل جديد للتاريخ فقط إذا تغيرت الحالة
  if (status && status !== serviceOrder.status) {
    let currentHistory = serviceOrder.serviceHistory || [];
    
    // إضافة السجل الجديد
    const newHistoryEntry = {
      status: status,
      date: new Date().toISOString()
    };
    
    updateData.status = status;
    updateData.serviceHistory = [...currentHistory, newHistoryEntry];
  }
  
  // Update service order
  await serviceOrder.update(updateData);
  
  // إعادة جلب السجل مع السجل التاريخي المحدث
  const updatedServiceOrder = await ServiceOrder.findByPk(serviceOrder.id, {
    include: [
      { model: User, as: 'user', attributes: { exclude: ['password'] } },
      { 
        model: Reservation, 
        as: 'reservation',
        include: [{
          model: RealEstateUnit,
          as: 'unit',
          include: [{
            model: Building,
            as: 'building',
            include: [{ model: Company, as: 'company' }]
          }]
        }]
      }
    ]
  });
  
  res.status(200).json({
    status: 'success',
    data: updatedServiceOrder
  });
});

// Delete service order
const deleteServiceOrder = catchAsync(async (req, res, next) => {
  const serviceOrder = await ServiceOrder.findByPk(req.params.id);
  
  if (!serviceOrder) {
    return next(new AppError('Service order not found', 404));
  }
  
  // Only admin/manager can delete any service order
  // Tenants can only delete their own pending service orders
  if (req.user.role === 'tenant') {
    if (serviceOrder.userId !== req.user.id) {
      return next(new AppError('You can only delete your own service orders', 403));
    }
    
    if (serviceOrder.status !== 'pending') {
      return next(new AppError('You can only delete pending service orders', 403));
    }
  }
  
  // Delete attachment if it exists
  if (serviceOrder.attachmentFile) {
    const attachmentPath = path.join(UPLOAD_PATHS.attachments, serviceOrder.attachmentFile);
    if (fs.existsSync(attachmentPath)) {
      fs.unlinkSync(attachmentPath);
    }
  }
  
  await serviceOrder.destroy();
  
  res.status(204).json({
    status: 'success',
    data: null
  });
});

// Get service orders by reservation ID
const getServiceOrdersByReservationId = catchAsync(async (req, res, next) => {
  const reservationId = req.params.reservationId;
  
  // Verify reservation exists
  const reservation = await Reservation.findByPk(reservationId);
  if (!reservation) {
    return next(new AppError('Reservation not found', 404));
  }
  
  // If user is a tenant, they can only view service orders for their own reservations
  if (req.user.role === 'tenant' && reservation.userId !== req.user.id) {
    return next(new AppError('You can only view service orders for your own reservations', 403));
  }
  
  const serviceOrders = await ServiceOrder.findAll({
    where: { reservationId },
    include: [
      { model: User, as: 'user', attributes: { exclude: ['password'] } }
    ]
  });
  
  res.status(200).json({
    status: 'success',
    results: serviceOrders.length,
    data: serviceOrders
  });
});

// دالة إضافية للحصول على تاريخ الحالات لطلب خدمة معين
const getServiceOrderHistory = catchAsync(async (req, res, next) => {
  const serviceOrder = await ServiceOrder.findByPk(req.params.id);
  
  if (!serviceOrder) {
    return next(new AppError('Service order not found', 404));
  }
  
  // تحقق من صلاحيات الوصول
  if (req.user.role === 'tenant' && serviceOrder.userId !== req.user.id) {
    return next(new AppError('You can only view history for your own service orders', 403));
  }
  
  res.status(200).json({
    status: 'success',
    data: {
      serviceOrderId: serviceOrder.id,
      serviceHistory: serviceOrder.serviceHistory
    }
  });
});

module.exports = {
  getAllServiceOrders,
  getServiceOrderById,
  createServiceOrder,
  updateServiceOrder,
  deleteServiceOrder,
  getServiceOrdersByReservationId,
  getServiceOrderHistory
};