// Dashboard controller with role-based statistics
const sequelize = require('../config/database');
const { QueryTypes } = require('sequelize');
const Building = require('../models/building.model');
const RealEstateUnit = require('../models/realEstateUnit.model');
const Reservation = require('../models/reservation.model');
const ServiceOrder = require('../models/serviceOrder.model');
const PaymentHistory = require('../models/paymentHistory.model');
const Company = require('../models/company.model');
const { catchAsync, AppError } = require('../utils/errorHandler');
const { Op } = require('sequelize');

// Get general statistics based on user role
const getGeneralStatistics = catchAsync(async (req, res) => {
  const { role, companyId } = req.user;
  
  // Base query conditions
  let buildingCondition = {};
  let unitCondition = {};
  let reservationCondition = {};
  let serviceOrderCondition = {};
  let paymentCondition = {};
  
  // If user is a manager, filter data by their company
  if (role === 'manager' && companyId) {
    // Get buildings for this company
    const buildings = await Building.findAll({
      where: { companyId },
      attributes: ['id']
    });
    
    const buildingIds = buildings.map(building => building.id);
    
    // Get units in these buildings
    const units = await RealEstateUnit.findAll({
      where: { buildingId: { [Op.in]: buildingIds } },
      attributes: ['id']
    });
    
    const unitIds = units.map(unit => unit.id);
    
    // Get reservations for these units
    const reservations = await Reservation.findAll({
      where: { unitId: { [Op.in]: unitIds } },
      attributes: ['id']
    });
    
    const reservationIds = reservations.map(reservation => reservation.id);
    
    // Set conditions for different entities
    buildingCondition = { companyId };
    unitCondition = { buildingId: { [Op.in]: buildingIds } };
    reservationCondition = { unitId: { [Op.in]: unitIds } };
    serviceOrderCondition = { reservationId: { [Op.in]: reservationIds } };
    paymentCondition = { reservationId: { [Op.in]: reservationIds } };
  }
  
  // Count total buildings
  const totalBuildings = await Building.count({
    where: buildingCondition
  });
  
  // Count total real estate units
  const totalUnits = await RealEstateUnit.count({
    where: unitCondition
  });
  
  // Count units by status
  const unitsByStatus = await RealEstateUnit.findAll({
    attributes: [
      'status',
      [sequelize.fn('COUNT', sequelize.col('id')), 'count']
    ],
    where: unitCondition,
    group: ['status']
  });
  
  // Count active reservations
  const activeReservations = await Reservation.count({
    where: {
      ...reservationCondition,
      status: 'active'
    }
  });
  
  // Get total payment amount
  const totalPaymentResult = await PaymentHistory.findOne({
    attributes: [
      [sequelize.fn('SUM', sequelize.col('amount')), 'total']
    ],
    where: {
      ...paymentCondition,
      status: 'paid'
    }
  });
  
  const totalPayment = totalPaymentResult ? totalPaymentResult.getDataValue('total') || 0 : 0;
  
  // Count pending service orders
  const pendingServiceOrders = await ServiceOrder.count({
    where: {
      ...serviceOrderCondition,
      status: 'pending'
    }
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
    pendingServiceOrders,
    userRole: role // Include user role in response
  };
  
  res.status(200).json({
    status: 'success',
    data: statistics
  });
});

// Get units status statistics based on user role
const getUnitsStatusStatistics = catchAsync(async (req, res) => {
  const { role, companyId } = req.user;
  
  let unitsByCompany;
  let unitsByBuilding;
  
  if (role === 'admin') {
    // For admin: get units stats for all companies
    unitsByCompany = await sequelize.query(`
      SELECT 
        c.id as companyId,
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
    
    // Get units by building for all buildings
    unitsByBuilding = await sequelize.query(`
      SELECT 
        b.id as buildingId,
        b.name as buildingName,
        c.id as companyId,
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
  } else if (role === 'manager' && companyId) {
    // For manager: get units stats only for their company
    unitsByCompany = await sequelize.query(`
      SELECT 
        c.id as companyId,
        c.name as companyName,
        COUNT(r.id) as totalUnits,
        SUM(CASE WHEN r.status = 'available' THEN 1 ELSE 0 END) as availableUnits,
        SUM(CASE WHEN r.status = 'rented' THEN 1 ELSE 0 END) as rentedUnits,
        SUM(CASE WHEN r.status = 'maintenance' THEN 1 ELSE 0 END) as maintenanceUnits
      FROM Companies c
      LEFT JOIN Buildings b ON c.id = b.companyId
      LEFT JOIN RealEstateUnits r ON b.id = r.buildingId
      WHERE c.id = :companyId
      GROUP BY c.id
    `, { 
      replacements: { companyId },
      type: QueryTypes.SELECT 
    });
    
    // Get units by building only for the manager's company
    unitsByBuilding = await sequelize.query(`
      SELECT 
        b.id as buildingId,
        b.name as buildingName,
        c.id as companyId,
        c.name as companyName,
        COUNT(r.id) as totalUnits,
        SUM(CASE WHEN r.status = 'available' THEN 1 ELSE 0 END) as availableUnits,
        SUM(CASE WHEN r.status = 'rented' THEN 1 ELSE 0 END) as rentedUnits,
        SUM(CASE WHEN r.status = 'maintenance' THEN 1 ELSE 0 END) as maintenanceUnits
      FROM Buildings b
      LEFT JOIN Companies c ON b.companyId = c.id
      LEFT JOIN RealEstateUnits r ON b.id = r.buildingId
      WHERE c.id = :companyId
      GROUP BY b.id
    `, { 
      replacements: { companyId },
      type: QueryTypes.SELECT 
    });
  } else {
    return res.status(403).json({
      status: 'error',
      message: 'You do not have permission to access these statistics or missing company information'
    });
  }
  
  // Response data
  const statistics = {
    unitsByCompany,
    unitsByBuilding,
    userRole: role // Include user role in response
  };
  
  res.status(200).json({
    status: 'success',
    data: statistics
  });
});

// Get service orders status statistics based on user role
const getServiceOrdersStatusStatistics = catchAsync(async (req, res) => {
  const { role, companyId } = req.user;
  
  let serviceOrdersByType;
  let serviceOrdersByMonth;
  
  if (role === 'admin') {
    // For admin: get service orders stats for all companies
    serviceOrdersByType = await sequelize.query(`
      SELECT 
        so.serviceType,
        COUNT(*) as total,
        SUM(CASE WHEN so.status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN so.status = 'in-progress' THEN 1 ELSE 0 END) as inProgress,
        SUM(CASE WHEN so.status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN so.status = 'rejected' THEN 1 ELSE 0 END) as rejected
      FROM ServiceOrders so
      GROUP BY so.serviceType
    `, { type: QueryTypes.SELECT });
    
    // Get service orders by month for all service orders
    serviceOrdersByMonth = await sequelize.query(`
      SELECT 
        DATE_FORMAT(so.createdAt, '%Y-%m') as month,
        COUNT(*) as total,
        SUM(CASE WHEN so.status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN so.status = 'in-progress' THEN 1 ELSE 0 END) as inProgress,
        SUM(CASE WHEN so.status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN so.status = 'rejected' THEN 1 ELSE 0 END) as rejected
      FROM ServiceOrders so
      GROUP BY DATE_FORMAT(so.createdAt, '%Y-%m')
      ORDER BY month DESC
      LIMIT 12
    `, { type: QueryTypes.SELECT });
  } else if (role === 'manager' && companyId) {
    // For manager: get service orders stats only for their company
    // First, get buildings for this company
    const buildings = await Building.findAll({
      where: { companyId },
      attributes: ['id']
    });
    
    const buildingIds = buildings.map(building => building.id);
    
    // Get units in these buildings
    const units = await RealEstateUnit.findAll({
      where: { buildingId: { [Op.in]: buildingIds } },
      attributes: ['id']
    });
    
    const unitIds = units.map(unit => unit.id);
    
    // Convert unitIds to string format for SQL query
    const unitIdsStr = unitIds.join(',');
    
    if (unitIds.length === 0) {
      // Return empty results if no units found
      return res.status(200).json({
        status: 'success',
        data: {
          serviceOrdersByType: [],
          serviceOrdersByMonth: [],
          userRole: role
        }
      });
    }
    
    // Get service orders by type for this company's units
    serviceOrdersByType = await sequelize.query(`
      SELECT 
        so.serviceType,
        COUNT(*) as total,
        SUM(CASE WHEN so.status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN so.status = 'in-progress' THEN 1 ELSE 0 END) as inProgress,
        SUM(CASE WHEN so.status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN so.status = 'rejected' THEN 1 ELSE 0 END) as rejected
      FROM ServiceOrders so
      JOIN Reservations r ON so.reservationId = r.id
      WHERE r.unitId IN (${unitIdsStr})
      GROUP BY so.serviceType
    `, { type: QueryTypes.SELECT });
    
    // Get service orders by month for this company's units
    serviceOrdersByMonth = await sequelize.query(`
      SELECT 
        DATE_FORMAT(so.createdAt, '%Y-%m') as month,
        COUNT(*) as total,
        SUM(CASE WHEN so.status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN so.status = 'in-progress' THEN 1 ELSE 0 END) as inProgress,
        SUM(CASE WHEN so.status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN so.status = 'rejected' THEN 1 ELSE 0 END) as rejected
      FROM ServiceOrders so
      JOIN Reservations r ON so.reservationId = r.id
      WHERE r.unitId IN (${unitIdsStr})
      GROUP BY DATE_FORMAT(so.createdAt, '%Y-%m')
      ORDER BY month DESC
      LIMIT 12
    `, { type: QueryTypes.SELECT });
  } else {
    return res.status(403).json({
      status: 'error',
      message: 'You do not have permission to access these statistics or missing company information'
    });
  }
  
  // Response data
  const statistics = {
    serviceOrdersByType,
    serviceOrdersByMonth,
    userRole: role // Include user role in response
  };
  
  res.status(200).json({
    status: 'success',
    data: statistics
  });
});

// Get revenue statistics based on user role
const getRevenueStatistics = catchAsync(async (req, res) => {
  const { role, companyId } = req.user;
  
  let revenueByCompany;
  let revenueByMonth;
  
  if (role === 'admin') {
    // For admin: get revenue stats for all companies
    revenueByCompany = await sequelize.query(`
      SELECT 
        c.id as companyId,
        c.name as companyName,
        SUM(ph.amount) as totalRevenue,
        COUNT(DISTINCT r.id) as reservationCount
      FROM Companies c
      JOIN Buildings b ON c.id = b.companyId
      JOIN RealEstateUnits u ON b.id = u.buildingId
      JOIN Reservations r ON u.id = r.unitId
      JOIN PaymentHistories ph ON r.id = ph.reservationId
      WHERE ph.status = 'paid'
      GROUP BY c.id
      ORDER BY totalRevenue DESC
    `, { type: QueryTypes.SELECT });
    
    // Get revenue by month for all companies
    revenueByMonth = await sequelize.query(`
      SELECT 
        DATE_FORMAT(ph.paymentDate, '%Y-%m') as month,
        SUM(ph.amount) as totalRevenue,
        COUNT(ph.id) as paymentCount
      FROM PaymentHistories ph
      WHERE ph.status = 'paid'
      GROUP BY DATE_FORMAT(ph.paymentDate, '%Y-%m')
      ORDER BY month DESC
      LIMIT 12
    `, { type: QueryTypes.SELECT });
  } else if (role === 'manager' && companyId) {
    // For manager: get revenue stats only for their company
    revenueByCompany = await sequelize.query(`
      SELECT 
        c.id as companyId,
        c.name as companyName,
        SUM(ph.amount) as totalRevenue,
        COUNT(DISTINCT r.id) as reservationCount
      FROM Companies c
      JOIN Buildings b ON c.id = b.companyId
      JOIN RealEstateUnits u ON b.id = u.buildingId
      JOIN Reservations r ON u.id = r.unitId
      JOIN PaymentHistories ph ON r.id = ph.reservationId
      WHERE ph.status = 'paid' AND c.id = :companyId
      GROUP BY c.id
    `, { 
      replacements: { companyId },
      type: QueryTypes.SELECT 
    });
    
    // Get revenue by month for manager's company
    revenueByMonth = await sequelize.query(`
      SELECT 
        DATE_FORMAT(ph.paymentDate, '%Y-%m') as month,
        SUM(ph.amount) as totalRevenue,
        COUNT(ph.id) as paymentCount
      FROM PaymentHistories ph
      JOIN Reservations r ON ph.reservationId = r.id
      JOIN RealEstateUnits u ON r.unitId = u.id
      JOIN Buildings b ON u.buildingId = b.id
      WHERE ph.status = 'paid' AND b.companyId = :companyId
      GROUP BY DATE_FORMAT(ph.paymentDate, '%Y-%m')
      ORDER BY month DESC
      LIMIT 12
    `, { 
      replacements: { companyId },
      type: QueryTypes.SELECT 
    });
  } else {
    return res.status(403).json({
      status: 'error',
      message: 'You do not have permission to access these statistics or missing company information'
    });
  }
  
  // Calculate total revenue
  const totalRevenue = revenueByCompany.reduce((sum, company) => sum + parseFloat(company.totalRevenue || 0), 0);
  
  // Response data
  const statistics = {
    totalRevenue,
    revenueByCompany,
    revenueByMonth,
    userRole: role // Include user role in response
  };
  
  res.status(200).json({
    status: 'success',
    data: statistics
  });
});

module.exports = {
  getGeneralStatistics,
  getUnitsStatusStatistics,
  getServiceOrdersStatusStatistics,
  getRevenueStatistics
};