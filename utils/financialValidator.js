// utils/financialValidator.js - دوال التحقق من المستحقات المالية

const { Op } = require('sequelize');
const PaymentHistory = require('../models/paymentHistory.model');
const Expense = require('../models/expense.model');
const Reservation = require('../models/reservation.model');
const RealEstateUnit = require('../models/realEstateUnit.model');
const Building = require('../models/building.model');

/**
 * التحقق من وجود مستحقات مالية غير مدفوعة للمستأجر
 * @param {number} reservationId - معرف الحجز
 * @param {number} userId - معرف المستخدم/المستأجر
 * @returns {Promise<Object>} - نتيجة التحقق
 */
const checkOutstandingPayments = async (reservationId, userId) => {
  try {
    const outstandingItems = {
      unpaidPayments: [],
      unpaidExpenses: [],
      totalOutstanding: 0,
      hasOutstanding: false
    };

    // 1. التحقق من الدفعات غير المدفوعة
    const unpaidPayments = await PaymentHistory.findAll({
      where: {
        reservationId: reservationId,
        status: { [Op.in]: ['pending', 'delayed'] }
      },
      attributes: ['id', 'amount', 'paymentDate', 'status', 'notes']
    });

    if (unpaidPayments.length > 0) {
      outstandingItems.unpaidPayments = unpaidPayments.map(payment => ({
        id: payment.id,
        amount: parseFloat(payment.amount),
        paymentDate: payment.paymentDate,
        status: payment.status,
        type: 'دفعة إيجار',
        description: payment.notes || `دفعة مستحقة بتاريخ ${payment.paymentDate}`
      }));
    }

    // 2. التحقق من المصاريف المترتبة على المستأجر
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

    if (reservation) {
      // البحث عن المصاريف في نفس المبنى والوحدة التي تخص المستأجر
      const unpaidExpenses = await Expense.findAll({
        where: {
          [Op.or]: [
            { unitId: reservation.unitId },
            { buildingId: reservation.unit.buildingId }
          ],
          responsibleParty: 'tenant',
          // يمكن إضافة شرط للتحقق من عدم الدفع إذا كان هناك نظام لتتبع دفع المصاريف
        },
        attributes: ['id', 'amount', 'expenseDate', 'expenseType', 'notes']
      });

      if (unpaidExpenses.length > 0) {
        outstandingItems.unpaidExpenses = unpaidExpenses.map(expense => ({
          id: expense.id,
          amount: parseFloat(expense.amount),
          expenseDate: expense.expenseDate,
          type: 'مصروف',
          expenseType: getExpenseTypeArabic(expense.expenseType),
          description: expense.notes || `مصروف ${getExpenseTypeArabic(expense.expenseType)} بتاريخ ${expense.expenseDate}`
        }));
      }
    }

    // 3. حساب إجمالي المستحقات
    const totalPayments = outstandingItems.unpaidPayments.reduce((sum, payment) => sum + payment.amount, 0);
    const totalExpenses = outstandingItems.unpaidExpenses.reduce((sum, expense) => sum + expense.amount, 0);
    
    outstandingItems.totalOutstanding = totalPayments + totalExpenses;
    outstandingItems.hasOutstanding = outstandingItems.totalOutstanding > 0;

    // 4. إعداد تفاصيل المستحقات للعرض
    if (outstandingItems.hasOutstanding) {
      outstandingItems.summary = {
        totalPayments,
        totalExpenses,
        paymentsCount: outstandingItems.unpaidPayments.length,
        expensesCount: outstandingItems.unpaidExpenses.length,
        message: `يوجد مستحقات مالية غير مدفوعة بقيمة ${outstandingItems.totalOutstanding} ريال`
      };
    }

    return outstandingItems;

  } catch (error) {
    console.error('خطأ في التحقق من المستحقات المالية:', error);
    throw new Error('فشل في التحقق من المستحقات المالية');
  }
};

