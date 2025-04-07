// Helpers 
// Format date to YYYY-MM-DD
const formatDate = (date) => {
    return new Date(date).toISOString().split('T')[0];
  };
  
  // Calculate the rental duration in months
  const calculateRentalDuration = (startDate, endDate) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Calculate the difference in months
    const months = (end.getFullYear() - start.getFullYear()) * 12 + 
                   (end.getMonth() - start.getMonth());
    
    return months;
  };
  
  // Calculate the rental price based on duration
  const calculateRentalPrice = (monthlyPrice, startDate, endDate) => {
    const duration = calculateRentalDuration(startDate, endDate);
    return monthlyPrice * duration;
  };
  
  // Generate a unique reference number
  const generateReferenceNumber = (prefix = 'REF') => {
    const timestamp = new Date().getTime().toString().slice(-6);
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `${prefix}-${timestamp}-${random}`;
  };
  
  // Check if a date is in the past
  const isDatePast = (date) => {
    return new Date(date) < new Date();
  };
  
  // Check if a date is in the future
  const isDateFuture = (date) => {
    return new Date(date) > new Date();
  };
  
  // Format currency
  const formatCurrency = (amount, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency
    }).format(amount);
  };
  
  // Remove sensitive data from objects
  const sanitizeData = (data, fieldsToRemove = ['password']) => {
    if (!data) return data;
    
    const sanitized = { ...data };
    
    fieldsToRemove.forEach(field => {
      if (sanitized[field]) {
        delete sanitized[field];
      }
    });
    
    return sanitized;
  };
  
  module.exports = {
    formatDate,
    calculateRentalDuration,
    calculateRentalPrice,
    generateReferenceNumber,
    isDatePast,
    isDateFuture,
    formatCurrency,
    sanitizeData
  };