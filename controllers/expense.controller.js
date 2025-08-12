// controllers/expense.controller.js - النسخة المحدثة

const Expense = require('../models/expense.model');
const RealEstateUnit = require('../models/realEstateUnit.model');
const Building = require('../models/building.model');
const Company = require('../models/company.model');
const ServiceOrder = require('../models/serviceOrder.model');
const Reservation = require('../models/reservation.model');
const User = require('../models/user.model');
const { catchAsync, AppError } = require('../utils/errorHandler');
const { Op } = require('sequelize');
const sequelize = require('../config/database');

// الحصول على جميع المصاريف مع التصفية الجديدة
const getAllExpenses = catchAsync(async (req, res, next) => {
  let whereCondition = {};
  let includeOptions = [
    { 
      model: Building, 
      as: 'building',
      include: [{ model: Company, as: 'company' }]
    },
    { 
      model: RealEstateUnit, 
      as: 'unit',
      required: false // LEFT JOIN لأن الوحدة اختيارية
    },
    {
      model: ServiceOrder,
      as: 'serviceOrder',
      required: false
    }
  ];

  // التحقق من صلاحيات المستخدم
  if (req.user.role === 'manager' || req.user.role === 'accountant') {
    if (!req.user.companyId) {
      return next(new AppError('المستخدم غير مرتبط بأي شركة', 403));
    }
    
    // فلترة المصاريف حسب الشركة
    includeOptions[0].where = { companyId: req.user.companyId };
  } 
  else if (req.user.role === 'owner') {
    // المالك يرى المصاريف الخاصة به أو التي تخص وحداته
    const ownedUnits = await RealEstateUnit.findAll({
      where: { ownerId: req.user.id },
      attributes: ['id', 'buildingId']
    });
    
    if (ownedUnits.length === 0) {
      return res.status(200).json({
        status: 'success',
        results: 0,
        data: []
      });
    }
    
    const ownedBuildingIds = [...new Set(ownedUnits.map(unit => unit.buildingId))];
    const ownedUnitIds = ownedUnits.map(unit => unit.id);
    
    whereCondition = {
      [Op.and]: [
        {
          [Op.or]: [
            { buildingId: { [Op.in]: ownedBuildingIds } },
            { unitId: { [Op.in]: ownedUnitIds } }
          ]
        },
        { responsibleParty: 'owner' }
      ]
    };
  }
  else if (req.user.role === 'tenant') {
    // المستأجر يرى المصاريف الخاصة به فقط
    const userReservations = await Reservation.findAll({
      where: { 
        userId: req.user.id,
        status: 'active'
      },
      attributes: ['unitId', 'id'],
      include: [{
        model: RealEstateUnit,
        as: 'unit',
        attributes: ['buildingId']
      }]
    });
    
    if (userReservations.length === 0) {
      return res.status(200).json({
        status: 'success',
        results: 0,
        data: []
      });
    }
    
    const tenantUnitIds = userReservations.map(res => res.unitId);
    const tenantBuildingIds = [...new Set(userReservations.map(res => res.unit.buildingId))];
    
    whereCondition = {
      [Op.and]: [
        {
          [Op.or]: [
            { buildingId: { [Op.in]: tenantBuildingIds } },
            { unitId: { [Op.in]: tenantUnitIds } }
          ]
        },
        { responsibleParty: 'tenant' }
      ]
    };
  }

  const expenses = await Expense.findAll({
    where: whereCondition,
    include: includeOptions,
    order: [['expenseDate', 'DESC']]
  });

  res.status(200).json({
    status: 'success',
    results: expenses.length,
    data: expenses
  });
});

