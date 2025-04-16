// إصلاح مشكلة العلاقات في نموذج PaymentHistory
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// تعريف النموذج بدون إضافة العلاقات
const PaymentHistory = sequelize.define('PaymentHistory', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  reservationId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Reservations', // استخدام اسم الجدول بدلاً من النموذج المستورد
      key: 'id'
    }
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  paymentDate: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  paymentMethod: {
    type: DataTypes.STRING(50)
  },
  checkImage: {
    type: DataTypes.STRING(255)
  },
  status: {
    type: DataTypes.ENUM('paid', 'pending', 'delayed', 'cancelled'),
    defaultValue: 'pending'
  },
  notes: {
    type: DataTypes.TEXT
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

// لن نقوم بتعريف العلاقات هنا
// سيتم تعريف العلاقات في ملف associations.js

module.exports = PaymentHistory;