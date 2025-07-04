// controllers/ownerReport.controller.js - نسخة احترافية محسّنة

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

// الحصول على التقرير المالي الشامل للمالك - نسخة احترافية
const getOwnerFinancialReport = catchAsync(async (req, res, next) => {
  if (req.user.role !== 'owner') {
    return next(new AppError('هذا التقرير متاح فقط لمالكي العقارات', 403));
  }

  const ownerId = req.user.id;
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth() + 1;
  const currentYear = currentDate.getFullYear();

  // حساب تواريخ مختلفة للتحليل
  const startOfMonth = new Date(currentYear, currentMonth - 1, 1);
  const endOfMonth = new Date(currentYear, currentMonth, 0);
  const startOfYear = new Date(currentYear, 0, 1);
  const lastYearStart = new Date(currentYear - 1, 0, 1);
  const lastYearEnd = new Date(currentYear - 1, 11, 31);

  // الحصول على جميع الوحدات المملوكة مع تفاصيل شاملة
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
        attributes: ['id', 'fullName', 'email', 'phone', 'whatsappNumber']
      }
    ],
    order: [['createdAt', 'ASC']]
  });

  if (ownedUnits.length === 0) {
    return next(new AppError('لا توجد وحدات مملوكة لهذا المستخدم', 404));
  }

  const unitIds = ownedUnits.map(unit => unit.id);

  // الحصول على الحجوزات النشطة والتاريخية
  const [activeReservations, allReservations, currentMonthPayments, yearToDatePayments, 
         lastYearPayments, currentMonthExpenses, yearToDateExpenses, lastYearExpenses] = await Promise.all([
    
    // الحجوزات النشطة
    Reservation.findAll({
      where: {
        unitId: { [Op.in]: unitIds },
        status: 'active',
        startDate: { [Op.lte]: currentDate },
        endDate: { [Op.gte]: currentDate }
      },
      include: [
        { model: User, as: 'user', attributes: ['id', 'fullName', 'phone', 'email'] },
        { model: RealEstateUnit, as: 'unit', attributes: ['id', 'unitNumber', 'price'] }
      ]
    }),

    // جميع الحجوزات للتحليل التاريخي
    Reservation.findAll({
      where: { unitId: { [Op.in]: unitIds } },
      include: [
        { model: User, as: 'user', attributes: ['id', 'fullName', 'phone', 'email'] },
        { model: RealEstateUnit, as: 'unit', attributes: ['id', 'unitNumber', 'price'] }
      ]
    }),

    // المدفوعات - الشهر الحالي
    PaymentHistory.findAll({
      where: {
        paymentDate: { [Op.between]: [startOfMonth, endOfMonth] },
        status: { [Op.in]: ['paid', 'pending'] }
      },
      include: [{
        model: Reservation, as: 'reservation',
        where: { unitId: { [Op.in]: unitIds } },
        include: [
          { model: RealEstateUnit, as: 'unit', attributes: ['id', 'unitNumber'] },
          { model: User, as: 'user', attributes: ['id', 'fullName'] }
        ]
      }]
    }),

    // المدفوعات - من بداية السنة
    PaymentHistory.findAll({
      where: {
        paymentDate: { [Op.between]: [startOfYear, currentDate] },
        status: { [Op.in]: ['paid', 'pending'] }
      },
      include: [{
        model: Reservation, as: 'reservation',
        where: { unitId: { [Op.in]: unitIds } },
        include: [{ model: RealEstateUnit, as: 'unit', attributes: ['id', 'unitNumber'] }]
      }]
    }),

    // المدفوعات - السنة الماضية
    PaymentHistory.findAll({
      where: {
        paymentDate: { [Op.between]: [lastYearStart, lastYearEnd] },
        status: { [Op.in]: ['paid', 'pending'] }
      },
      include: [{
        model: Reservation, as: 'reservation',
        where: { unitId: { [Op.in]: unitIds } },
        include: [{ model: RealEstateUnit, as: 'unit', attributes: ['id', 'unitNumber'] }]
      }]
    }),

    // المصاريف - الشهر الحالي
    Expense.findAll({
      where: {
        unitId: { [Op.in]: unitIds },
        expenseDate: { [Op.between]: [startOfMonth, endOfMonth] }
      },
      include: [{ model: RealEstateUnit, as: 'unit', attributes: ['id', 'unitNumber'] }]
    }),

    // المصاريف - من بداية السنة
    Expense.findAll({
      where: {
        unitId: { [Op.in]: unitIds },
        expenseDate: { [Op.between]: [startOfYear, currentDate] }
      },
      include: [{ model: RealEstateUnit, as: 'unit', attributes: ['id', 'unitNumber'] }]
    }),

    // المصاريف - السنة الماضية
    Expense.findAll({
      where: {
        unitId: { [Op.in]: unitIds },
        expenseDate: { [Op.between]: [lastYearStart, lastYearEnd] }
      },
      include: [{ model: RealEstateUnit, as: 'unit', attributes: ['id', 'unitNumber'] }]
    })
  ]);

  // حساب الإحصائيات المالية الدقيقة
  const calculations = calculateFinancialMetrics({
    ownedUnits,
    activeReservations,
    allReservations,
    currentMonthPayments,
    yearToDatePayments,
    lastYearPayments,
    currentMonthExpenses,
    yearToDateExpenses,
    lastYearExpenses
  });

  // إنشاء ملف Excel احترافي
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Real Estate Management System';
  workbook.created = new Date();

  // الصفحة الرئيسية: الملخص التنفيذي
  await createExecutiveSummarySheet(workbook, {
    owner: ownedUnits[0].owner,
    calculations,
    currentMonth,
    currentYear
  });

  // صفحة تفاصيل الوحدات مع التحليل المالي
  await createUnitsDetailSheet(workbook, {
    ownedUnits,
    activeReservations,
    currentMonthPayments,
    currentMonthExpenses,
    calculations
  });

  // صفحة التحليل المالي الشامل
  await createFinancialAnalysisSheet(workbook, {
    calculations,
    currentMonth,
    currentYear
  });

  // صفحة تفاصيل المعاملات
  await createTransactionsSheet(workbook, {
    currentMonthPayments,
    currentMonthExpenses
  });

  // إعداد الاستجابة
  const ownerNameSafe = ownedUnits[0].owner.fullName
    .replace(/\s+/g, '_')
    .replace(/[^\w\-_.]/g, '')
    .substring(0, 20);
    
  const fileName = `Professional_Financial_Report_${ownerNameSafe}_${currentMonth}_${currentYear}.xlsx`;
  
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

  await workbook.xlsx.write(res);
  res.end();
});