// إنشاء مصروف جديد
const createExpense = catchAsync(async (req, res, next) => {
  // فقط المسؤولون والمديرون والمحاسبون يمكنهم إنشاء مصاريف
  if (!['admin', 'manager', 'accountant'].includes(req.user.role)) {
    return next(new AppError('غير مصرح لك بإنشاء مصاريف', 403));
  }

  const { 
    buildingId, 
    unitId, 
    serviceOrderId,
    expenseType, 
    amount, 
    expenseDate, 
    responsibleParty,
    attachmentDescription,
    notes 
  } = req.body;

  // التحقق من وجود المبنى
  const building = await Building.findByPk(buildingId);
  if (!building) {
    return next(new AppError('المبنى غير موجود', 404));
  }

  // التحقق من الصلاحيات للمدير والمحاسب
  if ((req.user.role === 'manager' || req.user.role === 'accountant') && 
      building.companyId !== req.user.companyId) {
    return next(new AppError('غير مصرح لك بإنشاء مصاريف لهذا المبنى', 403));
  }

  // التحقق من الوحدة إذا تم توفيرها
  if (unitId) {
    const unit = await RealEstateUnit.findOne({
      where: { 
        id: unitId,
        buildingId: buildingId 
      }
    });
    
    if (!unit) {
      return next(new AppError('الوحدة غير موجودة في هذا المبنى', 404));
    }
  }

  // التحقق من طلب الخدمة إذا تم توفيره
  if (serviceOrderId) {
    const serviceOrder = await ServiceOrder.findByPk(serviceOrderId);
    if (!serviceOrder) {
      return next(new AppError('طلب الخدمة غير موجود', 404));
    }
  }

  // معالجة المرفق
  let attachmentFile = null;
  if (req.file) {
    attachmentFile = req.file.filename;
  }

  const newExpense = await Expense.create({
    buildingId,
    unitId: unitId || null,
    serviceOrderId: serviceOrderId || null,
    expenseType,
    amount,
    expenseDate,
    responsibleParty,
    attachmentFile,
    attachmentDescription,
    notes
  });

  // تحديث طلب الخدمة إذا كان مرتبط
  if (serviceOrderId) {
    await ServiceOrder.update(
      { isExpenseCreated: true },
      { where: { id: serviceOrderId } }
    );
  }

  // إضافة معلومات المبنى والوحدة للاستجابة
  const expenseWithDetails = await Expense.findByPk(newExpense.id, {
    include: [
      { 
        model: Building, 
        as: 'building',
        include: [{ model: Company, as: 'company' }]
      },
      { 
        model: RealEstateUnit, 
        as: 'unit',
        required: false
      },
      {
        model: ServiceOrder,
        as: 'serviceOrder',
        required: false
      }
    ]
  });

  res.status(201).json({
    status: 'success',
    data: expenseWithDetails
  });
});

// إنشاء مصروف من طلب خدمة مكتمل (للمحاسب)
const createExpenseFromServiceOrder = catchAsync(async (req, res, next) => {
  // فقط المحاسبون يمكنهم إنشاء مصاريف من طلبات الخدمة
  if (req.user.role !== 'accountant') {
    return next(new AppError('غير مصرح لك بهذه العملية', 403));
  }

  const { serviceOrderId } = req.params;
  const { responsibleParty, notes } = req.body;

  // التحقق من طلب الخدمة
  const serviceOrder = await ServiceOrder.findByPk(serviceOrderId, {
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

  if (!serviceOrder) {
    return next(new AppError('طلب الخدمة غير موجود', 404));
  }

  if (serviceOrder.status !== 'completed') {
    return next(new AppError('يمكن إنشاء مصروف فقط من طلبات الخدمة المكتملة', 400));
  }

  if (serviceOrder.isExpenseCreated) {
    return next(new AppError('تم إنشاء مصروف لهذا الطلب مسبقاً', 400));
  }

  if (!serviceOrder.servicePrice) {
    return next(new AppError('سعر الخدمة غير محدد', 400));
  }

  // التحقق من الصلاحيات
  const building = serviceOrder.reservation.unit.building;
  if (building.companyId !== req.user.companyId) {
    return next(new AppError('غير مصرح لك بهذا الطلب', 403));
  }

  // إنشاء المصروف
  const expense = await Expense.create({
    buildingId: building.id,
    unitId: serviceOrder.reservation.unitId,
    serviceOrderId: serviceOrder.id,
    expenseType: serviceOrder.serviceType === 'maintenance' ? 'maintenance' : 'other',
    amount: serviceOrder.servicePrice,
    expenseDate: new Date(),
    responsibleParty,
    attachmentFile: serviceOrder.completionAttachment,
    attachmentDescription: serviceOrder.completionDescription,
    notes
  });

  // تحديث طلب الخدمة
  await serviceOrder.update({ isExpenseCreated: true });

  // إرجاع المصروف مع التفاصيل
  const expenseWithDetails = await Expense.findByPk(expense.id, {
    include: [
      { 
        model: Building, 
        as: 'building',
        include: [{ model: Company, as: 'company' }]
      },
      { 
        model: RealEstateUnit, 
        as: 'unit'
      },
      {
        model: ServiceOrder,
        as: 'serviceOrder'
      }
    ]
  });

  res.status(201).json({
    status: 'success',
    data: expenseWithDetails
  });
});

// الحصول على طلبات الخدمة المكتملة التي تحتاج إنشاء مصروف
const getCompletedServiceOrdersForExpense = catchAsync(async (req, res, next) => {
  // فقط المحاسبون يمكنهم الوصول لهذه البيانات
  if (req.user.role !== 'accountant') {
    return next(new AppError('غير مصرح لك بهذه العملية', 403));
  }

  if (!req.user.companyId) {
    return next(new AppError('المحاسب غير مرتبط بأي شركة', 403));
  }

  // الحصول على طلبات الخدمة المكتملة التي لم يتم إنشاء مصروف لها
  const completedServiceOrders = await ServiceOrder.findAll({
    where: {
      status: 'completed',
      isExpenseCreated: false,
      servicePrice: { [Op.ne]: null }
    },
    include: [{
      model: Reservation,
      as: 'reservation',
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'fullName', 'phone']
        },
        {
          model: RealEstateUnit,
          as: 'unit',
          include: [{
            model: Building,
            as: 'building',
            where: { companyId: req.user.companyId },
            include: [{ model: Company, as: 'company' }]
          }]
        }
      ]
    }],
    order: [['updatedAt', 'DESC']]
  });

  res.status(200).json({
    status: 'success',
    results: completedServiceOrders.length,
    data: completedServiceOrders
  });
});

