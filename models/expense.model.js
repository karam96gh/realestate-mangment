// models/expense.model.js - النسخة المحدثة

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Building = require('./building.model');
const RealEstateUnit = require('./realEstateUnit.model');
const ServiceOrder = require('./serviceOrder.model');
const { getFileUrl } = require('../utils/filePath');

const Expense = sequelize.define('Expense', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  // المبنى (إجباري)
  buildingId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Building,
      key: 'id'
    },
    comment: 'معرف المبنى (إجباري)'
  },
  // الوحدة (اختياري)
  unitId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: RealEstateUnit,
      key: 'id'
    },
    comment: 'معرف الوحدة (اختياري)'
  },
  // طلب الخدمة المرتبط (اختياري)
  serviceOrderId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: ServiceOrder,
      key: 'id'
    },
    comment: 'معرف طلب الخدمة المرتبط (اختياري)'
  },
  expenseType: {
    type: DataTypes.ENUM(
      'maintenance',        // صيانة
      'utilities',          // خدمات (كهرباء، ماء، إنترنت)
      'insurance',          // تأمين
      'cleaning',           // تنظيف
      'security',           // أمن
      'management',         // إدارة
      'repairs',            // إصلاحات
      'other'               // أخرى
    ),
    allowNull: false,
    comment: 'نوع المصروف'
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    comment: 'قيمة المصروف'
  },
  expenseDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    comment: 'تاريخ المصروف'
  },
  // من يجب عليه الدفع
  responsibleParty: {
    type: DataTypes.ENUM('owner', 'tenant'),
    allowNull: false,
    comment: 'من يجب عليه الدفع: المالك أو المستأجر'
  },
  // المرفق
  attachmentFile: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'ملف مرفق'
  },
  attachmentFileUrl: {
    type: DataTypes.VIRTUAL,
    get() {
      return this.attachmentFile ? getFileUrl(this.attachmentFile, 'attachments') : null;
    }
  },
  // وصف المرفق
  attachmentDescription: {
    type: DataTypes.STRING(500),
    allowNull: true,
    comment: 'وصف المرفق'
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'ملاحظات'
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

// تعريف العلاقات
Expense.belongsTo(Building, { foreignKey: 'buildingId', as: 'building' });
Building.hasMany(Expense, { foreignKey: 'buildingId', as: 'expenses' });

Expense.belongsTo(RealEstateUnit, { foreignKey: 'unitId', as: 'unit' });
RealEstateUnit.hasMany(Expense, { foreignKey: 'unitId', as: 'expenses' });

Expense.belongsTo(ServiceOrder, { foreignKey: 'serviceOrderId', as: 'serviceOrder' });
ServiceOrder.hasOne(Expense, { foreignKey: 'serviceOrderId', as: 'expense' });

module.exports = Expense;