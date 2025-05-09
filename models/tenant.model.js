// models/tenant.model.js

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./user.model');

const Tenant = sequelize.define('Tenant', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  // ربط المستأجر بحساب المستخدم
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: true,
    references: {
      model: User,
      key: 'id'
    }
  },
  // نوع المستأجر (اتفاقية/شراكة، سجل تجاري، شخص، سفارة، شركة أجنبية، جهة حكومية، ورثة، سجل مدني)
  tenantType: {
    type: DataTypes.ENUM(
      'partnership', 
      'commercial_register', 
      'person', 
      'embassy', 
      'foreign_company', 
      'government', 
      'inheritance', 
      'civil_registry'
    ),
    allowNull: false,
    defaultValue: 'person'
  },
  // نوع النشاط التجاري (للشركات)
  businessActivities: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'قائمة بأرقام الأنشطة التجارية مفصولة بفواصل'
  },
  // معلومات المستأجر الإضافية
  contactPerson: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'الشخص المسؤول عن التواصل (للشركات والمؤسسات)'
  },
  contactPosition: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'المنصب الوظيفي لجهة الاتصال'
  },
  // معلومات إضافية
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  updatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
});

// إنشاء العلاقة بين المستأجر والمستخدم
Tenant.belongsTo(User, { foreignKey: 'userId', as: 'user' });
User.hasOne(Tenant, { foreignKey: 'userId', as: 'tenantInfo' });

module.exports = Tenant;