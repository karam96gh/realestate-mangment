// Service Order controller 
const ServiceOrder = require('../models/serviceOrder.model');
const Reservation = require('../models/reservation.model');
const User = require('../models/user.model');
const { catchAsync, AppError } = require('../utils/errorHandler');
const fs = require('fs');
const path = require('path');
const { UPLOAD_PATHS } = require('../config/upload');

// Get all service orders
const getAllServiceOrders = catchAsync(async (req, res) => {
  const serviceOrders = await ServiceOrder.findAll({
    include: [
      { model: User, as: 'user', attributes: { exclude: ['password'] } },
      { 
        model: Reservation, 
        as: 'reservation'
      }
    ]
  });
  
  res.status(200).json({
    status: 'success',
    results: serviceOrders.length,
    data: serviceOrders
  });
});

// Get service order by ID
const getServiceOrderById = catchAsync(async (req, res, next) => {
  const serviceOrder = await ServiceOrder.findByPk(req.params.id, {
    include: [
      { model: User, as: 'user', attributes: { exclude: ['password'] } },
      { 
        model: Reservation, 
        as: 'reservation'
      }
    ]
  });
  
  if (!serviceOrder) {
    return next(new AppError('Service order not found', 404));
  }
  
  // Check if the requesting user is authorized to view this service order
  if (req.user.role === 'tenant' && serviceOrder.userId !== req.user.id) {
    return next(new AppError('You are not authorized to view this service order', 403));
  }
  
  res.status(200).json({
    status: 'success',
    data: serviceOrder
  });
});

// Create new service order
const createServiceOrder = catchAsync(async (req, res, next) => {
  const { reservationId, serviceType, serviceSubtype, description } = req.body;
  
  // Verify reservation exists
  const reservation = await Reservation.findByPk(reservationId);
  if (!reservation) {
    return next(new AppError('Reservation not found', 404));
  }
  
  // If user is a tenant, they can only create service orders for their own reservations
  if (req.user.role === 'tenant' && reservation.userId !== req.user.id) {
    return next(new AppError('You can only create service orders for your own reservations', 403));
  }
  
  // Handle attachment upload
  let attachmentFile = null;
  if (req.file) {
    attachmentFile = req.file.filename;
  }
  
  // Create service order
  const newServiceOrder = await ServiceOrder.create({
    userId: req.user.role === 'tenant' ? req.user.id : reservation.userId,
    reservationId,
    serviceType,
    serviceSubtype,
    description,
    attachmentFile,
    status: 'pending'
  });
  
  res.status(201).json({
    status: 'success',
    data: newServiceOrder
  });
});

// Update service order
const updateServiceOrder = catchAsync(async (req, res, next) => {
  const serviceOrder = await ServiceOrder.findByPk(req.params.id);
  
  if (!serviceOrder) {
    return next(new AppError('Service order not found', 404));
  }
  
  // Only admin/manager can update status, tenant can only update description if status is pending
  if (req.user.role === 'tenant') {
    if (serviceOrder.userId !== req.user.id) {
      return next(new AppError('You can only update your own service orders', 403));
    }
    
    if (serviceOrder.status !== 'pending' && req.body.description) {
      return next(new AppError('You can only update the description of pending service orders', 403));
    }
    
    if (req.body.status) {
      return next(new AppError('Tenants cannot update the status of service orders', 403));
    }
  }
  
  const { serviceType, serviceSubtype, description, status } = req.body;
  
  // Handle attachment upload if provided
  let attachmentFile = serviceOrder.attachmentFile;
  if (req.file) {
    // Delete old attachment if it exists
    if (serviceOrder.attachmentFile) {
      const oldAttachmentPath = path.join(UPLOAD_PATHS.attachments, serviceOrder.attachmentFile);
      if (fs.existsSync(oldAttachmentPath)) {
        fs.unlinkSync(oldAttachmentPath);
      }
    }
    attachmentFile = req.file.filename;
  }
  
  // Update service order
  await serviceOrder.update({
    serviceType: serviceType || serviceOrder.serviceType,
    serviceSubtype: serviceSubtype || serviceOrder.serviceSubtype,
    description: description || serviceOrder.description,
    attachmentFile,
    status: status || serviceOrder.status
  });
  
  res.status(200).json({
    status: 'success',
    data: serviceOrder
  });
});

// Delete service order
const deleteServiceOrder = catchAsync(async (req, res, next) => {
  const serviceOrder = await ServiceOrder.findByPk(req.params.id);
  
  if (!serviceOrder) {
    return next(new AppError('Service order not found', 404));
  }
  
  // Only admin/manager can delete any service order
  // Tenants can only delete their own pending service orders
  if (req.user.role === 'tenant') {
    if (serviceOrder.userId !== req.user.id) {
      return next(new AppError('You can only delete your own service orders', 403));
    }
    
    if (serviceOrder.status !== 'pending') {
      return next(new AppError('You can only delete pending service orders', 403));
    }
  }
  
  // Delete attachment if it exists
  if (serviceOrder.attachmentFile) {
    const attachmentPath = path.join(UPLOAD_PATHS.attachments, serviceOrder.attachmentFile);
    if (fs.existsSync(attachmentPath)) {
      fs.unlinkSync(attachmentPath);
    }
  }
  
  await serviceOrder.destroy();
  
  res.status(204).json({
    status: 'success',
    data: null
  });
});

// Get service orders by reservation ID
const getServiceOrdersByReservationId = catchAsync(async (req, res, next) => {
  const reservationId = req.params.reservationId;
  
  // Verify reservation exists
  const reservation = await Reservation.findByPk(reservationId);
  if (!reservation) {
    return next(new AppError('Reservation not found', 404));
  }
  
  // If user is a tenant, they can only view service orders for their own reservations
  if (req.user.role === 'tenant' && reservation.userId !== req.user.id) {
    return next(new AppError('You can only view service orders for your own reservations', 403));
  }
  
  const serviceOrders = await ServiceOrder.findAll({
    where: { reservationId },
    include: [
      { model: User, as: 'user', attributes: { exclude: ['password'] } }
    ]
  });
  
  res.status(200).json({
    status: 'success',
    results: serviceOrders.length,
    data: serviceOrders
  });
});

module.exports = {
  getAllServiceOrders,
  getServiceOrderById,
  createServiceOrder,
  updateServiceOrder,
  deleteServiceOrder,
  getServiceOrdersByReservationId
};