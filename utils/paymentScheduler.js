/**
 * إصدار محسن من مجدول الدفعات مع إصلاح جميع المشاكل
 * Generate payment schedule based on reservation information and unit price
 * @param {Object} reservation - The reservation object
 * @param {number} unitPrice - The unit price (monthly rate)
 * @returns {Array} Array of payment objects
 */
const generatePaymentSchedule = (reservation, unitPrice) => {
  const { startDate, endDate, paymentSchedule } = reservation;
  
  console.log(`🔄 إنشاء جدولة دفعات: من ${startDate} إلى ${endDate} بنظام ${paymentSchedule}`);
  
  // Convert dates to Date objects
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // ✅ حساب المدة الصحيحة بالأيام أولاً ثم تحويلها لأشهر
  const durationDetails = calculatePreciseDuration(start, end);
  const durationInMonths = durationDetails.totalMonths;
  
  console.log(`📊 تفاصيل المدة:`, durationDetails);
  
  // التحقق من صحة المدة
  if (durationInMonths <= 0) {
    console.error("⚠️ تحذير: مدة سالبة أو صفر بين", startDate, "و", endDate);
    return [{
      amount: unitPrice,
      paymentDate: formatDate(start),
      status: 'pending',
      notes: 'دفعة طوارئ - يرجى مراجعة تواريخ العقد'
    }];
  }
  
  // ✅ حساب المبلغ الإجمالي بدقة
  const totalRentalAmount = calculateTotalRentalAmount(unitPrice, durationDetails);
  
  // ✅ تحديد عدد الدفعات بناءً على آلية الدفع مع التحقق من التوافق
  const paymentConfig = calculateOptimalPayments(durationInMonths, paymentSchedule);
  
  console.log(`💰 إجمالي المبلغ: ${totalRentalAmount}, عدد الدفعات: ${paymentConfig.numberOfPayments}`);
  
  // ✅ توزيع المبالغ بعدالة (معالجة الكسور)
  const payments = distributePaymentAmounts(
    totalRentalAmount, 
    paymentConfig.numberOfPayments, 
    start, 
    paymentConfig.intervalMonths,
    paymentConfig.description
  );
  
  console.log(`✅ تم إنشاء ${payments.length} دفعة بنجاح`);
  
  return payments;
};

/**
 * ✅ حساب المدة الدقيقة بالأيام والأشهر
 * @param {Date} start - Start date
 * @param {Date} end - End date
 * @returns {Object} Duration details
 */
const calculatePreciseDuration = (start, end) => {
  // حساب الفرق بالأيام
  const diffTime = end.getTime() - start.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  // حساب الأشهر بدقة
  let months = 0;
  let currentDate = new Date(start);
  
  while (currentDate < end) {
    const nextMonth = new Date(currentDate);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    
    if (nextMonth <= end) {
      months++;
      currentDate = nextMonth;
    } else {
      // حساب الجزء المتبقي من الشهر
      const remainingDays = Math.ceil((end.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));
      const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
      const partialMonth = remainingDays / daysInMonth;
      
      months += partialMonth;
      break;
    }
  }
  
  return {
    totalDays: diffDays,
    totalMonths: Math.round(months * 100) / 100, // تقريب لرقمين عشريين
    fullMonths: Math.floor(months),
    partialMonth: months - Math.floor(months)
  };
};

/**
 * ✅ حساب المبلغ الإجمالي بدقة
 * @param {number} monthlyPrice - Monthly price
 * @param {Object} durationDetails - Duration details
 * @returns {number} Total rental amount
 */
const calculateTotalRentalAmount = (monthlyPrice, durationDetails) => {
  return Math.round(monthlyPrice * durationDetails.totalMonths * 100) / 100;
};

/**
 * ✅ تحديد عدد الدفعات المثالي مع التحقق من التوافق
 * @param {number} durationInMonths - Duration in months
 * @param {string} paymentSchedule - Payment schedule
 * @returns {Object} Payment configuration
 */
const calculateOptimalPayments = (durationInMonths, paymentSchedule) => {
  const scheduleConfig = {
    'monthly': { interval: 1, name: 'شهري' },
    'quarterly': { interval: 3, name: 'ربع سنوي' },
    'triannual': { interval: 4, name: 'ثلث سنوي' }, // ✅ إصلاح: كل 4 أشهر
    'biannual': { interval: 6, name: 'نصف سنوي' },
    'annual': { interval: 12, name: 'سنوي' }
  };
  
  const config = scheduleConfig[paymentSchedule] || scheduleConfig['monthly'];
  const intervalMonths = config.interval;
  
  // ✅ التحقق من التوافق وتعديل الفترات إذا لزم الأمر
  let numberOfPayments;
  let actualInterval = intervalMonths;
  let description = config.name;
  
  if (durationInMonths < intervalMonths) {
    // إذا كانت مدة العقد أقل من فترة الدفع، اجعلها دفعة واحدة
    numberOfPayments = 1;
    actualInterval = durationInMonths;
    description = `دفعة واحدة (مدة العقد أقصر من النظام ${config.name})`;
    
    console.log(`⚠️ تعديل: مدة العقد (${durationInMonths} شهر) أقل من فترة الدفع ${config.name}`);
  } else {
    numberOfPayments = Math.ceil(durationInMonths / intervalMonths);
    
    // التحقق من عدالة التوزيع
    if (numberOfPayments === 1 && durationInMonths > intervalMonths * 1.5) {
      // إذا كانت المدة أطول بكثير من فترة واحدة، قسم لدفعتين
      numberOfPayments = 2;
      actualInterval = Math.ceil(durationInMonths / 2);
      description = `دفعتين متساويتين (تعديل من النظام ${config.name})`;
      
      console.log(`⚠️ تعديل: تقسيم ${config.name} إلى دفعتين للعدالة`);
    }
  }
  
  return {
    numberOfPayments,
    intervalMonths: actualInterval,
    description
  };
};

