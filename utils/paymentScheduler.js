// utils/paymentScheduler.js

/**
 * توليد جدول الدفعات بناءً على معلومات الحجز والوحدة
 * @param {Object} reservation - كائن الحجز
 * @param {Object} unit - كائن الوحدة العقارية
 * @returns {Array} مصفوفة من كائنات الدفعات
 */
const generatePaymentSchedule = (reservation, unit) => {
  const { startDate, endDate, paymentSchedule } = reservation;
  
  // تحويل التواريخ إلى كائنات Date
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // حساب المدة بالأشهر
  const durationInMonths = calculateDurationInMonths(start, end);
  
  // حساب المبلغ الإجمالي للإيجار
  // إذا كان price يمثل القيمة الشهرية:
  const totalRentalAmount = unit.price * durationInMonths;
  
  // أو إذا كان price يمثل القيمة السنوية:
  // const totalRentalAmount = unit.price * (durationInMonths / 12);
  
  // تحديد عدد الدفعات بناءً على جدول الدفع
  let numberOfPayments;
  switch (paymentSchedule) {
    case 'monthly':
      numberOfPayments = durationInMonths;
      break;
    case 'quarterly':
      numberOfPayments = Math.ceil(durationInMonths / 3);
      break;
    case 'triannual':
      numberOfPayments = Math.ceil(durationInMonths / 4);
      break;
    case 'biannual':
      numberOfPayments = Math.ceil(durationInMonths / 6);
      break;
    case 'annual':
      numberOfPayments = Math.ceil(durationInMonths / 12);
      break;
    default:
      numberOfPayments = durationInMonths;
  }
  
  // حساب مبلغ كل دفعة
  const paymentAmount = (totalRentalAmount / numberOfPayments).toFixed(2);
  
  // توليد مصفوفة الدفعات
  const payments = [];
  let currentDate = new Date(start);
  
  for (let i = 0; i < numberOfPayments; i++) {
    // تحديد تاريخ استحقاق الدفعة
    const dueDate = new Date(currentDate);
    
    // إنشاء كائن الدفعة
    payments.push({
      amount: paymentAmount,
      paymentDate: formatDate(dueDate),
      status: 'pending',
      notes: `دفعة ${i + 1} من ${numberOfPayments}`
    });
    
    // حساب تاريخ الدفعة التالية
    currentDate = addMonthsToDate(currentDate, getMonthsBySchedule(paymentSchedule));
  }
  
  return payments;
};

/**
 * حساب المدة بالأشهر بين تاريخين
 * @param {Date} start - تاريخ البداية
 * @param {Date} end - تاريخ النهاية
 * @returns {number} المدة بالأشهر
 */
const calculateDurationInMonths = (start, end) => {
  return (end.getFullYear() - start.getFullYear()) * 12 + 
         (end.getMonth() - start.getMonth());
};

/**
 * إضافة عدد محدد من الأشهر إلى تاريخ
 * @param {Date} date - التاريخ الأصلي
 * @param {number} months - عدد الأشهر
 * @returns {Date} التاريخ الجديد
 */
const addMonthsToDate = (date, months) => {
  const newDate = new Date(date);
  newDate.setMonth(newDate.getMonth() + months);
  return newDate;
};

/**
 * الحصول على عدد الأشهر بناءً على جدول الدفع
 * @param {string} schedule - جدول الدفع
 * @returns {number} عدد الأشهر
 */
const getMonthsBySchedule = (schedule) => {
  switch (schedule) {
    case 'monthly': return 1;
    case 'quarterly': return 3;
    case 'triannual': return 4;
    case 'biannual': return 6;
    case 'annual': return 12;
    default: return 1;
  }
};

/**
 * تنسيق التاريخ إلى صيغة YYYY-MM-DD
 * @param {Date} date - كائن التاريخ
 * @returns {string} التاريخ بصيغة YYYY-MM-DD
 */
const formatDate = (date) => {
  return date.toISOString().split('T')[0];
};

module.exports = {
  generatePaymentSchedule
};