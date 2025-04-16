// إصلاح مشكلة العلاقات في نموذج ServiceOrder
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// استخدام الاستيراد الحذر لتجنب المشاكل الدائرية
// تأكد من أن هذه النماذج موجودة ومعرفة بشكل صحيح
// نستورد هيكل النموذج فقط بدون العلاقات في هذه المرحلة
const ServiceOrder = sequelize.define('ServiceOrder', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Users', // استخدام اسم الجدول بدلاً من النموذج المستورد
      key: 'id'
    }
  },
  reservationId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Reservations', // استخدام اسم الجدول بدلاً من النموذج المستورد
      key: 'id'
    }
  },
  serviceType: {
    type: DataTypes.ENUM('financial', 'maintenance', 'administrative'),
    allowNull: false
  },
  serviceSubtype: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  attachmentFile: {
    type: DataTypes.STRING(255)
  },
  status: {
    type: DataTypes.ENUM('pending', 'in-progress', 'completed', 'rejected'),
    defaultValue: 'pending'
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

// سننقل تعريف العلاقات إلى ملف منفصل لتجنب مشاكل الاعتماد الدائري
// يتم تعريف العلاقات في ملف associations.js بعد تعريف جميع النماذج

module.exports = ServiceOrder;