/**
 * ✅ توزيع المبالغ بعدالة مع معالجة الكسور
 * @param {number} totalAmount - Total amount
 * @param {number} numberOfPayments - Number of payments
 * @param {Date} startDate - Start date
 * @param {number} intervalMonths - Interval in months
 * @param {string} scheduleDescription - Description
 * @returns {Array} Payment array
 */
const distributePaymentAmounts = (totalAmount, numberOfPayments, startDate, intervalMonths, scheduleDescription) => {
  // حساب المبلغ الأساسي لكل دفعة
  const baseAmount = Math.floor((totalAmount * 100) / numberOfPayments) / 100;
  
  // حساب المبلغ المتبقي (الكسر)
  const remainder = Math.round((totalAmount - (baseAmount * numberOfPayments)) * 100) / 100;
  
  const payments = [];
  let currentDate = new Date(startDate);
  
  for (let i = 0; i < numberOfPayments; i++) {
    // توزيع المبلغ المتبقي على الدفعات الأولى
    let paymentAmount = baseAmount;
    if (i === 0 && remainder !== 0) {
      paymentAmount = Math.round((baseAmount + remainder) * 100) / 100;
    }
    
    payments.push({
      amount: paymentAmount.toFixed(2),
      paymentDate: formatDate(currentDate),
      status: 'pending',
      notes: `${scheduleDescription} - دفعة ${i + 1} من ${numberOfPayments}`
    });
    
    // تحديد تاريخ الدفعة التالية
    if (i < numberOfPayments - 1) {
      currentDate = addMonthsToDate(currentDate, intervalMonths);
    }
  }
  
  // ✅ التحقق من صحة إجمالي المبالغ
  const calculatedTotal = payments.reduce((sum, payment) => sum + parseFloat(payment.amount), 0);
  const difference = Math.abs(calculatedTotal - totalAmount);
  
  if (difference > 0.01) {
    console.warn(`⚠️ تحذير: فرق في المبلغ الإجمالي: ${difference}`);
    // تصحيح الفرق في الدفعة الأخيرة
    const lastPayment = payments[payments.length - 1];
    lastPayment.amount = (parseFloat(lastPayment.amount) + (totalAmount - calculatedTotal)).toFixed(2);
  }
  
  return payments;
};

/**
 * ✅ إضافة أشهر لتاريخ معين بدقة
 * @param {Date} date - Original date
 * @param {number} months - Number of months to add
 * @returns {Date} New date
 */
const addMonthsToDate = (date, months) => {
  const newDate = new Date(date);
  const originalDay = newDate.getDate();
  
  newDate.setMonth(newDate.getMonth() + Math.floor(months));
  
  // معالجة الأيام الجزئية إذا كانت الأشهر تحتوي على كسر
  const partialDays = (months - Math.floor(months)) * 30; // تقريبي
  if (partialDays > 0) {
    newDate.setDate(newDate.getDate() + Math.round(partialDays));
  }
  
  // التأكد من أن اليوم لا يتجاوز أيام الشهر (مثل 31 يناير → 28/29 فبراير)
  const daysInNewMonth = new Date(newDate.getFullYear(), newDate.getMonth() + 1, 0).getDate();
  if (originalDay > daysInNewMonth) {
    newDate.setDate(daysInNewMonth);
  } else {
    newDate.setDate(originalDay);
  }
  
  return newDate;
};

/**
 * تنسيق التاريخ إلى YYYY-MM-DD
 * @param {Date} date - Date object
 * @returns {string} Formatted date string
 */
const formatDate = (date) => {
  return date.toISOString().split('T')[0];
};

/**
 * ✅ دالة للتحقق من صحة الجدولة قبل الإنشاء
 * @param {Object} reservation - Reservation object
 * @param {number} unitPrice - Unit price
 * @returns {Object} Validation result
 */
const validatePaymentSchedule = (reservation, unitPrice) => {
  const { startDate, endDate, paymentSchedule } = reservation;
  
  if (!startDate || !endDate) {
    return { isValid: false, error: 'تواريخ البداية والنهاية مطلوبة' };
  }
  
  if (new Date(startDate) >= new Date(endDate)) {
    return { isValid: false, error: 'تاريخ النهاية يجب أن يكون بعد تاريخ البداية' };
  }
  
  if (!unitPrice || unitPrice <= 0) {
    return { isValid: false, error: 'سعر الوحدة يجب أن يكون أكبر من صفر' };
  }
  
  const validSchedules = ['monthly', 'quarterly', 'triannual', 'biannual', 'annual'];
  if (!validSchedules.includes(paymentSchedule)) {
    return { isValid: false, error: 'آلية الدفع غير صحيحة' };
  }
  
  const durationDetails = calculatePreciseDuration(new Date(startDate), new Date(endDate));
  
  if (durationDetails.totalMonths < 0.1) {
    return { isValid: false, error: 'مدة العقد قصيرة جداً (أقل من 3 أيام)' };
  }
  
  return { isValid: true, durationDetails };
};

module.exports = {
  generatePaymentSchedule,
  validatePaymentSchedule,
  calculatePreciseDuration,
  calculateTotalRentalAmount
};