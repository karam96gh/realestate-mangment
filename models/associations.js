// models/associations.js
// ملف يقوم بتعريف العلاقات بين جميع النماذج بعد تعريفها

// استيراد جميع النماذج
const User = require('./user.model');
const Company = require('./company.model');
const Building = require('./building.model');
const RealEstateUnit = require('./realEstateUnit.model');
const Reservation = require('./reservation.model');
const ServiceOrder = require('./serviceOrder.model');
const PaymentHistory = require('./paymentHistory.model');

// تعريف العلاقات بين Company و User
// استخدم اسماً مستعاراً مختلفاً للعلاقة: companyManager بدلاً من manager
Company.hasOne(User, {
  foreignKey: 'companyId',
  as: 'companyManager',  // تغيير الاسم المستعار من manager إلى companyManager
  scope: {
    role: 'manager'
  }
});

User.belongsTo(Company, {
  foreignKey: 'companyId',
  as: 'company'
});

// تعريف العلاقات بين Building و Company
Building.belongsTo(Company, { foreignKey: 'companyId', as: 'company' });
Company.hasMany(Building, { foreignKey: 'companyId', as: 'buildings' });

// تعريف العلاقات بين RealEstateUnit و Building
RealEstateUnit.belongsTo(Building, { foreignKey: 'buildingId', as: 'building' });
Building.hasMany(RealEstateUnit, { foreignKey: 'buildingId', as: 'units' });

// تعريف العلاقات للحجوزات
Reservation.belongsTo(User, { foreignKey: 'userId', as: 'user' });
User.hasMany(Reservation, { foreignKey: 'userId', as: 'reservations' });

Reservation.belongsTo(RealEstateUnit, { foreignKey: 'unitId', as: 'unit' });
RealEstateUnit.hasMany(Reservation, { foreignKey: 'unitId', as: 'reservations' });

// تعريف العلاقات لطلبات الخدمة
ServiceOrder.belongsTo(User, { foreignKey: 'userId', as: 'user' });
User.hasMany(ServiceOrder, { foreignKey: 'userId', as: 'serviceOrders' });

ServiceOrder.belongsTo(Reservation, { foreignKey: 'reservationId', as: 'reservation' });
Reservation.hasMany(ServiceOrder, { foreignKey: 'reservationId', as: 'serviceOrders' });

// تعريف العلاقات لتاريخ الدفعات
PaymentHistory.belongsTo(Reservation, { foreignKey: 'reservationId', as: 'reservation' });
Reservation.hasMany(PaymentHistory, { foreignKey: 'reservationId', as: 'payments' });

// تصدير النماذج المُعرفة العلاقات بينها
module.exports = {
  User,
  Company,
  Building,
  RealEstateUnit,
  Reservation,
  ServiceOrder,
  PaymentHistory
};