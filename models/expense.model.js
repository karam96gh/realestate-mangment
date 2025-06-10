// models/expense.model.js

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const RealEstateUnit = require('./realEstateUnit.model');

const Expense = sequelize.define('Expense', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  unitId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: RealEstateUnit,
      key: 'id'
    }
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
Expense.belongsTo(RealEstateUnit, { foreignKey: 'unitId', as: 'unit' });
RealEstateUnit.hasMany(Expense, { foreignKey: 'unitId', as: 'expenses' });

module.exports = Expense;