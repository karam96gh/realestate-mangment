
/**
 * Generate payment schedule based on reservation information and unit price
 * @param {Object} reservation - The reservation object
 * @param {number} unitPrice - The unit price (monthly rate)
 * @returns {Array} Array of payment objects
 */
const generatePaymentSchedule = (reservation, unitPrice) => {
  const { startDate, endDate, paymentSchedule } = reservation;
  
  // Convert dates to Date objects
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // Calculate duration in months
  const durationInMonths = calculateDurationInMonths(start, end);
  
  // If the duration is negative or zero, we need to handle it
  if (durationInMonths <= 0) {
    console.error("Warning: Negative or zero duration calculated between", startDate, "and", endDate);
    // Return at least one payment for the first month
    return [{
      amount: unitPrice,
      paymentDate: formatDate(start),
      status: 'pending',
      notes: 'دفعة 1 من 1 (تصحيح تواريخ العقد مطلوب)'
    }];
  }
  
  // Calculate total rental amount based on duration and unit price
  const totalRentalAmount = unitPrice * durationInMonths;
  
  // Determine number of payments based on payment schedule
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
  
  // Ensure we have at least one payment
  numberOfPayments = Math.max(1, numberOfPayments);
  
  // Calculate payment amount
  const paymentAmount = (totalRentalAmount / numberOfPayments).toFixed(2);
  
  // Generate payments array
  const payments = [];
  let currentDate = new Date(start);
  
  for (let i = 0; i < numberOfPayments; i++) {
    // Set payment due date
    const dueDate = new Date(currentDate);
    
    // Create payment object
    payments.push({
      amount: paymentAmount,
      paymentDate: formatDate(dueDate),
      status: 'pending',
      notes: `دفعة ${i + 1} من ${numberOfPayments}`
    });
    
    // Calculate next payment date
    currentDate = addMonthsToDate(currentDate, getMonthsBySchedule(paymentSchedule));
  }
  
  return payments;
};

/**
 * Calculate duration in months between two dates
 * @param {Date} start - Start date
 * @param {Date} end - End date
 * @returns {number} Duration in months
 */
const calculateDurationInMonths = (start, end) => {
  const yearDiff = end.getFullYear() - start.getFullYear();
  const monthDiff = end.getMonth() - start.getMonth();
  return (yearDiff * 12) + monthDiff;
};

/**
 * Add a specific number of months to a date
 * @param {Date} date - Original date
 * @param {number} months - Number of months to add
 * @returns {Date} New date
 */
const addMonthsToDate = (date, months) => {
  const newDate = new Date(date);
  newDate.setMonth(newDate.getMonth() + months);
  return newDate;
};

/**
 * Get the number of months based on payment schedule
 * @param {string} schedule - Payment schedule
 * @returns {number} Number of months
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
 * Format date to YYYY-MM-DD
 * @param {Date} date - Date object
 * @returns {string} Formatted date string
 */
const formatDate = (date) => {
  return date.toISOString().split('T')[0];
};

module.exports = {
  generatePaymentSchedule
};