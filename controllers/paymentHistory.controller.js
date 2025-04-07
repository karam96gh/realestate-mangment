// Payment History controller 
const PaymentHistory = require('../models/paymentHistory.model');
const Reservation = require('../models/reservation.model');
const User = require('../models/user.model');
const { catchAsync, AppError } = require('../utils/errorHandler');
const fs = require('fs');
const path = require('path');
const { UPLOAD_PATHS } = require('../config/upload');

// Get all payments
const getAllPayments = catchAsync(async (req, res) => {
  const payments = await PaymentHistory.findAll({
    include: [
      { 
        model: Reservation, 
        as: 'reservation',
        include: [
          { model: User, as: 'user', attributes: { exclude: ['password'] } }
        ]
      }
    ]
  });
  
  res.status(200).json({
    status: 'success',
    results: payments.length,
    data: payments
  });
});

// Get payment by ID
const getPaymentById = catchAsync(async (req, res, next) => {
  const payment = await PaymentHistory.findByPk(req.params.id, {
    include: [
      { 
        model: Reservation, 
        as: 'reservation',
        include: [
          { model: User, as: 'user', attributes: { exclude: ['password'] } }
        ]
      }
    ]
  });
  
  if (!payment) {
    return next(new AppError('Payment not found', 404));
  }
  
  // If user is a tenant, they can only view their own payments
  if (req.user.role === 'tenant' && payment.reservation.userId !== req.user.id) {
    return next(new AppError('You are not authorized to view this payment', 403));
  }
  
  res.status(200).json({
    status: 'success',
    data: payment
  });
});

// Create new payment
const createPayment = catchAsync(async (req, res, next) => {
  const { reservationId, amount, paymentDate, paymentMethod, status, notes } = req.body;
  
  // Verify reservation exists
  const reservation = await Reservation.findByPk(reservationId);
  if (!reservation) {
    return next(new AppError('Reservation not found', 404));
  }
  
  // Only admin/manager can create payments
  if (req.user.role === 'tenant') {
    return next(new AppError('Only administrators can create payment records', 403));
  }
  
  // Handle check image upload
  let checkImage = null;
  if (req.file) {
    checkImage = req.file.filename;
  }
  
  // Create payment
  const newPayment = await PaymentHistory.create({
    reservationId,
    amount,
    paymentDate,
    paymentMethod,
    checkImage,
    status: status || 'pending',
    notes
  });
  
  res.status(201).json({
    status: 'success',
    data: newPayment
  });
});

// Update payment
const updatePayment = catchAsync(async (req, res, next) => {
  const payment = await PaymentHistory.findByPk(req.params.id);
  
  if (!payment) {
    return next(new AppError('Payment not found', 404));
  }
  
  // Only admin/manager can update payments
  if (req.user.role === 'tenant') {
    return next(new AppError('Only administrators can update payment records', 403));
  }
  
  const { amount, paymentDate, paymentMethod, status, notes } = req.body;
  
  // Handle check image upload if provided
  let checkImage = payment.checkImage;
  if (req.file) {
    // Delete old check image if it exists
    if (payment.checkImage) {
      const oldCheckPath = path.join(UPLOAD_PATHS.checks, payment.checkImage);
      if (fs.existsSync(oldCheckPath)) {
        fs.unlinkSync(oldCheckPath);
      }
    }
    checkImage = req.file.filename;
  }
  
  // Update payment
  await payment.update({
    amount: amount || payment.amount,
    paymentDate: paymentDate || payment.paymentDate,
    paymentMethod: paymentMethod || payment.paymentMethod,
    checkImage,
    status: status || payment.status,
    notes: notes || payment.notes
  });
  
  res.status(200).json({
    status: 'success',
    data: payment
  });
});

// Delete payment
const deletePayment = catchAsync(async (req, res, next) => {
  const payment = await PaymentHistory.findByPk(req.params.id);
  
  if (!payment) {
    return next(new AppError('Payment not found', 404));
  }
  
  // Only admin/manager can delete payments
  if (req.user.role === 'tenant') {
    return next(new AppError('Only administrators can delete payment records', 403));
  }
  
  // Delete check image if it exists
  if (payment.checkImage) {
    const checkPath = path.join(UPLOAD_PATHS.checks, payment.checkImage);
    if (fs.existsSync(checkPath)) {
      fs.unlinkSync(checkPath);
    }
  }
  
  await payment.destroy();
  
  res.status(204).json({
    status: 'success',
    data: null
  });
});

// Get payments by reservation ID
const getPaymentsByReservationId = catchAsync(async (req, res, next) => {
  const reservationId = req.params.reservationId;
  
  // Verify reservation exists
  const reservation = await Reservation.findByPk(reservationId);
  if (!reservation) {
    return next(new AppError('Reservation not found', 404));
  }
  
  // If user is a tenant, they can only view payments for their own reservations
  if (req.user.role === 'tenant' && reservation.userId !== req.user.id) {
    return next(new AppError('You can only view payments for your own reservations', 403));
  }
  
  const payments = await PaymentHistory.findAll({
    where: { reservationId }
  });
  
  res.status(200).json({
    status: 'success',
    results: payments.length,
    data: payments
  });
});

module.exports = {
  getAllPayments,
  getPaymentById,
  createPayment,
  updatePayment,
  deletePayment,
  getPaymentsByReservationId
};