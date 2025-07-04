// controllers/ownerReport.controller.js

const RealEstateUnit = require('../models/realEstateUnit.model');
const Building = require('../models/building.model');
const Company = require('../models/company.model');
const Reservation = require('../models/reservation.model');
const PaymentHistory = require('../models/paymentHistory.model');
const Expense = require('../models/expense.model');
const User = require('../models/user.model');
const { catchAsync, AppError } = require('../utils/errorHandler');
const { Op } = require('sequelize');
const sequelize = require('../config/database');
const ExcelJS = require('exceljs');

// الحصول على التقرير المالي الشامل للمالك
const getOwnerFinancialReport = catchAsync(async (req, res, next) => {
  // التحقق من أن المستخدم مالك
  if (req.user.role !== 'owner') {
    return next(new AppError('هذا التقرير متاح فقط لمالكي العقارات', 403));
  }

  const ownerId = req.user.id;
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth() + 1;
  const currentYear = currentDate.getFullYear();

  // الحصول على جميع الوحدات المملوكة
  const ownedUnits = await RealEstateUnit.findAll({
    where: { ownerId },
    include: [
      {
        model: Building,
        as: 'building',
        include: [{
          model: Company,
          as: 'company'
        }]
      },
      {
        model: User,
        as: 'owner',
        attributes: ['id', 'fullName', 'email', 'phone']
      }
    ],
    order: [['createdAt', 'ASC']]
  });

  if (ownedUnits.length === 0) {
    return next(new AppError('لا توجد وحدات مملوكة لهذا المستخدم', 404));
  }

  const unitIds = ownedUnits.map(unit => unit.id);

  // الحصول على الحجوزات النشطة للشهر الحالي
  const activeReservations = await Reservation.findAll({
    where: {
      unitId: { [Op.in]: unitIds },
      status: 'active',
      startDate: { [Op.lte]: currentDate },
      endDate: { [Op.gte]: currentDate }
    },
    include: [
      {
        model: User,
        as: 'user',
        attributes: ['id', 'fullName', 'phone', 'email']
      },
      {
        model: RealEstateUnit,
        as: 'unit',
        attributes: ['id', 'unitNumber', 'price']
      }
    ]
  });

  // الحصول على المدفوعات للشهر الحالي
  const currentMonthPayments = await PaymentHistory.findAll({
    where: {
      paymentDate: {
        [Op.between]: [
          `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`,
          `${currentYear}-${String(currentMonth).padStart(2, '0')}-31`
        ]
      }
    },
    include: [{
      model: Reservation,
      as: 'reservation',
      where: { unitId: { [Op.in]: unitIds } },
      include: [{
        model: RealEstateUnit,
        as: 'unit',
        attributes: ['id', 'unitNumber']
      }]
    }]
  });

  // الحصول على المصاريف للشهر الحالي
  const currentMonthExpenses = await Expense.findAll({
    where: {
      unitId: { [Op.in]: unitIds },
      expenseDate: {
        [Op.between]: [
          `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`,
          `${currentYear}-${String(currentMonth).padStart(2, '0')}-31`
        ]
      }
    },
    include: [{
      model: RealEstateUnit,
      as: 'unit',
      attributes: ['id', 'unitNumber']
    }]
  });

  // إعداد بيانات التقرير
  const reportData = ownedUnits.map(unit => {
    const activeReservation = activeReservations.find(res => res.unitId === unit.id);
    const unitPayments = currentMonthPayments.filter(payment => 
      payment.reservation.unitId === unit.id
    );
    const unitExpenses = currentMonthExpenses.filter(expense => 
      expense.unitId === unit.id
    );

    const totalPayments = unitPayments.reduce((sum, payment) => 
      sum + parseFloat(payment.amount), 0
    );
    const totalExpenses = unitExpenses.reduce((sum, expense) => 
      sum + parseFloat(expense.amount), 0
    );

    return {
      unit,
      activeReservation,
      payments: unitPayments,
      expenses: unitExpenses,
      totalPayments,
      totalExpenses,
      netIncome: totalPayments - totalExpenses
    };
  });

  // إنشاء ملف Excel
  const workbook = new ExcelJS.Workbook();
  
  // الورقة الأولى: ملخص عام
  const summarySheet = workbook.addWorksheet('ملخص عام');
  
  // إعداد رأس الملخص
  summarySheet.mergeCells('A1:F1');
  summarySheet.getCell('A1').value = `التقرير المالي الشامل - ${currentMonth}/${currentYear}`;
  summarySheet.getCell('A1').font = { bold: true, size: 16 };
  summarySheet.getCell('A1').alignment = { horizontal: 'center' };

  // معلومات المالك
  summarySheet.getCell('A3').value = 'اسم المالك:';
  summarySheet.getCell('B3').value = ownedUnits[0].owner.fullName;
  summarySheet.getCell('A4').value = 'البريد الإلكتروني:';
  summarySheet.getCell('B4').value = ownedUnits[0].owner.email;
  summarySheet.getCell('A5').value = 'رقم الهاتف:';
  summarySheet.getCell('B5').value = ownedUnits[0].owner.phone;

  // إحصائيات عامة
  const totalUnits = ownedUnits.length;
  const rentedUnits = reportData.filter(item => item.activeReservation).length;
  const availableUnits = totalUnits - rentedUnits;
  const totalMonthlyIncome = reportData.reduce((sum, item) => sum + item.totalPayments, 0);
  const totalMonthlyExpenses = reportData.reduce((sum, item) => sum + item.totalExpenses, 0);
  const netMonthlyIncome = totalMonthlyIncome - totalMonthlyExpenses;

  summarySheet.getCell('A7').value = 'إجمالي الوحدات:';
  summarySheet.getCell('B7').value = totalUnits;
  summarySheet.getCell('A8').value = 'الوحدات المؤجرة:';
  summarySheet.getCell('B8').value = rentedUnits;
  summarySheet.getCell('A9').value = 'الوحدات المتاحة:';
  summarySheet.getCell('B9').value = availableUnits;
  summarySheet.getCell('A10').value = 'معدل الإشغال:';
  summarySheet.getCell('B10').value = totalUnits > 0 ? `${((rentedUnits / totalUnits) * 100).toFixed(2)}%` : '0%';

  summarySheet.getCell('A12').value = 'إجمالي الإيرادات الشهرية:';
  summarySheet.getCell('B12').value = totalMonthlyIncome;
  summarySheet.getCell('A13').value = 'إجمالي المصاريف الشهرية:';
  summarySheet.getCell('B13').value = totalMonthlyExpenses;
  summarySheet.getCell('A14').value = 'صافي الربح الشهري:';
  summarySheet.getCell('B14').value = netMonthlyIncome;

  // تنسيق الخلايا
  ['A7', 'A8', 'A9', 'A10', 'A12', 'A13', 'A14'].forEach(cell => {
    summarySheet.getCell(cell).font = { bold: true };
  });

  // الورقة الثانية: تفاصيل الوحدات
  const unitsSheet = workbook.addWorksheet('تفاصيل الوحدات');
  
  // رأس الجدول
  const headers = [
    'رقم الوحدة', 'اسم المبنى', 'نوع الوحدة', 'الحالة', 'السعر الشهري',
    'اسم المستأجر', 'هاتف المستأجر', 'تاريخ بداية العقد', 'تاريخ نهاية العقد',
    'الإيرادات المحصلة', 'المصاريف', 'صافي الربح'
  ];

  headers.forEach((header, index) => {
    const cell = unitsSheet.getCell(1, index + 1);
    cell.value = header;
    cell.font = { bold: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
  });

  // بيانات الوحدات
  reportData.forEach((item, index) => {
    const row = index + 2;
    const unit = item.unit;
    const reservation = item.activeReservation;

    unitsSheet.getCell(row, 1).value = unit.unitNumber;
    unitsSheet.getCell(row, 2).value = unit.building.name;
    unitsSheet.getCell(row, 3).value = getUnitTypeArabic(unit.unitType);
    unitsSheet.getCell(row, 4).value = getUnitStatusArabic(unit.status);
    unitsSheet.getCell(row, 5).value = parseFloat(unit.price);
    unitsSheet.getCell(row, 6).value = reservation ? reservation.user.fullName : '-';
    unitsSheet.getCell(row, 7).value = reservation ? reservation.user.phone : '-';
    unitsSheet.getCell(row, 8).value = reservation ? reservation.startDate : '-';
    unitsSheet.getCell(row, 9).value = reservation ? reservation.endDate : '-';
    unitsSheet.getCell(row, 10).value = item.totalPayments;
    unitsSheet.getCell(row, 11).value = item.totalExpenses;
    unitsSheet.getCell(row, 12).value = item.netIncome;
  });

  // تعديل عرض الأعمدة
  unitsSheet.columns.forEach(column => {
    column.width = 15;
  });

  // الورقة الثالثة: تفاصيل المدفوعات
  const paymentsSheet = workbook.addWorksheet('تفاصيل المدفوعات');
  
  // رأس جدول المدفوعات
  const paymentHeaders = [
    'رقم الوحدة', 'اسم المستأجر', 'تاريخ الدفع', 'المبلغ', 'طريقة الدفع', 'الحالة', 'ملاحظات'
  ];

  paymentHeaders.forEach((header, index) => {
    const cell = paymentsSheet.getCell(1, index + 1);
    cell.value = header;
    cell.font = { bold: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
  });

  // بيانات المدفوعات
  let paymentRow = 2;
  currentMonthPayments.forEach(payment => {
    paymentsSheet.getCell(paymentRow, 1).value = payment.reservation.unit.unitNumber;
    paymentsSheet.getCell(paymentRow, 2).value = payment.reservation.user?.fullName || '-';
    paymentsSheet.getCell(paymentRow, 3).value = payment.paymentDate;
    paymentsSheet.getCell(paymentRow, 4).value = parseFloat(payment.amount);
    paymentsSheet.getCell(paymentRow, 5).value = payment.paymentMethod;
    paymentsSheet.getCell(paymentRow, 6).value = getPaymentStatusArabic(payment.status);
    paymentsSheet.getCell(paymentRow, 7).value = payment.notes || '-';
    paymentRow++;
  });

  // الورقة الرابعة: تفاصيل المصاريف
  const expensesSheet = workbook.addWorksheet('تفاصيل المصاريف');
  
  // رأس جدول المصاريف
  const expenseHeaders = [
    'رقم الوحدة', 'نوع المصروف', 'المبلغ', 'تاريخ المصروف', 'ملاحظات'
  ];

  expenseHeaders.forEach((header, index) => {
    const cell = expensesSheet.getCell(1, index + 1);
    cell.value = header;
    cell.font = { bold: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
  });

  // بيانات المصاريف
  let expenseRow = 2;
  currentMonthExpenses.forEach(expense => {
    expensesSheet.getCell(expenseRow, 1).value = expense.unit.unitNumber;
    expensesSheet.getCell(expenseRow, 2).value = getExpenseTypeArabic(expense.expenseType);
    expensesSheet.getCell(expenseRow, 3).value = parseFloat(expense.amount);
    expensesSheet.getCell(expenseRow, 4).value = expense.expenseDate;
    expensesSheet.getCell(expenseRow, 5).value = expense.notes || '-';
    expenseRow++;
  });

  // تعديل عرض الأعمدة في جميع الأوراق
  [summarySheet, unitsSheet, paymentsSheet, expensesSheet].forEach(sheet => {
    sheet.columns.forEach(column => {
      if (!column.width) column.width = 15;
    });
  });

  // إعداد الاستجابة
  const fileName = `تقرير_مالي_${ownedUnits[0].owner.fullName.replace(/\s+/g, '_')}_${currentMonth}_${currentYear}.xlsx`;
  
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

  // كتابة الملف وإرساله
  await workbook.xlsx.write(res);
  res.end();
});

// دوال مساعدة للترجمة
const getUnitTypeArabic = (type) => {
  const types = {
    'studio': 'ستديو',
    'apartment': 'شقة',
    'shop': 'محل',
    'office': 'مكتب',
    'villa': 'فيلا',
    'room': 'غرفة'
  };
  return types[type] || type;
};

const getUnitStatusArabic = (status) => {
  const statuses = {
    'available': 'متاح',
    'rented': 'مؤجر',
    'maintenance': 'صيانة'
  };
  return statuses[status] || status;
};

const getPaymentStatusArabic = (status) => {
  const statuses = {
    'paid': 'مدفوع',
    'pending': 'معلق',
    'delayed': 'متأخر',
    'cancelled': 'ملغي'
  };
  return statuses[status] || status;
};

const getExpenseTypeArabic = (type) => {
  const types = {
    'maintenance': 'صيانة',
    'utilities': 'خدمات',
    'insurance': 'تأمين',
    'cleaning': 'تنظيف',
    'security': 'أمن',
    'management': 'إدارة',
    'repairs': 'إصلاحات',
    'other': 'أخرى'
  };
  return types[type] || type;
};

module.exports = {
  getOwnerFinancialReport
};