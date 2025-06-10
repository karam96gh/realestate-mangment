// utils/depositHelpers.js - دوال مساعدة لإدارة التأمين

const { Op } = require('sequelize');
const Reservation = require('../models/reservation.model');
const fs = require('fs');
const path = require('path');
const { UPLOAD_PATHS } = require('../config/upload');

/**
 * تحديث حالة التأمين
 * @param {number} reservationId - معرف الحجز
 * @param {string} newStatus - الحالة الجديدة (paid, returned, unpaid)
 * @param {Object} additionalData - بيانات إضافية
 * @returns {Promise<Object>} - الحجز المحدث
 */
const updateDepositStatus = async (reservationId, newStatus, additionalData = {}) => {
  try {
    const reservation = await Reservation.findByPk(reservationId);
    
    if (!reservation) {
      throw new Error('الحجز غير موجود');
    }

    if (!reservation.includesDeposit) {
      throw new Error('هذا الحجز لا يشمل تأمين');
    }

    const updateData = {
      depositStatus: newStatus
    };

    // تحديد التاريخ المناسب حسب الحالة
    if (newStatus === 'paid') {
      updateData.depositPaidDate = additionalData.paidDate || new Date().toISOString().split('T')[0];
      updateData.depositReturnedDate = null; // إزالة تاريخ الاسترجاع إذا كان موجوداً
    } else if (newStatus === 'returned') {
      updateData.depositReturnedDate = additionalData.returnedDate || new Date().toISOString().split('T')[0];
      // الاحتفاظ بتاريخ الدفع كما هو
    } else if (newStatus === 'unpaid') {
      updateData.depositPaidDate = null;
      updateData.depositReturnedDate = null;
    }

    // إضافة ملاحظات إذا تم توفيرها
    if (additionalData.notes) {
      updateData.depositNotes = additionalData.notes;
    }

    await reservation.update(updateData);

    return reservation;
  } catch (error) {
    console.error('خطأ في تحديث حالة التأمين:', error);
    throw error;
  }
};

/**
 * الحصول على إحصائيات التأمين
 * @param {Object} filters - فلاتر البحث
 * @returns {Promise<Object>} - إحصائيات التأمين
 */
const getDepositStatistics = async (filters = {}) => {
  try {
    const whereCondition = {
      includesDeposit: true,
      ...filters
    };

    // إجمالي عدد الحجوزات التي تشمل تأمين
    const totalWithDeposit = await Reservation.count({
      where: whereCondition
    });

    // عدد التأمينات حسب الحالة
    const depositsByStatus = await Reservation.findAll({
      attributes: [
        'depositStatus',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        [sequelize.fn('SUM', sequelize.col('depositAmount')), 'totalAmount']
      ],
      where: whereCondition,
      group: ['depositStatus'],
      raw: true
    });

    // إجمالي قيمة التأمينات
    const totalDepositAmount = await Reservation.sum('depositAmount', {
      where: whereCondition
    });

    // التأمينات المستحقة الاسترجاع (العقود المنتهية والملغاة مع تأمين مدفوع)
    const depositsToReturn = await Reservation.count({
      where: {
        ...whereCondition,
        depositStatus: 'paid',
        status: { [Op.in]: ['expired', 'cancelled'] }
      }
    });

    return {
      totalWithDeposit,
      depositsByStatus,
      totalDepositAmount: totalDepositAmount || 0,
      depositsToReturn
    };
  } catch (error) {
    console.error('خطأ في الحصول على إحصائيات التأمين:', error);
    throw error;
  }
};

/**
 * التحقق من صحة بيانات التأمين
 * @param {Object} depositData - بيانات التأمين
 * @returns {Object} - نتيجة التحقق
 */