// دالة حساب المقاييس المالية
function calculateFinancialMetrics(data) {
  const {
    ownedUnits,
    activeReservations,
    currentMonthPayments,
    yearToDatePayments,
    lastYearPayments,
    currentMonthExpenses,
    yearToDateExpenses,
    lastYearExpenses
  } = data;

  // الإحصائيات الأساسية
  const totalUnits = ownedUnits.length;
  const rentedUnits = activeReservations.length;
  const availableUnits = totalUnits - rentedUnits;
  const occupancyRate = totalUnits > 0 ? (rentedUnits / totalUnits) * 100 : 0;

  // الإيرادات
  const monthlyIncome = currentMonthPayments
    .filter(p => p.status === 'paid')
    .reduce((sum, p) => sum + parseFloat(p.amount), 0);
  
  const monthlyPending = currentMonthPayments
    .filter(p => p.status === 'pending')
    .reduce((sum, p) => sum + parseFloat(p.amount), 0);

  const yearToDateIncome = yearToDatePayments
    .filter(p => p.status === 'paid')
    .reduce((sum, p) => sum + parseFloat(p.amount), 0);

  const lastYearIncome = lastYearPayments
    .filter(p => p.status === 'paid')
    .reduce((sum, p) => sum + parseFloat(p.amount), 0);

  // المصاريف
  const monthlyExpenses = currentMonthExpenses
    .reduce((sum, e) => sum + parseFloat(e.amount), 0);

  const yearToDateExpensesTotal = yearToDateExpenses
    .reduce((sum, e) => sum + parseFloat(e.amount), 0);

  const lastYearExpensesTotal = lastYearExpenses
    .reduce((sum, e) => sum + parseFloat(e.amount), 0);

  // الأرباح
  const monthlyProfit = monthlyIncome - monthlyExpenses;
  const yearToDateProfit = yearToDateIncome - yearToDateExpensesTotal;
  const lastYearProfit = lastYearIncome - lastYearExpensesTotal;

  // معدلات الربحية
  const profitMargin = monthlyIncome > 0 ? (monthlyProfit / monthlyIncome) * 100 : 0;
  const roi = calculateROI(ownedUnits, yearToDateProfit);

  // نمو سنوي
  const incomeGrowth = lastYearIncome > 0 ? 
    ((yearToDateIncome - lastYearIncome) / lastYearIncome) * 100 : 0;

  // الإيراد المتوقع الشهري (من الوحدات المؤجرة)
  const expectedMonthlyIncome = activeReservations
    .reduce((sum, res) => sum + parseFloat(res.unit.price), 0);

  // معدل التحصيل
  const collectionRate = expectedMonthlyIncome > 0 ? 
    (monthlyIncome / expectedMonthlyIncome) * 100 : 0;

  // تحليل المصاريف حسب النوع
  const expensesByType = groupExpensesByType(currentMonthExpenses);

  // تحليل الوحدات
  const unitAnalysis = analyzeUnits(ownedUnits, activeReservations, currentMonthPayments, currentMonthExpenses);

  return {
    basic: {
      totalUnits,
      rentedUnits,
      availableUnits,
      occupancyRate
    },
    income: {
      monthlyIncome,
      monthlyPending,
      yearToDateIncome,
      lastYearIncome,
      expectedMonthlyIncome,
      collectionRate
    },
    expenses: {
      monthlyExpenses,
      yearToDateExpensesTotal,
      lastYearExpensesTotal,
      expensesByType
    },
    profitability: {
      monthlyProfit,
      yearToDateProfit,
      lastYearProfit,
      profitMargin,
      roi,
      incomeGrowth
    },
    unitAnalysis
  };
}

