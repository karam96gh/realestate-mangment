const ServiceOrder = require('../models/serviceOrder.model');
const Reservation = require('../models/reservation.model');
const User = require('../models/user.model');
const RealEstateUnit = require('../models/realEstateUnit.model');
const Building = require('../models/building.model');
const Company = require('../models/company.model');
const { catchAsync, AppError } = require('../utils/errorHandler');
const { validateStatusTransition, canEditServiceOrder, getAllowedNextStatuses, getStatusDescription } = require('../utils/serviceOrderStatusHelper');
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
  if (req.user.role === 'manager'||req.user.role === 'maintenance'||req.user.role === 'accountant') {
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
    
    // إضافة تصفية نوع الخدمة حسب دور المستخدم
    if (req.user.role === 'maintenance') {
      // عامل الصيانة يرى طلبات الصيانة فقط
      whereCondition.serviceType = 'maintenance';
    } else if (req.user.role === 'accountant') {
      // المحاسب يرى الطلبات المالية فقط
      whereCondition.serviceType = 'financial';
    }
    // المدير يرى جميع الطلبات (لا نضيف تصفية إضافية)
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
    ],
    order: [['createdAt', 'DESC']]
  });
  
  res.status(200).json({
    status: 'success',
    results: serviceOrders.length,
    data: serviceOrders
  });
});

// Get service order by ID
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
  if (req.user.role === 'manager'||req.user.role === 'maintenance'||req.user.role === 'accountant') {
    const companyId = serviceOrder.reservation.unit.building.companyId;
    if (!req.user.companyId || req.user.companyId !== companyId) {
      return next(new AppError('غير مصرح لك بعرض طلب الخدمة هذا', 403));
    }
    
    // التحقق من نوع الخدمة حسب دور المستخدم
    if (req.user.role === 'maintenance' && serviceOrder.serviceType !== 'maintenance') {
      return next(new AppError('غير مصرح لك بعرض هذا النوع من طلبات الخدمة', 403));
    }
    
    if (req.user.role === 'accountant' && serviceOrder.serviceType !== 'financial') {
      return next(new AppError('غير مصرح لك بعرض هذا النوع من طلبات الخدمة', 403));
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
    return next(new AppError('الحجز غير موجود', 404));
  }
  
  // If user is a tenant, they can only create service orders for their own reservations
  if (req.user.role === 'tenant' && reservation.userId !== req.user.id) {
    return next(new AppError('يمكنك إنشاء طلبات خدمة للحجوزات الخاصة بك فقط', 403));
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
      date: new Date().toISOString(),
      changedBy: req.user.id,
      changedByRole: req.user.role,
      changedByName: req.user.name || req.user.email
    }]
  });
  
  // إعادة جلب السجل مع جميع العلاقات
  const createdServiceOrder = await ServiceOrder.findByPk(newServiceOrder.id, {
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
  
  res.status(201).json({
    status: 'success',
    data: createdServiceOrder
  });
});

