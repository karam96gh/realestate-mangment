// Dashboard controller - updated version
const sequelize = require('../config/database');
const { QueryTypes } = require('sequelize');
const Building = require('../models/building.model');
const RealEstateUnit = require('../models/realEstateUnit.model');
const Reservation = require('../models/reservation.model');
const ServiceOrder = require('../models/serviceOrder.model');
const PaymentHistory = require('../models/paymentHistory.model');
const { catchAsync, AppError } = require('../utils/errorHandler');

// Get general statistics
const getGeneralStatistics = catchAsync(async (req, res, next) => {
  // تحقق من صلاحيات المستخدم وتطبيق الفلترة المناسبة
  let whereBuildings = {};
  let whereUnits = {};
  let whereReservations = {};
  let wherePayments = {};
  let whereServiceOrders = {};

  // إذا كان المستخدم مديراً، قم بفلترة البيانات حسب شركته
  if (req.user.role === 'manager') {
    if (!req.user.companyId) {
      return next(new AppError('المدير غير مرتبط بأي شركة', 403));
    }

    // الحصول على معرفات المباني التابعة للشركة
    const buildings = await Building.findAll({
      where: { companyId: req.user.companyId },
      attributes: ['id']
    });
    
    const buildingIds = buildings.map(building => building.id);
    
    if (buildingIds.length === 0) {
      // إذا لم يكن هناك مبانٍ للشركة، قم بإرجاع إحصائيات فارغة
      return res.status(200).json({
        status: 'success',
        data: {
          totalBuildings: 0,
          totalUnits: 0,
          unitsByStatus: [],
          activeReservations: 0,
          totalPayment: 0,
          pendingServiceOrders: 0
        }
      });
    }
    
    whereBuildings = { id: buildingIds };
    whereUnits = { buildingId: buildingIds };
    
    // الحصول على معرفات الوحدات العقارية
    const units = await RealEstateUnit.findAll({
      where: whereUnits,
      attributes: ['id']
    });
    
    const unitIds = units.map(unit => unit.id);
    
    // فلترة الحجوزات حسب الوحدات العقارية
    whereReservations = unitIds.length > 0 ? { unitId: unitIds } : { id: 0 }; // تعطي نتيجة فارغة إذا لم تكن هناك وحدات
    
    // الحصول على معرفات الحجوزات
    const reservations = await Reservation.findAll({
      where: whereReservations,
      attributes: ['id']
    });
    
    const reservationIds = reservations.map(reservation => reservation.id);
    
    // فلترة المدفوعات وطلبات الخدمة حسب الحجوزات
    wherePayments = reservationIds.length > 0 ? { reservationId: reservationIds } : { id: 0 };
    whereServiceOrders = reservationIds.length > 0 ? { reservationId: reservationIds } : { id: 0 };
  }

  // Count total buildings
  const totalBuildings = await Building.count({
    where: whereBuildings
  });
  
  // Count total real estate units
  const totalUnits = await RealEstateUnit.count({
    where: whereUnits
  });
  
  // Count units by status
  const unitsByStatus = await RealEstateUnit.findAll({
    attributes: [
      'status',
      [sequelize.fn('COUNT', sequelize.col('id')), 'count']
    ],
    where: whereUnits,
    group: ['status']
  });
  
  // Count active reservations
  const activeReservations = await Reservation.count({
    where: { ...whereReservations, status: 'active' }
  });
  
  // Get total payment amount
  const totalPaymentResult = await PaymentHistory.findOne({
    attributes: [
      [sequelize.fn('SUM', sequelize.col('amount')), 'total']
    ],
    where: { ...wherePayments, status: 'paid' }
  });
  
  const totalPayment = totalPaymentResult.getDataValue('total') || 0;
  
  // Count pending service orders
  const pendingServiceOrders = await ServiceOrder.count({
    where: { ...whereServiceOrders, status: 'pending' }
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
const getUnitsStatusStatistics = catchAsync(async (req, res, next) => {
  let companyFilter = '';
  let buildingFilter = '';
  
  // إذا كان المستخدم مديرًا، نطبق فلتر الشركة
  if (req.user.role === 'manager') {
    if (!req.user.companyId) {
      return next(new AppError('المدير غير مرتبط بأي شركة', 403));
    }
    
    companyFilter = `WHERE c.id = ${req.user.companyId}`;
    buildingFilter = `WHERE b.companyId = ${req.user.companyId}`;
  }
  
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
    ${companyFilter}
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
    ${buildingFilter}
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
const getServiceOrdersStatusStatistics = catchAsync(async (req, res, next) => {
  let serviceOrderFilter = '';
  
  // إذا كان المستخدم مديرًا، نطبق فلتر الشركة
  if (req.user.role === 'manager') {
    if (!req.user.companyId) {
      return next(new AppError('المدير غير مرتبط بأي شركة', 403));
    }
    
    // نحتاج إلى فلترة طلبات الخدمة حسب الحجوزات المرتبطة بوحدات المباني التابعة للشركة
    serviceOrderFilter = `
      WHERE so.reservationId IN (
        SELECT r.id FROM Reservations r
        JOIN RealEstateUnits u ON r.unitId = u.id
        JOIN Buildings b ON u.buildingId = b.id
        WHERE b.companyId = ${req.user.companyId}
      )
    `;
  }
  
  // Get service orders by type
  const serviceOrdersByType = await sequelize.query(`
    SELECT 
      so.serviceType,
      COUNT(*) as total,
      SUM(CASE WHEN so.status = 'pending' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN so.status = 'in-progress' THEN 1 ELSE 0 END) as inProgress,
      SUM(CASE WHEN so.status = 'completed' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN so.status = 'rejected' THEN 1 ELSE 0 END) as rejected
    FROM ServiceOrders so
    ${serviceOrderFilter}
    GROUP BY so.serviceType
  `, { type: QueryTypes.SELECT });
  
  // Get service orders by month
  const serviceOrdersByMonth = await sequelize.query(`
    SELECT 
      DATE_FORMAT(so.createdAt, '%Y-%m') as month,
      COUNT(*) as total,
      SUM(CASE WHEN so.status = 'pending' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN so.status = 'in-progress' THEN 1 ELSE 0 END) as inProgress,
      SUM(CASE WHEN so.status = 'completed' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN so.status = 'rejected' THEN 1 ELSE 0 END) as rejected
    FROM ServiceOrders so
    ${serviceOrderFilter}
    GROUP BY DATE_FORMAT(so.createdAt, '%Y-%m')
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