// دالة حساب العائد على الاستثمار
function calculateROI(units, yearToDateProfit) {
  const totalInvestment = units.reduce((sum, unit) => {
    // تقدير قيمة الاستثمار = السعر الشهري × 100 (تقدير تقريبي)
    return sum + (parseFloat(unit.price) * 100);
  }, 0);
  
  return totalInvestment > 0 ? (yearToDateProfit / totalInvestment) * 100 : 0;
}

// تجميع المصاريف حسب النوع
function groupExpensesByType(expenses) {
  const groups = {};
  expenses.forEach(expense => {
    const type = expense.expenseType;
    if (!groups[type]) {
      groups[type] = { count: 0, total: 0 };
    }
    groups[type].count++;
    groups[type].total += parseFloat(expense.amount);
  });
  return groups;
}

// تحليل الوحدات
function analyzeUnits(units, activeReservations, payments, expenses) {
  return units.map(unit => {
    const reservation = activeReservations.find(r => r.unitId === unit.id);
    const unitPayments = payments.filter(p => p.reservation.unitId === unit.id);
    const unitExpenses = expenses.filter(e => e.unitId === unit.id);
    
    const income = unitPayments
      .filter(p => p.status === 'paid')
      .reduce((sum, p) => sum + parseFloat(p.amount), 0);
    
    const pending = unitPayments
      .filter(p => p.status === 'pending')
      .reduce((sum, p) => sum + parseFloat(p.amount), 0);
    
    const totalExpenses = unitExpenses
      .reduce((sum, e) => sum + parseFloat(e.amount), 0);
    
    const netProfit = income - totalExpenses;
    const profitMargin = income > 0 ? (netProfit / income) * 100 : 0;
    
    return {
      unit,
      reservation,
      financials: {
        income,
        pending,
        expenses: totalExpenses,
        netProfit,
        profitMargin,
        expectedIncome: unit.price
      },
      performance: calculateUnitPerformance(income, parseFloat(unit.price))
    };
  });
}

// حساب أداء الوحدة
function calculateUnitPerformance(actualIncome, expectedIncome) {
  if (expectedIncome === 0) return 'غير محدد';
  const performance = (actualIncome / expectedIncome) * 100;
  
  if (performance >= 100) return 'ممتاز';
  if (performance >= 80) return 'جيد';
  if (performance >= 60) return 'متوسط';
  return 'ضعيف';
}