// Update service order
const updateServiceOrder = catchAsync(async (req, res, next) => {
  const serviceOrder = await ServiceOrder.findByPk(req.params.id);
  
  if (!serviceOrder) {
    return next(new AppError('طلب الخدمة غير موجود', 404));
  }
  
  // التحقق من صلاحيات التعديل
  const editPermissions = canEditServiceOrder(serviceOrder.status, req.user.role);
  
  if (!editPermissions.canEdit) {
    return next(new AppError(editPermissions.message, 403));
  }
  
  // التحقق من صلاحيات المستأجر
  if (req.user.role === 'tenant') {
    if (serviceOrder.userId !== req.user.id) {
      return next(new AppError('يمكنك تحديث طلبات الخدمة الخاصة بك فقط', 403));
    }
    
    if (!editPermissions.canEditDescription && req.body.description) {
      return next(new AppError('يمكنك تحديث وصف الطلبات في انتظار المعالجة فقط', 403));
    }
    
    if (req.body.status && !editPermissions.canEditStatus) {
      return next(new AppError('المستأجرون لا يمكنهم تحديث حالة طلبات الخدمة', 403));
    }
  }
  
  // التحقق من صلاحيات المدير أو عامل الصيانة أو المحاسب
  if (['manager', 'maintenance', 'accountant'].includes(req.user.role)) {
    // الحصول على معلومات الشركة لطلب الخدمة
    const serviceOrderWithCompany = await ServiceOrder.findByPk(req.params.id, {
      include: [{
        model: Reservation,
        as: 'reservation',
        include: [{
          model: RealEstateUnit,
          as: 'unit',
          include: [{
            model: Building,
            as: 'building'
          }]
        }]
      }]
    });
    
    const companyId = serviceOrderWithCompany.reservation.unit.building.companyId;
    
    if (!req.user.companyId || req.user.companyId !== companyId) {
      return next(new AppError('غير مصرح لك بتحديث طلب الخدمة هذا', 403));
    }
    
    // التحقق من نوع الخدمة حسب دور المستخدم
    if (req.user.role === 'maintenance' && serviceOrder.serviceType !== 'maintenance') {
      return next(new AppError('غير مصرح لك بتحديث هذا النوع من طلبات الخدمة', 403));
    }
    
    if (req.user.role === 'accountant' && serviceOrder.serviceType !== 'financial') {
      return next(new AppError('غير مصرح لك بتحديث هذا النوع من طلبات الخدمة', 403));
    }
  }
  
  // التحقق من صحة الحالة الجديدة إذا تم تمريرها
  if (req.body.status) {
    const validStatuses = ['pending', 'in-progress', 'completed', 'rejected'];
    if (!validStatuses.includes(req.body.status)) {
      return next(new AppError('قيمة الحالة غير صحيحة', 400));
    }
    
    // التحقق من صحة تحول الحالة
    const transitionValidation = validateStatusTransition(serviceOrder.status, req.body.status);
    if (!transitionValidation.isValid) {
      return next(new AppError(transitionValidation.message, 400));
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
      date: new Date().toISOString(),
      changedBy: req.user.id,
      changedByRole: req.user.role,
      changedByName: req.user.name || req.user.email
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
    return next(new AppError('طلب الخدمة غير موجود', 404));
  }
  
  // Only admin can delete any service order
  // Tenants can only delete their own pending service orders
  // Managers can delete service orders for their company
  if (req.user.role === 'tenant') {
    if (serviceOrder.userId !== req.user.id) {
      return next(new AppError('يمكنك حذف طلبات الخدمة الخاصة بك فقط', 403));
    }
    
    if (serviceOrder.status !== 'pending') {
      return next(new AppError('يمكنك حذف الطلبات في انتظار المعالجة فقط', 403));
    }
  }
  
  // التحقق من صلاحيات المدير
  if (['manager', 'maintenance', 'accountant'].includes(req.user.role)) {
    // الحصول على معلومات الشركة لطلب الخدمة
    const serviceOrderWithCompany = await ServiceOrder.findByPk(req.params.id, {
      include: [{
        model: Reservation,
        as: 'reservation',
        include: [{
          model: RealEstateUnit,
          as: 'unit',
          include: [{
            model: Building,
            as: 'building'
          }]
        }]
      }]
    });
    
    const companyId = serviceOrderWithCompany.reservation.unit.building.companyId;
    
    if (!req.user.companyId || req.user.companyId !== companyId) {
      return next(new AppError('غير مصرح لك بحذف طلب الخدمة هذا', 403));
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
    return next(new AppError('الحجز غير موجود', 404));
  }
  
  // If user is a tenant, they can only view service orders for their own reservations
  if (req.user.role === 'tenant' && reservation.userId !== req.user.id) {
    return next(new AppError('يمكنك عرض طلبات الخدمة للحجوزات الخاصة بك فقط', 403));
  }
  
  let whereCondition = { reservationId };
  
  // إضافة تصفية نوع الخدمة حسب دور المستخدم
  if (req.user.role === 'maintenance') {
    whereCondition.serviceType = 'maintenance';
  } else if (req.user.role === 'accountant') {
    whereCondition.serviceType = 'financial';
  }
  
  const serviceOrders = await ServiceOrder.findAll({
    where: whereCondition,
    include: [
      { model: User, as: 'user', attributes: { exclude: ['password'] } }
    ],
    order: [['createdAt', 'DESC']]
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
    return next(new AppError('طلب الخدمة غير موجود', 404));
  }
  
  // تحقق من صلاحيات الوصول
  if (req.user.role === 'tenant' && serviceOrder.userId !== req.user.id) {
    return next(new AppError('يمكنك عرض تاريخ طلبات الخدمة الخاصة بك فقط', 403));
  }
  
  // التحقق من صلاحيات المدير
  if (['manager', 'maintenance', 'accountant'].includes(req.user.role)) {
    const serviceOrderWithCompany = await ServiceOrder.findByPk(req.params.id, {
      include: [{
        model: Reservation,
        as: 'reservation',
        include: [{
          model: RealEstateUnit,
          as: 'unit',
          include: [{
            model: Building,
            as: 'building'
          }]
        }]
      }]
    });
    
    const companyId = serviceOrderWithCompany.reservation.unit.building.companyId;
    
    if (!req.user.companyId || req.user.companyId !== companyId) {
      return next(new AppError('غير مصرح لك بعرض تاريخ طلب الخدمة هذا', 403));
    }
  }
  
  res.status(200).json({
    status: 'success',
    data: {
      serviceOrderId: serviceOrder.id,
      serviceHistory: serviceOrder.serviceHistory
    }
  });
});

// دالة للحصول على الحالات المسموحة لطلب معين
const getAllowedStatusesForServiceOrder = catchAsync(async (req, res, next) => {
  const serviceOrder = await ServiceOrder.findByPk(req.params.id);
  
  if (!serviceOrder) {
    return next(new AppError('طلب الخدمة غير موجود', 404));
  }
  
  // التحقق من صلاحيات الوصول
  if (req.user.role === 'tenant' && serviceOrder.userId !== req.user.id) {
    return next(new AppError('يمكنك عرض طلبات الخدمة الخاصة بك فقط', 403));
  }
  
  // التحقق من صلاحيات المدير
  if (['manager', 'maintenance', 'accountant'].includes(req.user.role)) {
    const serviceOrderWithCompany = await ServiceOrder.findByPk(req.params.id, {
      include: [{
        model: Reservation,
        as: 'reservation',
        include: [{
          model: RealEstateUnit,
          as: 'unit',
          include: [{
            model: Building,
            as: 'building'
          }]
        }]
      }]
    });
    
    const companyId = serviceOrderWithCompany.reservation.unit.building.companyId;
    
    if (!req.user.companyId || req.user.companyId !== companyId) {
      return next(new AppError('غير مصرح لك بعرض طلب الخدمة هذا', 403));
    }
  }
  
  const allowedStatuses = getAllowedNextStatuses(serviceOrder.status);
  
  res.status(200).json({
    status: 'success',
    data: {
      serviceOrderId: serviceOrder.id,
      currentStatus: serviceOrder.status,
      currentStatusDescription: getStatusDescription(serviceOrder.status),
      allowedNextStatuses: allowedStatuses,
      allowedNextStatusesDescriptions: allowedStatuses.map(status => ({
        status: status,
        description: getStatusDescription(status)
      }))
    }
  });
});

// دالة للحصول على إحصائيات طلبات الخدمة
const getServiceOrderStats = catchAsync(async (req, res, next) => {
  let whereCondition = {};
  
  // تطبيق نفس منطق التصفية حسب دور المستخدم
  if (req.user.role === 'tenant') {
    whereCondition.userId = req.user.id;
  } else if (['manager', 'maintenance', 'accountant'].includes(req.user.role)) {
    if (!req.user.companyId) {
      return next(new AppError('المستخدم غير مرتبط بأي شركة', 403));
    }
    
    // الحصول على معرفات الحجوزات المسموح بها
    const companyBuildings = await Building.findAll({
      where: { companyId: req.user.companyId },
      attributes: ['id']
    });
    
    const buildingIds = companyBuildings.map(building => building.id);
    
    if (buildingIds.length > 0) {
      const unitIds = await RealEstateUnit.findAll({
        where: { buildingId: { [Op.in]: buildingIds } },
        attributes: ['id']
      }).then(units => units.map(unit => unit.id));
      
      if (unitIds.length > 0) {
        const reservationIds = await Reservation.findAll({
          where: { unitId: { [Op.in]: unitIds } },
          attributes: ['id']
        }).then(reservations => reservations.map(reservation => reservation.id));
        
        if (reservationIds.length > 0) {
          whereCondition.reservationId = { [Op.in]: reservationIds };
          
          // تصفية نوع الخدمة حسب الدور
          if (req.user.role === 'maintenance') {
            whereCondition.serviceType = 'maintenance';
          } else if (req.user.role === 'accountant') {
            whereCondition.serviceType = 'financial';
          }
        } else {
          // لا توجد حجوزات مسموحة
          return res.status(200).json({
            status: 'success',
            data: {
              totalOrders: 0,
              byStatus: {},
              byServiceType: {}
            }
          });
        }
      }
    }
  }
  
  // الحصول على الإحصائيات
  const totalOrders = await ServiceOrder.count({ where: whereCondition });
  
  // إحصائيات حسب الحالة
  const statusStats = await ServiceOrder.findAll({
    where: whereCondition,
    attributes: [
      'status',
      [sequelize.fn('COUNT', sequelize.col('id')), 'count']
    ],
    group: ['status'],
    raw: true
  });
  
  // إحصائيات حسب نوع الخدمة
  const serviceTypeStats = await ServiceOrder.findAll({
    where: whereCondition,
    attributes: [
      'serviceType',
      [sequelize.fn('COUNT', sequelize.col('id')), 'count']
    ],
    group: ['serviceType'],
    raw: true
  });
  
  // تنسيق البيانات
  const byStatus = {};
  statusStats.forEach(stat => {
    byStatus[stat.status] = parseInt(stat.count);
  });
  
  const byServiceType = {};
  serviceTypeStats.forEach(stat => {
    byServiceType[stat.serviceType] = parseInt(stat.count);
  });
  
  res.status(200).json({
    status: 'success',
    data: {
      totalOrders,
      byStatus,
      byServiceType
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
  getServiceOrderHistory,
  getAllowedStatusesForServiceOrder,
  getServiceOrderStats
};