// باقي الدوال (تحديث، حذف، إحصائيات)
const updateExpense = catchAsync(async (req, res, next) => {
  // فقط المسؤولون والمديرون والمحاسبون يمكنهم تحديث المصاريف
  if (!['admin', 'manager', 'accountant'].includes(req.user.role)) {
    return next(new AppError('غير مصرح لك بتحديث المصاريف', 403));
  }

  const expense = await Expense.findByPk(req.params.id, {
    include: [{ model: Building, as: 'building' }]
  });

  if (!expense) {
    return next(new AppError('المصروف غير موجود', 404));
  }

  // التحقق من الصلاحيات للمدير والمحاسب
  if ((req.user.role === 'manager' || req.user.role === 'accountant') && 
      expense.building.companyId !== req.user.companyId) {
    return next(new AppError('غير مصرح لك بتحديث هذا المصروف', 403));
  }

  const { 
    expenseType, 
    amount, 
    expenseDate, 
    responsibleParty,
    attachmentDescription,
    notes 
  } = req.body;

  // معالجة المرفق الجديد
  let attachmentFile = expense.attachmentFile;
  if (req.file) {
    attachmentFile = req.file.filename;
  }

  await expense.update({
    expenseType: expenseType || expense.expenseType,
    amount: amount !== undefined ? amount : expense.amount,
    expenseDate: expenseDate || expense.expenseDate,
    responsibleParty: responsibleParty || expense.responsibleParty,
    attachmentFile,
    attachmentDescription: attachmentDescription !== undefined ? attachmentDescription : expense.attachmentDescription,
    notes: notes !== undefined ? notes : expense.notes
  });

  res.status(200).json({
    status: 'success',
    data: expense
  });
});

const deleteExpense = catchAsync(async (req, res, next) => {
  // فقط المسؤولون والمديرون يمكنهم حذف المصاريف
  if (!['admin', 'manager'].includes(req.user.role)) {
    return next(new AppError('غير مصرح لك بحذف المصاريف', 403));
  }

  const expense = await Expense.findByPk(req.params.id, {
    include: [{ model: Building, as: 'building' }]
  });

  if (!expense) {
    return next(new AppError('المصروف غير موجود', 404));
  }

  // التحقق من الصلاحيات للمدير
  if (req.user.role === 'manager' && 
      expense.building.companyId !== req.user.companyId) {
    return next(new AppError('غير مصرح لك بحذف هذا المصروف', 403));
  }

  // إذا كان المصروف مرتبط بطلب خدمة، تحديث حالة الطلب
  if (expense.serviceOrderId) {
    await ServiceOrder.update(
      { isExpenseCreated: false },
      { where: { id: expense.serviceOrderId } }
    );
  }

  await expense.destroy();

  res.status(204).json({
    status: 'success',
    data: null
  });
});

module.exports = {
  getAllExpenses,
  createExpense,
  createExpenseFromServiceOrder,
  getCompletedServiceOrdersForExpense,
  updateExpense,
  deleteExpense
};