// إنشاء ورقة الملخص التنفيذي
async function createExecutiveSummarySheet(workbook, data) {
  const sheet = workbook.addWorksheet('الملخص التنفيذي');
  const { owner, calculations, currentMonth, currentYear } = data;

  // تعيين اتجاه الورقة من اليمين لليسار
  sheet.views = [{ rightToLeft: true }];

  // ألوان التصميم
  const colors = {
    primary: '1f4788',
    secondary: '3498db',
    success: '27ae60',
    warning: 'f39c12',
    danger: 'e74c3c',
    light: 'ecf0f1',
    dark: '2c3e50'
  };

  // العنوان الرئيسي
  sheet.mergeCells('A1:H1');
  const titleCell = sheet.getCell('A1');
  titleCell.value = `التقرير المالي الشامل - ${getMonthNameArabic(currentMonth)} ${currentYear}`;
  titleCell.font = { bold: true, size: 18, color: { argb: 'FFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.primary } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(1).height = 35;

  // معلومات المالك
  let row = 3;
  addSectionHeader(sheet, row, 'معلومات المالك', colors.secondary);
  row += 2;
  
  const ownerInfo = [
    ['الاسم:', owner.fullName],
    ['البريد الإلكتروني:', owner.email || '-'],
    ['رقم الهاتف:', owner.phone || '-'],
    ['واتساب:', owner.whatsappNumber || '-']
  ];

  ownerInfo.forEach(([label, value]) => {
    sheet.getCell(`A${row}`).value = label;
    sheet.getCell(`A${row}`).font = { bold: true };
    sheet.getCell(`B${row}`).value = value;
    row++;
  });

  // الأداء المالي الرئيسي
  row += 2;
  addSectionHeader(sheet, row, 'الأداء المالي الرئيسي', colors.success);
  row += 2;

  const kpis = [
    { label: 'إجمالي الوحدات', value: calculations.basic.totalUnits, format: 'number', color: colors.primary },
    { label: 'معدل الإشغال', value: calculations.basic.occupancyRate, format: 'percentage', color: colors.secondary },
    { label: 'الإيرادات الشهرية', value: calculations.income.monthlyIncome, format: 'currency', color: colors.success },
    { label: 'صافي الربح الشهري', value: calculations.profitability.monthlyProfit, format: 'currency', color: calculations.profitability.monthlyProfit >= 0 ? colors.success : colors.danger }
  ];

  // إنشاء بطاقات KPI
  let col = 1;
  kpis.forEach(kpi => {
    createKPICard(sheet, row, col, kpi, colors);
    col += 2;
  });

  row += 4;

  // تحليل الإيرادات والمصاريف
  addSectionHeader(sheet, row, 'تحليل الإيرادات والمصاريف', colors.warning);
  row += 2;

  const financialData = [
    ['المؤشر', 'الشهر الحالي', 'من بداية السنة', 'السنة الماضية', 'النمو السنوي'],
    ['الإيرادات', calculations.income.monthlyIncome, calculations.income.yearToDateIncome, calculations.income.lastYearIncome, `${calculations.profitability.incomeGrowth.toFixed(1)}%`],
    ['المصاريف', calculations.expenses.monthlyExpenses, calculations.expenses.yearToDateExpensesTotal, calculations.expenses.lastYearExpensesTotal, '-'],
    ['صافي الربح', calculations.profitability.monthlyProfit, calculations.profitability.yearToDateProfit, calculations.profitability.lastYearProfit, '-'],
    ['هامش الربح', `${calculations.profitability.profitMargin.toFixed(1)}%`, '-', '-', '-']
  ];

  createStyledTable(sheet, row, financialData, colors);
  row += financialData.length + 2;

  // ملخص الوحدات
  addSectionHeader(sheet, row, 'ملخص أداء الوحدات', colors.dark);
  row += 2;

  const topPerformingUnits = calculations.unitAnalysis
    .sort((a, b) => b.financials.netProfit - a.financials.netProfit)
    .slice(0, 5);

  const unitHeaders = ['رقم الوحدة', 'الحالة', 'الإيراد', 'المصاريف', 'صافي الربح', 'الأداء'];
  const unitData = [unitHeaders];

  topPerformingUnits.forEach(unitAnalysis => {
    unitData.push([
      unitAnalysis.unit.unitNumber,
      getUnitStatusArabic(unitAnalysis.unit.status),
      unitAnalysis.financials.income,
      unitAnalysis.financials.expenses,
      unitAnalysis.financials.netProfit,
      unitAnalysis.performance
    ]);
  });

  createStyledTable(sheet, row, unitData, colors);

  // تنسيق عام للورقة
  sheet.columns.forEach((column, index) => {
    column.width = index === 0 ? 25 : 15;
  });
}

// إنشاء ورقة تفاصيل الوحدات
async function createUnitsDetailSheet(workbook, data) {
  const sheet = workbook.addWorksheet('تفاصيل الوحدات');
  sheet.views = [{ rightToLeft: true }];

  const colors = {
    header: '34495e',
    subheader: '7f8c8d',
    positive: '27ae60',
    negative: 'e74c3c',
    neutral: '95a5a6'
  };

  // العنوان
  sheet.mergeCells('A1:L1');
  const titleCell = sheet.getCell('A1');
  titleCell.value = 'تحليل مفصل لجميع الوحدات العقارية';
  titleCell.font = { bold: true, size: 16, color: { argb: 'FFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.header } };
  titleCell.alignment = { horizontal: 'center' };

  // رؤوس الأعمدة
  const headers = [
    'رقم الوحدة', 'المبنى', 'النوع', 'الحالة', 'السعر المحدد',
    'المستأجر', 'هاتف المستأجر', 'الإيراد المحصل', 'المبالغ المعلقة',
    'المصاريف', 'صافي الربح', 'معدل الأداء', 'تقييم الأداء'
  ];

  headers.forEach((header, index) => {
    const cell = sheet.getCell(3, index + 1);
    cell.value = header;
    cell.font = { bold: true, color: { argb: 'FFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.subheader } };
    cell.alignment = { horizontal: 'center' };
  });

  // بيانات الوحدات
  data.calculations.unitAnalysis.forEach((unitAnalysis, index) => {
    const row = index + 4;
    const unit = unitAnalysis.unit;
    const reservation = unitAnalysis.reservation;
    const financials = unitAnalysis.financials;

    // ألوان حسب الأداء
    let performanceColor = colors.neutral;
    if (financials.netProfit > 0) performanceColor = colors.positive;
    if (financials.netProfit < 0) performanceColor = colors.negative;

    const rowData = [
      unit.unitNumber,
      unit.building.name,
      getUnitTypeArabic(unit.unitType),
      getUnitStatusArabic(unit.status),
      parseFloat(unit.price),
      reservation ? reservation.user.fullName : 'غير مؤجر',
      reservation ? reservation.user.phone : '-',
      financials.income,
      financials.pending,
      financials.expenses,
      financials.netProfit,
      `${financials.profitMargin.toFixed(1)}%`,
      unitAnalysis.performance
    ];

    rowData.forEach((value, colIndex) => {
      const cell = sheet.getCell(row, colIndex + 1);
      cell.value = value;
      
      // تنسيق خاص للأرقام
      if ([4, 7, 8, 9, 10].includes(colIndex)) {
        cell.numFmt = '#,##0.00';
      }
      
      // لون خاص لصافي الربح
      if (colIndex === 10) {
        cell.font = { 
          color: { argb: financials.netProfit >= 0 ? colors.positive : colors.negative },
          bold: true 
        };
      }
    });
  });

  // تنسيق الأعمدة
  const columnWidths = [12, 15, 10, 10, 12, 18, 15, 12, 12, 12, 12, 12, 12];
  columnWidths.forEach((width, index) => {
    sheet.getColumn(index + 1).width = width;
  });
}

// إنشاء ورقة التحليل المالي
async function createFinancialAnalysisSheet(workbook, data) {
  const sheet = workbook.addWorksheet('التحليل المالي');
  sheet.views = [{ rightToLeft: true }];

  const colors = {
    primary: '2c3e50',
    income: '27ae60',
    expense: 'e74c3c',
    profit: '3498db'
  };

  let row = 1;

  // العنوان
  sheet.mergeCells('A1:F1');
  const titleCell = sheet.getCell('A1');
  titleCell.value = 'التحليل المالي المتقدم';
  titleCell.font = { bold: true, size: 16, color: { argb: 'FFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.primary } };
  titleCell.alignment = { horizontal: 'center' };
  row += 3;

  // تحليل المصاريف حسب النوع
  addSectionHeader(sheet, row, 'تحليل المصاريف حسب النوع', colors.expense);
  row += 2;

  const expenseTypes = Object.entries(data.calculations.expenses.expensesByType);
  if (expenseTypes.length > 0) {
    const expenseHeaders = ['نوع المصروف', 'عدد المعاملات', 'إجمالي المبلغ', 'النسبة من الإجمالي'];
    const expenseData = [expenseHeaders];

    const totalExpenses = data.calculations.expenses.monthlyExpenses;

    expenseTypes.forEach(([type, data]) => {
      const percentage = totalExpenses > 0 ? (data.total / totalExpenses * 100).toFixed(1) : 0;
      expenseData.push([
        getExpenseTypeArabic(type),
        data.count,
        data.total,
        `${percentage}%`
      ]);
    });

    createStyledTable(sheet, row, expenseData, colors);
    row += expenseData.length + 3;
  }

  // مؤشرات الأداء المالي
  addSectionHeader(sheet, row, 'مؤشرات الأداء المالي الرئيسية', colors.profit);
  row += 2;

  const kpiData = [
    ['المؤشر', 'القيمة', 'التفسير'],
    ['العائد على الاستثمار (ROI)', `${data.calculations.profitability.roi.toFixed(2)}%`, getRoiInterpretation(data.calculations.profitability.roi)],
    ['هامش الربح', `${data.calculations.profitability.profitMargin.toFixed(1)}%`, getProfitMarginInterpretation(data.calculations.profitability.profitMargin)],
    ['معدل الإشغال', `${data.calculations.basic.occupancyRate.toFixed(1)}%`, getOccupancyInterpretation(data.calculations.basic.occupancyRate)],
    ['معدل التحصيل', `${data.calculations.income.collectionRate.toFixed(1)}%`, getCollectionInterpretation(data.calculations.income.collectionRate)],
    ['نمو الإيرادات السنوي', `${data.calculations.profitability.incomeGrowth.toFixed(1)}%`, getGrowthInterpretation(data.calculations.profitability.incomeGrowth)]
  ];

  createStyledTable(sheet, row, kpiData, colors);
}

// إنشاء ورقة المعاملات
async function createTransactionsSheet(workbook, data) {
  const sheet = workbook.addWorksheet('سجل المعاملات');
  sheet.views = [{ rightToLeft: true }];

  const colors = {
    header: '34495e',
    payment: '27ae60',
    expense: 'e74c3c',
    pending: 'f39c12'
  };

  let row = 1;

  // العنوان الرئيسي
  sheet.mergeCells('A1:H1');
  const titleCell = sheet.getCell('A1');
  titleCell.value = 'سجل جميع المعاملات المالية للشهر الحالي';
  titleCell.font = { bold: true, size: 16, color: { argb: 'FFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.header } };
  titleCell.alignment = { horizontal: 'center' };
  row += 3;

  // قسم المدفوعات
  addSectionHeader(sheet, row, '📈 المدفوعات والإيرادات', colors.payment);
  row += 2;

  if (data.currentMonthPayments.length > 0) {
    const paymentHeaders = [
      'التاريخ', 'رقم الوحدة', 'المستأجر', 'المبلغ', 'طريقة الدفع', 'الحالة', 'ملاحظات'
    ];

    // إضافة رؤوس الأعمدة
    paymentHeaders.forEach((header, index) => {
      const cell = sheet.getCell(row, index + 1);
      cell.value = header;
      cell.font = { bold: true, color: { argb: 'FFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.payment } };
      cell.alignment = { horizontal: 'center' };
    });
    row++;

    // بيانات المدفوعات
    data.currentMonthPayments.forEach(payment => {
      const rowData = [
        payment.paymentDate,
        payment.reservation.unit.unitNumber,
        payment.reservation.user?.fullName || '-',
        parseFloat(payment.amount),
        getPaymentMethodArabic(payment.paymentMethod),
        getPaymentStatusArabic(payment.status),
        payment.notes || '-'
      ];

      rowData.forEach((value, colIndex) => {
        const cell = sheet.getCell(row, colIndex + 1);
        cell.value = value;
        
        // تنسيق المبلغ
        if (colIndex === 3) {
          cell.numFmt = '#,##0.00';
          cell.font = { bold: true };
        }
        
        // لون حسب الحالة
        if (colIndex === 5) {
          const statusColor = payment.status === 'paid' ? colors.payment : colors.pending;
          cell.font = { color: { argb: statusColor }, bold: true };
        }
      });
      row++;
    });

    // إضافة إجمالي المدفوعات
    row++;
    const totalPayments = data.currentMonthPayments
      .filter(p => p.status === 'paid')
      .reduce((sum, p) => sum + parseFloat(p.amount), 0);
    
    const pendingPayments = data.currentMonthPayments
      .filter(p => p.status === 'pending')
      .reduce((sum, p) => sum + parseFloat(p.amount), 0);

    sheet.getCell(row, 3).value = 'إجمالي المحصل:';
    sheet.getCell(row, 3).font = { bold: true };
    sheet.getCell(row, 4).value = totalPayments;
    sheet.getCell(row, 4).numFmt = '#,##0.00';
    sheet.getCell(row, 4).font = { bold: true, color: { argb: colors.payment } };

    row++;
    sheet.getCell(row, 3).value = 'إجمالي المعلق:';
    sheet.getCell(row, 3).font = { bold: true };
    sheet.getCell(row, 4).value = pendingPayments;
    sheet.getCell(row, 4).numFmt = '#,##0.00';
    sheet.getCell(row, 4).font = { bold: true, color: { argb: colors.pending } };

    row += 3;
  } else {
    sheet.getCell(row, 1).value = 'لا توجد مدفوعات مسجلة للشهر الحالي';
    sheet.getCell(row, 1).font = { italic: true };
    row += 3;
  }

  // قسم المصاريف
  addSectionHeader(sheet, row, '📉 المصاريف والتكاليف', colors.expense);
  row += 2;

  if (data.currentMonthExpenses.length > 0) {
    const expenseHeaders = [
      'التاريخ', 'رقم الوحدة', 'نوع المصروف', 'المبلغ', 'ملاحظات'
    ];

    // رؤوس الأعمدة
    expenseHeaders.forEach((header, index) => {
      const cell = sheet.getCell(row, index + 1);
      cell.value = header;
      cell.font = { bold: true, color: { argb: 'FFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.expense } };
      cell.alignment = { horizontal: 'center' };
    });
    row++;

    // بيانات المصاريف
    data.currentMonthExpenses.forEach(expense => {
      const rowData = [
        expense.expenseDate,
        expense.unit.unitNumber,
        getExpenseTypeArabic(expense.expenseType),
        parseFloat(expense.amount),
        expense.notes || '-'
      ];

      rowData.forEach((value, colIndex) => {
        const cell = sheet.getCell(row, colIndex + 1);
        cell.value = value;
        
        // تنسيق المبلغ
        if (colIndex === 3) {
          cell.numFmt = '#,##0.00';
          cell.font = { bold: true, color: { argb: colors.expense } };
        }
      });
      row++;
    });

    // إجمالي المصاريف
    row++;
    const totalExpenses = data.currentMonthExpenses
      .reduce((sum, e) => sum + parseFloat(e.amount), 0);

    sheet.getCell(row, 3).value = 'إجمالي المصاريف:';
    sheet.getCell(row, 3).font = { bold: true };
    sheet.getCell(row, 4).value = totalExpenses;
    sheet.getCell(row, 4).numFmt = '#,##0.00';
    sheet.getCell(row, 4).font = { bold: true, color: { argb: colors.expense } };

  } else {
    sheet.getCell(row, 1).value = 'لا توجد مصاريف مسجلة للشهر الحالي';
    sheet.getCell(row, 1).font = { italic: true };
  }

  // تنسيق عرض الأعمدة
  const columnWidths = [12, 12, 20, 15, 15, 12, 25];
  columnWidths.forEach((width, index) => {
    sheet.getColumn(index + 1).width = width;
  });
}

// الدوال المساعدة للتنسيق والألوان

// إضافة عنوان قسم
function addSectionHeader(sheet, row, title, color) {
  sheet.mergeCells(`A${row}:H${row}`);
  const cell = sheet.getCell(row, 1);
  cell.value = title;
  cell.font = { bold: true, size: 14, color: { argb: 'FFFFFF' } };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
  cell.alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(row).height = 25;
}

// إنشاء بطاقة KPI
function createKPICard(sheet, row, col, kpi, colors) {
  // خلفية البطاقة
  sheet.mergeCells(row, col, row + 2, col + 1);
  const cardCell = sheet.getCell(row, col);
  cardCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'f8f9fa' } };
  
  // العنوان
  const titleCell = sheet.getCell(row, col);
  titleCell.value = kpi.label;
  titleCell.font = { bold: true, size: 10 };
  titleCell.alignment = { horizontal: 'center', vertical: 'top' };
  
  // القيمة
  const valueCell = sheet.getCell(row + 1, col);
  if (kpi.format === 'currency') {
    valueCell.value = kpi.value;
    valueCell.numFmt = '#,##0.00';
  } else if (kpi.format === 'percentage') {
    valueCell.value = kpi.value / 100;
    valueCell.numFmt = '0.0%';
  } else {
    valueCell.value = kpi.value;
  }
  valueCell.font = { bold: true, size: 14, color: { argb: kpi.color } };
  valueCell.alignment = { horizontal: 'center', vertical: 'middle' };
  
  // حدود البطاقة
  for (let r = row; r <= row + 2; r++) {
    for (let c = col; c <= col + 1; c++) {
      const cell = sheet.getCell(r, c);
      cell.border = {
        top: { style: 'thin', color: { argb: 'cccccc' } },
        left: { style: 'thin', color: { argb: 'cccccc' } },
        bottom: { style: 'thin', color: { argb: 'cccccc' } },
        right: { style: 'thin', color: { argb: 'cccccc' } }
      };
    }
  }
}

// إنشاء جدول منسق
function createStyledTable(sheet, startRow, data, colors) {
  data.forEach((rowData, rowIndex) => {
    rowData.forEach((cellValue, colIndex) => {
      const cell = sheet.getCell(startRow + rowIndex, colIndex + 1);
      cell.value = cellValue;
      
      // تنسيق الرأس
      if (rowIndex === 0) {
        cell.font = { bold: true, color: { argb: 'FFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.primary || '34495e' } };
        cell.alignment = { horizontal: 'center' };
      } else {
        // تنسيق الأرقام
        if (typeof cellValue === 'number' && !cellValue.toString().includes('%')) {
          cell.numFmt = '#,##0.00';
        }
        
        // ألوان متناوبة للصفوف
        if (rowIndex % 2 === 0) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'f8f9fa' } };
        }
      }
      
      // حدود الجدول
      cell.border = {
        top: { style: 'thin', color: { argb: 'dddddd' } },
        left: { style: 'thin', color: { argb: 'dddddd' } },
        bottom: { style: 'thin', color: { argb: 'dddddd' } },
        right: { style: 'thin', color: { argb: 'dddddd' } }
      };
    });
  });
}

// دوال الترجمة والتفسير

function getMonthNameArabic(month) {
  const months = {
    1: 'يناير', 2: 'فبراير', 3: 'مارس', 4: 'أبريل',
    5: 'مايو', 6: 'يونيو', 7: 'يوليو', 8: 'أغسطس',
    9: 'سبتمبر', 10: 'أكتوبر', 11: 'نوفمبر', 12: 'ديسمبر'
  };
  return months[month] || month;
}

function getUnitTypeArabic(type) {
  const types = {
    'studio': 'ستديو', 'apartment': 'شقة', 'shop': 'محل',
    'office': 'مكتب', 'villa': 'فيلا', 'room': 'غرفة'
  };
  return types[type] || type;
}

function getUnitStatusArabic(status) {
  const statuses = {
    'available': 'متاح', 'rented': 'مؤجر', 'maintenance': 'صيانة'
  };
  return statuses[status] || status;
}

function getPaymentStatusArabic(status) {
  const statuses = {
    'paid': 'مدفوع', 'pending': 'معلق', 'delayed': 'متأخر', 'cancelled': 'ملغي'
  };
  return statuses[status] || status;
}

function getPaymentMethodArabic(method) {
  const methods = {
    'cash': 'نقدي', 'check': 'شيك', 'bank_transfer': 'تحويل بنكي'
  };
  return methods[method] || method;
}

function getExpenseTypeArabic(type) {
  const types = {
    'maintenance': 'صيانة', 'utilities': 'خدمات', 'insurance': 'تأمين',
    'cleaning': 'تنظيف', 'security': 'أمن', 'management': 'إدارة',
    'repairs': 'إصلاحات', 'other': 'أخرى'
  };
  return types[type] || type;
}

// دوال التفسير المالي

function getRoiInterpretation(roi) {
  if (roi >= 15) return 'ممتاز - عائد استثماري عالي';
  if (roi >= 10) return 'جيد جداً - عائد مرضي';
  if (roi >= 5) return 'متوسط - عائد مقبول';
  if (roi >= 0) return 'ضعيف - عائد منخفض';
  return 'سلبي - مراجعة الاستثمار مطلوبة';
}

function getProfitMarginInterpretation(margin) {
  if (margin >= 50) return 'ممتاز - ربحية عالية جداً';
  if (margin >= 30) return 'جيد جداً - ربحية جيدة';
  if (margin >= 15) return 'متوسط - ربحية مقبولة';
  if (margin >= 0) return 'ضعيف - ربحية منخفضة';
  return 'خسارة - مراجعة التكاليف مطلوبة';
}

function getOccupancyInterpretation(rate) {
  if (rate >= 95) return 'ممتاز - إشغال كامل تقريباً';
  if (rate >= 85) return 'جيد جداً - إشغال عالي';
  if (rate >= 70) return 'جيد - إشغال مقبول';
  if (rate >= 50) return 'متوسط - يحتاج تحسين';
  return 'ضعيف - مراجعة استراتيجية التأجير';
}

function getCollectionInterpretation(rate) {
  if (rate >= 95) return 'ممتاز - تحصيل شبه كامل';
  if (rate >= 85) return 'جيد جداً - تحصيل جيد';
  if (rate >= 70) return 'مقبول - يحتاج متابعة';
  if (rate >= 50) return 'ضعيف - مشكلة في التحصيل';
  return 'سيء - مراجعة عاجلة مطلوبة';
}

function getGrowthInterpretation(growth) {
  if (growth >= 20) return 'نمو ممتاز';
  if (growth >= 10) return 'نمو جيد';
  if (growth >= 5) return 'نمو مستقر';
  if (growth >= 0) return 'نمو بطيء';
  return 'انكماش - مراجعة مطلوبة';
}

module.exports = {
  getOwnerFinancialReport
};