// utils/userHelpers.js

const { Op } = require('sequelize');
const Building = require('../models/building.model');
const RealEstateUnit = require('../models/realEstateUnit.model');
const Reservation = require('../models/reservation.model');

/**
 * الحصول على معرفات المستأجرين التابعين لشركة معينة
 * @param {number} companyId - معرف الشركة
 * @returns {Promise<number[]>} - مصفوفة معرفات المستأجرين
 */
const getTenantIdsByCompany = async (companyId) => {
  try {
    // الحصول على معرفات المباني التابعة للشركة
    const buildingIds = await Building.findAll({
      where: { companyId },
      attributes: ['id']
    }).then(buildings => buildings.map(building => building.id));
    
    if (buildingIds.length === 0) {
      return [];
    }
    
    // الحصول على معرفات الوحدات في هذه المباني
    const unitIds = await RealEstateUnit.findAll({
      where: { buildingId: { [Op.in]: buildingIds } },
      attributes: ['id']
    }).then(units => units.map(unit => unit.id));
    
    if (unitIds.length === 0) {
      return [];
    }
    
    // الحصول على معرفات المستأجرين الذين لديهم حجوزات في هذه الوحدات
    const tenantIds = await Reservation.findAll({
      where: { unitId: { [Op.in]: unitIds } },
      attributes: ['userId'],
      group: ['userId']
    }).then(reservations => reservations.map(reservation => reservation.userId));
    
    return tenantIds;
  } catch (error) {
    console.error('Error getting tenant IDs by company:', error);
    return [];
  }
};

/**
 * إنشاء شرط البحث للمستخدمين حسب دور المستخدم الحالي
 * @param {Object} currentUser - المستخدم الحالي
 * @returns {Promise<Object>} - شرط البحث
 */
const createUserWhereCondition = async (currentUser) => {
  if (currentUser.role === 'admin') {
    // Admin يرى فقط المستخدمين من نوع admin و manager
    return {
      role: { [Op.in]: ['admin', 'manager'] }
    };
  }
  
  if (currentUser.role === 'manager') {
    if (!currentUser.companyId) {
      throw new Error('المدير غير مرتبط بأي شركة');
    }
    
    // الحصول على معرفات المستأجرين التابعين للشركة
    const tenantIds = await getTenantIdsByCompany(currentUser.companyId);
    
    // إنشاء شرط البحث
    const conditions = [
      { role: 'accountant', companyId: currentUser.companyId },
      { role: 'maintenance', companyId: currentUser.companyId },
      { role: 'owner', companyId: currentUser.companyId },
    ];
    
    // إضافة المستأجرين إذا وجدوا
    if (tenantIds.length > 0) {
      conditions.push({ id: { [Op.in]: tenantIds }, role: 'tenant' });
    }
    
    return { [Op.or]: conditions };
  }
  
  // للأدوار الأخرى، لا يُسمح بالوصول
  throw new Error('غير مصرح لك بعرض قائمة المستخدمين');
};

module.exports = {
  getTenantIdsByCompany,
  createUserWhereCondition
};