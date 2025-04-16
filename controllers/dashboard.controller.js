// Dashboard controller 
const sequelize = require('../config/database');
const { QueryTypes } = require('sequelize');
const Building = require('../models/building.model');
const RealEstateUnit = require('../models/realEstateUnit.model');
const Reservation = require('../models/reservation.model');
const ServiceOrder = require('../models/serviceOrder.model');
const PaymentHistory = require('../models/paymentHistory.model');
const { catchAsync } = require('../utils/errorHandler');

// Get general statistics
const getGeneralStatistics = catchAsync(async (req, res) => {
  // Count total buildings
  const totalBuildings = await Building.count();
  
  // Count total real estate units
  const totalUnits = await RealEstateUnit.count();
  
  // Count units by status
  const unitsByStatus = await RealEstateUnit.findAll({
    attributes: [
      'status',
      [sequelize.fn('COUNT', sequelize.col('id')), 'count']
    ],
    group: ['status']
  });
  
  // Count active reservations
  const activeReservations = await Reservation.count({
    where: { status: 'active' }
  });
  
  // Get total payment amount
  const totalPaymentResult = await PaymentHistory.findOne({
    attributes: [
      [sequelize.fn('SUM', sequelize.col('amount')), 'total']
    ],
    where: { status: 'paid' }
  });
  
  const totalPayment = totalPaymentResult.getDataValue('total') || 0;
  
  // Count pending service orders
  const pendingServiceOrders = await ServiceOrder.count({
    where: { status: 'pending' }
  });
  
  // Response data
  const statistics = {
    totalBuildings,
    totalUnits,
    unitsByStatus: unitsByStatus.map(item => ({
      status: item.status,
      count: item.getDataValue('count')
    })),
    activeReservations,
    totalPayment,
    pendingServiceOrders
  };
  
  res.status(200).json({
    status: 'success',
    data: statistics
  });
});

// Get units status statistics
const getUnitsStatusStatistics = catchAsync(async (req, res) => {
  // Get units by company
  const unitsByCompany = await sequelize.query(`
    SELECT 
      c.name as companyName,
      COUNT(r.id) as totalUnits,
      SUM(CASE WHEN r.status = 'available' THEN 1 ELSE 0 END) as availableUnits,
      SUM(CASE WHEN r.status = 'rented' THEN 1 ELSE 0 END) as rentedUnits,
      SUM(CASE WHEN r.status = 'maintenance' THEN 1 ELSE 0 END) as maintenanceUnits
    FROM Companies c
    LEFT JOIN Buildings b ON c.id = b.companyId
    LEFT JOIN RealEstateUnits r ON b.id = r.buildingId
    GROUP BY c.id
  `, { type: QueryTypes.SELECT });
  
  // Get units by building
  const unitsByBuilding = await sequelize.query(`
    SELECT 
      b.name as buildingName,
      c.name as companyName,
      COUNT(r.id) as totalUnits,
      SUM(CASE WHEN r.status = 'available' THEN 1 ELSE 0 END) as availableUnits,
      SUM(CASE WHEN r.status = 'rented' THEN 1 ELSE 0 END) as rentedUnits,
      SUM(CASE WHEN r.status = 'maintenance' THEN 1 ELSE 0 END) as maintenanceUnits
    FROM Buildings b
    LEFT JOIN Companies c ON b.companyId = c.id
    LEFT JOIN RealEstateUnits r ON b.id = r.buildingId
    GROUP BY b.id
  `, { type: QueryTypes.SELECT });
  
  // Response data
  const statistics = {
    unitsByCompany,
    unitsByBuilding
  };
  
  res.status(200).json({
    status: 'success',
    data: statistics
  });
});

// Get service orders status statistics
const getServiceOrdersStatusStatistics = catchAsync(async (req, res) => {
  // Get service orders by type
  const serviceOrdersByType = await sequelize.query(`
    SELECT 
      serviceType,
      COUNT(*) as total,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN status = 'in-progress' THEN 1 ELSE 0 END) as inProgress,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected
    FROM ServiceOrders
    GROUP BY serviceType
  `, { type: QueryTypes.SELECT });
  
  // Get service orders by month
  const serviceOrdersByMonth = await sequelize.query(`
    SELECT 
      DATE_FORMAT(createdAt, '%Y-%m') as month,
      COUNT(*) as total,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN status = 'in-progress' THEN 1 ELSE 0 END) as inProgress,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected
    FROM ServiceOrders
    GROUP BY DATE_FORMAT(createdAt, '%Y-%m')
    ORDER BY month DESC
    LIMIT 12
  `, { type: QueryTypes.SELECT });
  
  // Response data
  const statistics = {
    serviceOrdersByType,
    serviceOrdersByMonth
  };
  
  res.status(200).json({
    status: 'success',
    data: statistics
  });
});

module.exports = {
  getGeneralStatistics,
  getUnitsStatusStatistics,
  getServiceOrdersStatusStatistics
};