const validateDepositData = (depositData) => {
  const errors = [];

  if (depositData.includesDeposit) {
    // التحقق من وجود قيمة التأمين
    if (!depositData.depositAmount || depositData.depositAmount <= 0) {
      errors.push('قيمة التأمين مطلوبة ويجب أن تكون أكبر من صفر');
    }

    // التحقق من طريقة الدفع
    if (!depositData.depositPaymentMethod) {
      errors.push('طريقة دفع التأمين مطلوبة');
    }

    // إذا كانت طريقة الدفع شيك، التحقق من وجود صورة الشيك للحجوزات الجديدة
    if (depositData.depositPaymentMethod === 'check' && 
        depositData.depositStatus === 'paid' && 
        !depositData.depositCheckImage) {
      errors.push('صورة الشيك مطلوبة عند الدفع بالشيك');
    }

    // التحقق من التواريخ
    if (depositData.depositStatus === 'paid' && !depositData.depositPaidDate) {
      errors.push('تاريخ دفع التأمين مطلوب عند تحديد الحالة كمدفوع');
    }

    if (depositData.depositStatus === 'returned') {
      if (!depositData.depositReturnedDate) {
        errors.push('تاريخ استرجاع التأمين مطلوب عند تحديد الحالة كمسترجع');
      }
      
      if (!depositData.depositPaidDate) {
        errors.push('لا يمكن استرجاع تأمين غير مدفوع');
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * حذف صورة شيك التأمين
 * @param {string} checkImagePath - مسار صورة الشيك
 * @returns {boolean} - نجح الحذف أم لا
 */
const deleteDepositCheckImage = (checkImagePath) => {
  try {
    if (checkImagePath) {
      const fullPath = path.join(UPLOAD_PATHS.checks, checkImagePath);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
        return true;
      }
    }
    return false;
  } catch (error) {
    console.error('خطأ في حذف صورة شيك التأمين:', error);
    return false;
  }
};

/**
 * الحصول على التأمينات المستحقة الاسترجاع
 * @param {Object} filters - فلاتر إضافية
 * @returns {Promise<Array>} - قائمة التأمينات المستحقة الاسترجاع
 */
const getDepositsToReturn = async (filters = {}) => {
  try {
    const whereCondition = {
      includesDeposit: true,
      depositStatus: 'paid',
      status: { [Op.in]: ['expired', 'cancelled'] },
      ...filters
    };

    const deposits = await Reservation.findAll({
      where: whereCondition,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'fullName', 'phone', 'email']
        },
        {
          model: RealEstateUnit,
          as: 'unit',
          attributes: ['id', 'unitNumber'],
          include: [{
            model: Building,
            as: 'building',
            attributes: ['id', 'name']
          }]
        }
      ],
      order: [['endDate', 'ASC']]
    });

    return deposits;
  } catch (error) {
    console.error('خطأ في الحصول على التأمينات المستحقة الاسترجاع:', error);
    throw error;
  }
};

/**
 * تصدير تقرير التأمينات
 * @param {Object} filters - فلاتر التقرير
 * @param {string} format - تنسيق التصدير (json, csv)
 * @returns {Promise<Object>} - بيانات التقرير
 */
const exportDepositReport = async (filters = {}, format = 'json') => {
  try {
    const whereCondition = {
      includesDeposit: true,
      ...filters
    };

    const deposits = await Reservation.findAll({
      where: whereCondition,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['fullName', 'phone', 'email']
        },
        {
          model: RealEstateUnit,
          as: 'unit',
          attributes: ['unitNumber'],
          include: [{
            model: Building,
            as: 'building',
            attributes: ['name']
          }]
        }
      ],
      attributes: [
        'id', 'depositAmount', 'depositPaymentMethod', 
        'depositStatus', 'depositPaidDate', 'depositReturnedDate',
        'depositNotes', 'startDate', 'endDate', 'status'
      ],
      order: [['createdAt', 'DESC']]
    });

    if (format === 'csv') {
      // تحويل البيانات إلى تنسيق CSV
      const csvData = deposits.map(reservation => ({
        'رقم الحجز': reservation.id,
        'اسم المستأجر': reservation.user.fullName,
        'رقم الوحدة': reservation.unit.unitNumber,
        'اسم المبنى': reservation.unit.building.name,
        'قيمة التأمين': reservation.depositAmount,
        'طريقة الدفع': reservation.depositPaymentMethod === 'cash' ? 'نقدي' : 'شيك',
        'حالة التأمين': getDepositStatusArabic(reservation.depositStatus),
        'تاريخ الدفع': reservation.depositPaidDate,
        'تاريخ الاسترجاع': reservation.depositReturnedDate,
        'حالة العقد': getContractStatusArabic(reservation.status),
        'ملاحظات': reservation.depositNotes
      }));
      
      return { format: 'csv', data: csvData };
    }

    return { format: 'json', data: deposits };
  } catch (error) {
    console.error('خطأ في تصدير تقرير التأمينات:', error);
    throw error;
  }
};

/**
 * تحويل حالة التأمين إلى العربية
 * @param {string} status - حالة التأمين بالإنجليزية
 * @returns {string} - حالة التأمين بالعربية
 */
const getDepositStatusArabic = (status) => {
  const statusMap = {
    'unpaid': 'غير مدفوع',
    'paid': 'مدفوع',
    'returned': 'مسترجع'
  };
  return statusMap[status] || status;
};

/**
 * تحويل حالة العقد إلى العربية
 * @param {string} status - حالة العقد بالإنجليزية
 * @returns {string} - حالة العقد بالعربية
 */
const getContractStatusArabic = (status) => {
  const statusMap = {
    'active': 'نشط',
    'expired': 'منتهي',
    'cancelled': 'ملغي'
  };
  return statusMap[status] || status;
};

module.exports = {
  updateDepositStatus,
  getDepositStatistics,
  validateDepositData,
  deleteDepositCheckImage,
  getDepositsToReturn,
  exportDepositReport,
  getDepositStatusArabic,
  getContractStatusArabic
};