// Dashboard controller - optimized version
const sequelize = require('../config/database');
const { Op } = require('sequelize');
const Building = require('../models/building.model');
const RealEstateUnit = require('../models/realEstateUnit.model');
const Reservation = require('../models/reservation.model');
const ServiceOrder = require('../models/serviceOrder.model');
const PaymentHistory = require('../models/paymentHistory.model');
const Company = require('../models/company.model');
const User = require('../models/user.model');
const { catchAsync, AppError } = require('../utils/errorHandler');

// معالجة الإحصائيات العامة
const getGeneralStatistics = catchAsync(async (req, res, next) => {
  try {
    // تعريف الفلاتر حسب دور المستخدم
    let buildingWhere = {};
    let companyInclude = {};
    
    // إذا كان المستخدم مديرًا، قم بفلترة البيانات حسب شركته
    if (req.user.role === 'manager') {
      if (!req.user.companyId) {
        return next(new AppError('المدير غير مرتبط بأي شركة', 403));
      }
      
      // فلترة المباني حسب الشركة
      buildingWhere = { companyId: req.user.companyId };
      companyInclude = { model: Company, as: 'company', where: { id: req.user.companyId } };
    }

    // 1. إحصاء المباني
    const totalBuildings = await Building.count({
      where: buildingWhere
    });
    
    // 2. الحصول على معرفات المباني (مهم للفلترة اللاحقة)
    const buildings = await Building.findAll({
      where: buildingWhere,
      attributes: ['id']
    });
    
    const buildingIds = buildings.map(building => building.id);
    
    // لمعالجة الحالة التي لا توجد فيها مباني
    if (buildingIds.length === 0) {
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
    
    // 3. إحصاء الوحدات العقارية
    const totalUnits = await RealEstateUnit.count({
      where: {
        buildingId: { [Op.in]: buildingIds }
      }
    });
    
    // 4. إحصاء الوحدات حسب الحالة
    const unitsByStatus = await RealEstateUnit.findAll({
      attributes: [
        'status',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      where: {
        buildingId: { [Op.in]: buildingIds }
      },
      group: ['status'],
      raw: true
    });
    
    // 5. الحصول على معرفات الوحدات (مهم للفلترة اللاحقة)
    const units = await RealEstateUnit.findAll({
      where: {
        buildingId: { [Op.in]: buildingIds }
      },
      attributes: ['id']
    });
    
    const unitIds = units.map(unit => unit.id);
    
    // لمعالجة الحالة التي لا توجد فيها وحدات عقارية
    if (unitIds.length === 0) {
      return res.status(200).json({
        status: 'success',
        data: {
          totalBuildings,
          totalUnits: 0,
          unitsByStatus: [],
          activeReservations: 0,
          totalPayment: 0,
          pendingServiceOrders: 0
        }
      });
    }
    
    // 6. إحصاء الحجوزات النشطة
    const activeReservations = await Reservation.count({
      where: {
        unitId: { [Op.in]: unitIds },
        status: 'active'
      }
    });
    
    // 7. الحصول على معرفات الحجوزات (مهم للفلترة اللاحقة)
    const reservations = await Reservation.findAll({
      where: {
        unitId: { [Op.in]: unitIds }
      },
      attributes: ['id']
    });
    
    const reservationIds = reservations.map(reservation => reservation.id);
    
    // 8. حساب إجمالي المدفوعات
    let totalPayment = 0;
    if (reservationIds.length > 0) {
      const paymentResult = await PaymentHistory.findOne({
        attributes: [
          [sequelize.fn('SUM', sequelize.col('amount')), 'total']
        ],
        where: {
          reservationId: { [Op.in]: reservationIds },
          status: 'paid'
        },
        raw: true
      });
      
      totalPayment = paymentResult ? Number(paymentResult.total) || 0 : 0;
    }
    
    // 9. إحصاء طلبات الخدمة المعلقة
    let pendingServiceOrders = 0;
    if (reservationIds.length > 0) {
      pendingServiceOrders = await ServiceOrder.count({
        where: {
          reservationId: { [Op.in]: reservationIds },
          status: 'pending'
        }
      });
    }
    
    // تحضير البيانات للرد
    const unitStatusCounts = {
      available: 0,
      rented: 0,
      maintenance: 0
    };
    
    // تحويل نتائج الاستعلام إلى تنسيق أسهل للاستخدام
    unitsByStatus.forEach(item => {
      if (item.status in unitStatusCounts) {
        unitStatusCounts[item.status] = parseInt(item.count, 10);
      }
    });
    
    const formattedUnitsByStatus = Object.keys(unitStatusCounts).map(status => ({
      status,
      count: unitStatusCounts[status]
    }));
    
    // الاستجابة بالإحصائيات
    res.status(200).json({
      status: 'success',
      data: {
        totalBuildings,
        totalUnits,
        unitsByStatus: formattedUnitsByStatus,
        activeReservations,
        totalPayment,
        pendingServiceOrders
      }
    });
    
  } catch (error) {
    console.error("Error in dashboard statistics:", error);
    return next(new AppError('خطأ في استرجاع إحصائيات لوحة المعلومات', 500));
  }
});

// إحصائيات حالة الوحدات
const getUnitsStatusStatistics = catchAsync(async (req, res, next) => {
  try {
    // فلترة حسب دور المستخدم
    const companyFilter = {};
    
    if (req.user.role === 'manager') {
      if (!req.user.companyId) {
        return next(new AppError('المدير غير مرتبط بأي شركة', 403));
      }
      companyFilter.id = req.user.companyId;
    }
    
    // استعلام إحصائيات الوحدات حسب الشركة
    const companies = await Company.findAll({
      where: companyFilter,
      include: [{
        model: Building,
        as: 'buildings',
        include: [{
          model: RealEstateUnit,
          as: 'units'
        }]
      }],
      attributes: ['id', 'name']
    });
    
    // معالجة البيانات للحصول على إحصائيات لكل شركة
    const unitsByCompany = companies.map(company => {
      // تجميع كل الوحدات من جميع المباني التابعة للشركة
      const allUnits = company.buildings.flatMap(building => building.units);
      
      // حساب عدد الوحدات لكل حالة
      const availableUnits = allUnits.filter(unit => unit.status === 'available').length;
      const rentedUnits = allUnits.filter(unit => unit.status === 'rented').length;
      const maintenanceUnits = allUnits.filter(unit => unit.status === 'maintenance').length;
      
      return {
        companyName: company.name,
        totalUnits: allUnits.length,
        availableUnits,
        rentedUnits,
        maintenanceUnits
      };
    });
    
    // استعلام إحصائيات الوحدات حسب المبنى
    const buildingWhere = {};
    if (req.user.role === 'manager') {
      buildingWhere.companyId = req.user.companyId;
    }
    
    const buildings = await Building.findAll({
      where: buildingWhere,
      include: [
        {
          model: Company,
          as: 'company',
          attributes: ['id', 'name']
        },
        {
          model: RealEstateUnit,
          as: 'units'
        }
      ],
      attributes: ['id', 'name']
    });
    
    // معالجة البيانات للحصول على إحصائيات لكل مبنى
    const unitsByBuilding = buildings.map(building => {
      const availableUnits = building.units.filter(unit => unit.status === 'available').length;
      const rentedUnits = building.units.filter(unit => unit.status === 'rented').length;
      const maintenanceUnits = building.units.filter(unit => unit.status === 'maintenance').length;
      
      return {
        buildingName: building.name,
        companyName: building.company ? building.company.name : 'غير معروف',
        totalUnits: building.units.length,
        availableUnits,
        rentedUnits,
        maintenanceUnits
      };
    });
    
    res.status(200).json({
      status: 'success',
      data: {
        unitsByCompany,
        unitsByBuilding
      }
    });
    
  } catch (error) {
    console.error("Error in units status statistics:", error);
    return next(new AppError('خطأ في استرجاع إحصائيات حالة الوحدات', 500));
  }
});

// إحصائيات طلبات الخدمة
const getServiceOrdersStatusStatistics = catchAsync(async (req, res, next) => {
  try {
    // فلترة حسب دور المستخدم
    let whereCondition = {};
    let includeConditions = [];
    
    if (req.user.role === 'manager') {
      if (!req.user.companyId) {
        return next(new AppError('المدير غير مرتبط بأي شركة', 403));
      }
      
      // للمدير، نحتاج إلى فلترة طلبات الخدمة المرتبطة بشركته فقط
      includeConditions = [
        {
          model: Reservation,
          as: 'reservation',
          include: [{
            model: RealEstateUnit,
            as: 'unit',
            include: [{
              model: Building,
              as: 'building',
              where: { companyId: req.user.companyId }
            }]
          }]
        }
      ];
    }
    
    // الحصول على جميع طلبات الخدمة مع الفلترة المناسبة
    const serviceOrders = await ServiceOrder.findAll({
      where: whereCondition,
      include: includeConditions
    });
    
    // تنظيم البيانات حسب نوع الخدمة
    const serviceTypeCounts = {};
    const serviceMonthCounts = {};
    
    serviceOrders.forEach(order => {
      // إحصائيات حسب نوع الخدمة
      if (!serviceTypeCounts[order.serviceType]) {
        serviceTypeCounts[order.serviceType] = {
          serviceType: order.serviceType,
          total: 0,
          pending: 0,
          inProgress: 0,
          completed: 0,
          rejected: 0
        };
      }
      
      serviceTypeCounts[order.serviceType].total++;
      
      switch (order.status) {
        case 'pending':
          serviceTypeCounts[order.serviceType].pending++;
          break;
        case 'in-progress':
          serviceTypeCounts[order.serviceType].inProgress++;
          break;
        case 'completed':
          serviceTypeCounts[order.serviceType].completed++;
          break;
        case 'rejected':
          serviceTypeCounts[order.serviceType].rejected++;
          break;
      }
      
      // إحصائيات حسب الشهر
      const createdAt = new Date(order.createdAt);
      const monthKey = `${createdAt.getFullYear()}-${String(createdAt.getMonth() + 1).padStart(2, '0')}`;
      
      if (!serviceMonthCounts[monthKey]) {
        serviceMonthCounts[monthKey] = {
          month: monthKey,
          total: 0,
          pending: 0,
          inProgress: 0,
          completed: 0,
          rejected: 0
        };
      }
      
      serviceMonthCounts[monthKey].total++;
      
      switch (order.status) {
        case 'pending':
          serviceMonthCounts[monthKey].pending++;
          break;
        case 'in-progress':
          serviceMonthCounts[monthKey].inProgress++;
          break;
        case 'completed':
          serviceMonthCounts[monthKey].completed++;
          break;
        case 'rejected':
          serviceMonthCounts[monthKey].rejected++;
          break;
      }
    });
    
    // تحويل النتائج إلى مصفوفات
    const serviceOrdersByType = Object.values(serviceTypeCounts);
    
    // ترتيب النتائج حسب الشهر (تنازلياً)
    const serviceOrdersByMonth = Object.values(serviceMonthCounts)
      .sort((a, b) => b.month.localeCompare(a.month))
      .slice(0, 12); // الاحتفاظ بآخر 12 شهر فقط
    
    res.status(200).json({
      status: 'success',
      data: {
        serviceOrdersByType,
        serviceOrdersByMonth
      }
    });
    
  } catch (error) {
    console.error("Error in service orders statistics:", error);
    return next(new AppError('خطأ في استرجاع إحصائيات طلبات الخدمة', 500));
  }
});

module.exports = {
  getGeneralStatistics,
  getUnitsStatusStatistics,
  getServiceOrdersStatusStatistics
};