/**
 * التحقق من إمكانية إلغاء الحجز
 * @param {number} reservationId - معرف الحجز
 * @param {number} userId - معرف المستخدم
 * @returns {Promise<Object>} - نتيجة التحقق
 */
const canCancelReservation = async (reservationId, userId) => {
  try {
    const outstandingPayments = await checkOutstandingPayments(reservationId, userId);
    
    return {
      canCancel: !outstandingPayments.hasOutstanding,
      reason: outstandingPayments.hasOutstanding ? 
        'يوجد مستحقات مالية غير مدفوعة يجب تسويتها قبل الإلغاء' : 
        'يمكن إلغاء الحجز',
      outstandingItems: outstandingPayments
    };
  } catch (error) {
    console.error('خطأ في التحقق من إمكانية الإلغاء:', error);
    return {
      canCancel: false,
      reason: 'فشل في التحقق من الحالة المالية',
      outstandingItems: null
    };
  }
};

/**
 * تحديث حالة جميع الدفعات المعلقة للحجز
 * @param {number} reservationId - معرف الحجز
 * @param {string} newStatus - الحالة الجديدة
 * @param {string} reason - سبب التحديث
 * @returns {Promise<Object>} - نتيجة التحديث
 */
const updatePendingPaymentsStatus = async (reservationId, newStatus = 'cancelled', reason = 'إلغاء الحجز') => {
  try {
    const updatedPayments = await PaymentHistory.update(
      { 
        status: newStatus,
        notes: reason
      },
      {
        where: {
          reservationId: reservationId,
          status: { [Op.in]: ['pending', 'delayed'] }
        },
        returning: true
      }
    );

    return {
      success: true,
      updatedCount: Array.isArray(updatedPayments) ? updatedPayments[0] : 0,
      message: `تم تحديث حالة الدفعات المعلقة إلى ${newStatus}`
    };

  } catch (error) {
    console.error('خطأ في تحديث حالة الدفعات:', error);
    throw new Error('فشل في تحديث حالة الدفعات');
  }
};

/**
 * تحويل نوع المصروف إلى العربية
 * @param {string} expenseType - نوع المصروف
 * @returns {string} - نوع المصروف بالعربية
 */
const getExpenseTypeArabic = (expenseType) => {
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
  return types[expenseType] || expenseType;
};

/**
 * إنشاء تقرير مفصل للمستحقات المالية
 * @param {number} reservationId - معرف الحجز
 * @param {number} userId - معرف المستخدم
 * @returns {Promise<Object>} - التقرير المفصل
 */
const generateFinancialSummaryReport = async (reservationId, userId) => {
  try {
    const outstandingPayments = await checkOutstandingPayments(reservationId, userId);
    
    if (!outstandingPayments.hasOutstanding) {
      return {
        canProceed: true,
        message: 'جميع المستحقات المالية مدفوعة، يمكن المتابعة',
        details: null
      };
    }

    const report = {
      canProceed: false,
      message: 'يوجد مستحقات مالية غير مدفوعة',
      totalOutstanding: outstandingPayments.totalOutstanding,
      breakdown: {
        payments: {
          count: outstandingPayments.unpaidPayments.length,
          total: outstandingPayments.unpaidPayments.reduce((sum, p) => sum + p.amount, 0),
          items: outstandingPayments.unpaidPayments
        },
        expenses: {
          count: outstandingPayments.unpaidExpenses.length,
          total: outstandingPayments.unpaidExpenses.reduce((sum, e) => sum + e.amount, 0),
          items: outstandingPayments.unpaidExpenses
        }
      },
      actionRequired: 'يجب تسوية جميع المستحقات المالية قبل إلغاء الحجز'
    };

    return report;

  } catch (error) {
    console.error('خطأ في إنشاء تقرير المستحقات المالية:', error);
    throw new Error('فشل في إنشاء التقرير المالي');
  }
};

module.exports = {
  checkOutstandingPayments,
  canCancelReservation,
  updatePendingPaymentsStatus,
  generateFinancialSummaryReport,
  getExpenseTypeArabic
};