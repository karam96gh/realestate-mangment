// controllers/expense.controller.js

const Expense = require('../models/expense.model');
const RealEstateUnit = require('../models/realEstateUnit.model');
const Building = require('../models/building.model');
const Company = require('../models/company.model');
const { catchAsync, AppError } = require('../utils/errorHandler');
const { Op } = require('sequelize');

// الحصول على جميع المصاريف
const getAllExpenses = catchAsync(async (req, res, next) => {
  let whereCondition = {};
  let includeOptions = [
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

  // التحقق من صلاحيات المستخدم
  if (req.user.role === 'manager' || req.user.role === 'accountant') {
    if (!req.user.companyId) {
      return next(new AppError('المستخدم غير مرتبط بأي شركة', 403));
    }
    
    // فلترة المصاريف حسب الشركة
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
    
    const companyUnits = await RealEstateUnit.findAll({
      where: { buildingId: { [Op.in]: buildingIds } },
      attributes: ['id']
    });
    
    const unitIds = companyUnits.map(unit => unit.id);
    whereCondition.unitId = { [Op.in]: unitIds };
  } else if (req.user.role === 'owner') {
    // المالك يرى مصاريف وحداته فقط
    const ownedUnits = await RealEstateUnit.findAll({
      where: { ownerId: req.user.id },
      attributes: ['id']
    });
    
    if (ownedUnits.length === 0) {
      return res.status(200).json({
        status: 'success',
        results: 0,
        data: []
      });
    }
    
    const unitIds = ownedUnits.map(unit => unit.id);
    whereCondition.unitId = { [Op.in]: unitIds };
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

// الحصول على مصروف حسب المعرف
const getExpenseById = catchAsync(async (req, res, next) => {
  const expense = await Expense.findByPk(req.params.id, {
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
    ]
  });

  if (!expense) {
    return next(new AppError('لم يتم العثور على المصروف', 404));
  }

  // التحقق من الصلاحيات
  if (req.user.role === 'manager' || req.user.role === 'accountant') {
    if (expense.unit.building.companyId !== req.user.companyId) {
      return next(new AppError('غير مصرح لك بعرض هذا المصروف', 403));
    }
  } else if (req.user.role === 'owner') {
    if (expense.unit.ownerId !== req.user.id) {
      return next(new AppError('غير مصرح لك بعرض هذا المصروف', 403));
    }
  }

  res.status(200).json({
    status: 'success',
    data: expense
  });
});

// إنشاء مصروف جديد
const createExpense = catchAsync(async (req, res, next) => {
  // فقط المسؤولون والمديرون والمحاسبون يمكنهم إنشاء مصاريف
  if (!['admin', 'manager', 'accountant'].includes(req.user.role)) {
    return next(new AppError('غير مصرح لك بإنشاء مصاريف', 403));
  }

  const { unitId, expenseType, amount, expenseDate, notes } = req.body;

  // التحقق من وجود الوحدة
  const unit = await RealEstateUnit.findByPk(unitId, {
    include: [{
      model: Building,
      as: 'building'
    }]
  });

  if (!unit) {
    return next(new AppError('الوحدة غير موجودة', 404));
  }

  // التحقق من الصلاحيات للمدير والمحاسب
  if ((req.user.role === 'manager' || req.user.role === 'accountant') && 
      unit.building.companyId !== req.user.companyId) {
    return next(new AppError('غير مصرح لك بإنشاء مصاريف لهذه الوحدة', 403));
  }

  const newExpense = await Expense.create({
    unitId,
    expenseType,
    amount,
    expenseDate,
    notes
  });

  // إضافة معلومات الوحدة للاستجابة
  const expenseWithDetails = await Expense.findByPk(newExpense.id, {
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
    ]
  });

  res.status(201).json({
    status: 'success',
    data: expenseWithDetails
  });
});

// تحديث مصروف
const updateExpense = catchAsync(async (req, res, next) => {
  // فقط المسؤولون والمديرون والمحاسبون يمكنهم تحديث المصاريف
  if (!['admin', 'manager', 'accountant'].includes(req.user.role)) {
    return next(new AppError('غير مصرح لك بتحديث المصاريف', 403));
  }

  const expense = await Expense.findByPk(req.params.id, {
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
  });

  if (!expense) {
    return next(new AppError('المصروف غير موجود', 404));
  }

  // التحقق من الصلاحيات للمدير والمحاسب
  if ((req.user.role === 'manager' || req.user.role === 'accountant') && 
      expense.unit.building.companyId !== req.user.companyId) {
    return next(new AppError('غير مصرح لك بتحديث هذا المصروف', 403));
  }

  const { expenseType, amount, expenseDate, notes } = req.body;

  await expense.update({
    expenseType: expenseType || expense.expenseType,
    amount: amount !== undefined ? amount : expense.amount,
    expenseDate: expenseDate || expense.expenseDate,
    notes: notes !== undefined ? notes : expense.notes
  });

  res.status(200).json({
    status: 'success',
    data: expense
  });
});

// حذف مصروف
const deleteExpense = catchAsync(async (req, res, next) => {
  // فقط المسؤولون والمديرون يمكنهم حذف المصاريف
  if (!['admin', 'manager'].includes(req.user.role)) {
    return next(new AppError('غير مصرح لك بحذف المصاريف', 403));
  }

  const expense = await Expense.findByPk(req.params.id, {
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
  });

  if (!expense) {
    return next(new AppError('المصروف غير موجود', 404));
  }

  // التحقق من الصلاحيات للمدير
  if (req.user.role === 'manager' && 
      expense.unit.building.companyId !== req.user.companyId) {
    return next(new AppError('غير مصرح لك بحذف هذا المصروف', 403));
  }

  await expense.destroy();

  res.status(204).json({
    status: 'success',
    data: null
  });
});

// الحصول على مصاريف وحدة معينة
const getExpensesByUnitId = catchAsync(async (req, res, next) => {
  const unitId = req.params.unitId;

  // التحقق من وجود الوحدة
  const unit = await RealEstateUnit.findByPk(unitId, {
    include: [{
      model: Building,
      as: 'building'
    }]
  });

  if (!unit) {
    return next(new AppError('الوحدة غير موجودة', 404));
  }

  // التحقق من الصلاحيات
  if (req.user.role === 'manager' || req.user.role === 'accountant') {
    if (unit.building.companyId !== req.user.companyId) {
      return next(new AppError('غير مصرح لك بعرض مصاريف هذه الوحدة', 403));
    }
  } else if (req.user.role === 'owner') {
    if (unit.ownerId !== req.user.id) {
      return next(new AppError('غير مصرح لك بعرض مصاريف هذه الوحدة', 403));
    }
  }

  const expenses = await Expense.findAll({
    where: { unitId },
    order: [['expenseDate', 'DESC']]
  });

  res.status(200).json({
    status: 'success',
    results: expenses.length,
    data: expenses
  });
});

// إحصائيات المصاريف
const getExpenseStatistics = catchAsync(async (req, res, next) => {
  let whereCondition = {};

  // فلترة حسب صلاحيات المستخدم
  if (req.user.role === 'manager' || req.user.role === 'accountant') {
    if (!req.user.companyId) {
      return next(new AppError('المستخدم غير مرتبط بأي شركة', 403));
    }
    
    const companyBuildings = await Building.findAll({
      where: { companyId: req.user.companyId },
      attributes: ['id']
    });
    
    const buildingIds = companyBuildings.map(building => building.id);
    const companyUnits = await RealEstateUnit.findAll({
      where: { buildingId: { [Op.in]: buildingIds } },
      attributes: ['id']
    });
    
    const unitIds = companyUnits.map(unit => unit.id);
    whereCondition.unitId = { [Op.in]: unitIds };
  } else if (req.user.role === 'owner') {
    const ownedUnits = await RealEstateUnit.findAll({
      where: { ownerId: req.user.id },
      attributes: ['id']
    });
    
    const unitIds = ownedUnits.map(unit => unit.id);
    whereCondition.unitId = { [Op.in]: unitIds };
  }

  // إجمالي المصاريف
  const totalExpenses = await Expense.sum('amount', { where: whereCondition });

  // المصاريف حسب النوع
  const expensesByType = await Expense.findAll({
    attributes: [
      'expenseType',
      [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
      [sequelize.fn('SUM', sequelize.col('amount')), 'totalAmount']
    ],
    where: whereCondition,
    group: ['expenseType'],
    raw: true
  });

  // المصاريف حسب الشهر (آخر 6 شهور)
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const expensesByMonth = await Expense.findAll({
    attributes: [
      [sequelize.fn('DATE_FORMAT', sequelize.col('expenseDate'), '%Y-%m'), 'month'],
      [sequelize.fn('SUM', sequelize.col('amount')), 'totalAmount']
    ],
    where: {
      ...whereCondition,
      expenseDate: { [Op.gte]: sixMonthsAgo }
    },
    group: [sequelize.fn('DATE_FORMAT', sequelize.col('expenseDate'), '%Y-%m')],
    order: [[sequelize.fn('DATE_FORMAT', sequelize.col('expenseDate'), '%Y-%m'), 'DESC']],
    raw: true
  });

  res.status(200).json({
    status: 'success',
    data: {
      totalExpenses: totalExpenses || 0,
      expensesByType,
      expensesByMonth
    }
  });
});

module.exports = {
  getAllExpenses,
  getExpenseById,
  createExpense,
  updateExpense,
  deleteExpense,
  getExpensesByUnitId,
  getExpenseStatistics
};