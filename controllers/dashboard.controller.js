// Dashboard controller - Simplified version with fixes
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
  // Asegurarse de que req.user existe y tiene las propiedades necesarias
  const userRole = req.user?.role || 'unknown';
  const userCompanyId = req.user?.companyId;
  
  // Condiciones base para los filtros
  let buildingWhere = {};
  
  // Si el usuario es un gerente de una compañía, filtrar por esa compañía
  if (userRole === 'manager' && userCompanyId) {
    buildingWhere = { companyId: userCompanyId };
  }
  
  // Obtener el recuento total de edificios usando los filtros
  const totalBuildings = await Building.count({
    where: buildingWhere
  });
  
  // Si el usuario es gerente, conseguir los IDs de los edificios de su compañía
  let buildingIds = [];
  if (userRole === 'manager' && userCompanyId) {
    const buildings = await Building.findAll({
      where: { companyId: userCompanyId },
      attributes: ['id']
    });
    buildingIds = buildings.map(b => b.id);
  }
  
  // Condiciones para unidades
  let unitWhere = {};
  if (userRole === 'manager' && buildingIds.length > 0) {
    unitWhere = { buildingId: buildingIds };
  }
  
  // Obtener recuento total de unidades
  const totalUnits = await RealEstateUnit.count({
    where: unitWhere
  });
  
  // Obtener unidades por estado
  const unitsByStatus = await RealEstateUnit.findAll({
    attributes: [
      'status',
      [sequelize.fn('COUNT', sequelize.col('id')), 'count']
    ],
    where: unitWhere,
    group: ['status']
  });
  
  // Preparar las condiciones para reservas
  let reservationWhere = { status: 'active' };
  
  // Si el usuario es gerente, necesitamos filtrar por unidades de sus edificios
  if (userRole === 'manager' && buildingIds.length > 0) {
    // Obtener IDs de unidades en sus edificios
    const units = await RealEstateUnit.findAll({
      where: { buildingId: buildingIds },
      attributes: ['id']
    });
    const unitIds = units.map(u => u.id);
    
    if (unitIds.length > 0) {
      reservationWhere.unitId = unitIds;
    }
  }
  
  // Obtener reservas activas
  const activeReservations = await Reservation.count({
    where: reservationWhere
  });
  
  // Preparar filtros para pagos
  let paymentWhere = { status: 'paid' };
  
  // Si el usuario es gerente, filtrar por reservas de sus unidades
  if (userRole === 'manager' && buildingIds.length > 0) {
    // Este es un enfoque simplificado - en producción podrías necesitar una consulta más compleja
    const units = await RealEstateUnit.findAll({
      where: { buildingId: buildingIds },
      attributes: ['id']
    });
    const unitIds = units.map(u => u.id);
    
    if (unitIds.length > 0) {
      const reservations = await Reservation.findAll({
        where: { unitId: unitIds },
        attributes: ['id']
      });
      const reservationIds = reservations.map(r => r.id);
      
      if (reservationIds.length > 0) {
        paymentWhere.reservationId = reservationIds;
      }
    }
  }
  
  // Obtener suma total de pagos
  let totalPayment = 0;
  try {
    const paymentSum = await PaymentHistory.sum('amount', {
      where: paymentWhere
    });
    totalPayment = paymentSum || 0;
  } catch (error) {
    console.error('Error al obtener suma de pagos:', error);
  }
  
  // Preparar filtros para órdenes de servicio
  let serviceWhere = { status: 'pending' };
  
  // Si el usuario es gerente, filtrar por reservas de sus unidades
  if (userRole === 'manager' && buildingIds.length > 0) {
    // Enfoque simplificado similar al anterior
    const units = await RealEstateUnit.findAll({
      where: { buildingId: buildingIds },
      attributes: ['id']
    });
    const unitIds = units.map(u => u.id);
    
    if (unitIds.length > 0) {
      const reservations = await Reservation.findAll({
        where: { unitId: unitIds },
        attributes: ['id']
      });
      const reservationIds = reservations.map(r => r.id);
      
      if (reservationIds.length > 0) {
        serviceWhere.reservationId = reservationIds;
      }
    }
  }
  
  // Obtener órdenes de servicio pendientes
  const pendingServiceOrders = await ServiceOrder.count({
    where: serviceWhere
  });
  
  // Preparar los datos de unidades por estado en formato adecuado
  const formattedUnitsByStatus = unitsByStatus.map(item => ({
    status: item.status,
    count: parseInt(item.getDataValue('count') || 0)
  }));
  
  // Preparar respuesta
  const statistics = {
    totalBuildings,
    totalUnits,
    unitsByStatus: formattedUnitsByStatus,
    activeReservations,
    totalPayment,
    pendingServiceOrders,
    userRole
  };
  
  // Enviar respuesta
  res.status(200).json({
    status: 'success',
    data: statistics
  });
});

// Get units status statistics
const getUnitsStatusStatistics = catchAsync(async (req, res) => {
  // Usar consultas SQL directas pero con condiciones de seguridad
  const userRole = req.user?.role || 'unknown';
  const userCompanyId = req.user?.companyId;
  
  // Para simplificar, usaremos el enfoque Sequelize en lugar de SQL directo
  let whereCondition = {};
  let includeCondition = {};
  
  if (userRole === 'manager' && userCompanyId) {
    whereCondition = { companyId: userCompanyId };
  }
  
  // Obtener edificios según el filtro
  const buildings = await Building.findAll({
    where: whereCondition,
    include: [
      { 
        model: RealEstateUnit, 
        as: 'units'
      }
    ]
  });
  
  // Procesar los datos para obtener las estadísticas necesarias
  const unitsByCompany = [];
  const unitsByBuilding = [];
  
  // Agrupar por compañía
  const companiesMap = new Map();
  
  buildings.forEach(building => {
    const companyId = building.companyId;
    
    // Inicializar datos de la compañía si no existe
    if (!companiesMap.has(companyId)) {
      companiesMap.set(companyId, {
        companyId,
        companyName: building.company ? building.company.name : 'Unknown',
        totalUnits: 0,
        availableUnits: 0,
        rentedUnits: 0,
        maintenanceUnits: 0
      });
    }
    
    // Sumar unidades a la compañía
    const companyData = companiesMap.get(companyId);
    const units = building.units || [];
    
    companyData.totalUnits += units.length;
    companyData.availableUnits += units.filter(u => u.status === 'available').length;
    companyData.rentedUnits += units.filter(u => u.status === 'rented').length;
    companyData.maintenanceUnits += units.filter(u => u.status === 'maintenance').length;
    
    // Datos por edificio
    unitsByBuilding.push({
      buildingId: building.id,
      buildingName: building.name,
      companyId,
      companyName: building.company ? building.company.name : 'Unknown',
      totalUnits: units.length,
      availableUnits: units.filter(u => u.status === 'available').length,
      rentedUnits: units.filter(u => u.status === 'rented').length,
      maintenanceUnits: units.filter(u => u.status === 'maintenance').length
    });
  });
  
  // Convertir Map a array
  companiesMap.forEach(companyData => {
    unitsByCompany.push(companyData);
  });
  
  // Enviar respuesta
  res.status(200).json({
    status: 'success',
    data: {
      unitsByCompany,
      unitsByBuilding,
      userRole
    }
  });
});

// Get service orders status statistics
const getServiceOrdersStatusStatistics = catchAsync(async (req, res) => {
  // Para este caso, usaremos una implementación muy básica que funcione
  // En un entorno de producción, se necesitaría una consulta más optimizada
  
  const userRole = req.user?.role || 'unknown';
  const userCompanyId = req.user?.companyId;
  
  let whereCondition = {};
  let includeConditions = [];
  
  // Si es un gerente, filtrar por su compañía
  if (userRole === 'manager' && userCompanyId) {
    includeConditions = [
      {
        model: Reservation,
        as: 'reservation',
        include: [
          {
            model: RealEstateUnit,
            as: 'unit',
            include: [
              {
                model: Building,
                as: 'building',
                where: { companyId: userCompanyId }
              }
            ]
          }
        ]
      }
    ];
  }
  
  // Obtener todas las órdenes de servicio con los filtros necesarios
  const serviceOrders = await ServiceOrder.findAll({
    where: whereCondition,
    include: includeConditions
  });
  
  // Procesar los datos para estadísticas
  // Agrupar por tipo de servicio
  const typeMap = new Map();
  
  serviceOrders.forEach(order => {
    const type = order.serviceType;
    
    if (!typeMap.has(type)) {
      typeMap.set(type, {
        serviceType: type,
        total: 0,
        pending: 0,
        inProgress: 0,
        completed: 0,
        rejected: 0
      });
    }
    
    const typeData = typeMap.get(type);
    typeData.total++;
    
    // Incrementar contador según estado
    switch(order.status) {
      case 'pending':
        typeData.pending++;
        break;
      case 'in-progress':
        typeData.inProgress++;
        break;
      case 'completed':
        typeData.completed++;
        break;
      case 'rejected':
        typeData.rejected++;
        break;
    }
  });
  
  // Convertir Map a array
  const serviceOrdersByType = Array.from(typeMap.values());
  
  // Agrupar por mes simplificado (solo últimos 12 meses)
  const monthMap = new Map();
  const now = new Date();
  
  // Inicializar últimos 12 meses
  for (let i = 0; i < 12; i++) {
    const date = new Date(now);
    date.setMonth(now.getMonth() - i);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    
    monthMap.set(monthKey, {
      month: monthKey,
      total: 0,
      pending: 0,
      inProgress: 0,
      completed: 0,
      rejected: 0
    });
  }
  
  // Procesar órdenes
  serviceOrders.forEach(order => {
    const date = new Date(order.createdAt);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    
    if (monthMap.has(monthKey)) {
      const monthData = monthMap.get(monthKey);
      monthData.total++;
      
      // Incrementar contador según estado
      switch(order.status) {
        case 'pending':
          monthData.pending++;
          break;
        case 'in-progress':
          monthData.inProgress++;
          break;
        case 'completed':
          monthData.completed++;
          break;
        case 'rejected':
          monthData.rejected++;
          break;
      }
    }
  });
  
  // Convertir Map a array y ordenar por mes
  const serviceOrdersByMonth = Array.from(monthMap.values())
    .sort((a, b) => b.month.localeCompare(a.month));
  
  // Enviar respuesta
  res.status(200).json({
    status: 'success',
    data: {
      serviceOrdersByType,
      serviceOrdersByMonth,
      userRole
    }
  });
});

module.exports = {
  getGeneralStatistics,
  getUnitsStatusStatistics,
  getServiceOrdersStatusStatistics
};