// models/serviceOrder.model.js - النسخة المحدثة

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./user.model');
const Reservation = require('./reservation.model');
const { getFileUrl } = require('../utils/filePath');

const ServiceOrder = sequelize.define('ServiceOrder', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: User,
      key: 'id'
    },
    comment: 'معرف المستخدم - اختياري للطلبات التلقائية'
  },
  reservationId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: Reservation,
      key: 'id'
    },
    comment: 'معرف الحجز - اختياري للطلبات التلقائية للوحدات غير المحجوزة'
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
  attachmentFileUrl: {
    type: DataTypes.VIRTUAL,
    get() {
      return this.attachmentFile ? getFileUrl(this.attachmentFile, 'attachments') : null;
    }
  },
  status: {
    type: DataTypes.ENUM('pending', 'in-progress', 'completed', 'rejected'),
    defaultValue: 'pending'
  },
  // سعر الخدمة (يُملأ عند الإكمال أو الإلغاء)
  servicePrice: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    comment: 'سعر الخدمة عند الإكمال'
  },
  // مرفق الإكمال/الإلغاء
  completionAttachment: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'مرفق الإكمال أو الإلغاء'
  },
  completionAttachmentUrl: {
    type: DataTypes.VIRTUAL,
    get() {
      return this.completionAttachment ? getFileUrl(this.completionAttachment, 'attachments') : null;
    }
  },
  // وصف مرفق الإكمال
  completionDescription: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'وصف مرفق الإكمال أو الإلغاء'
  },
  // هل تم إنشاء مصروف من هذا الطلب
  isExpenseCreated: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'هل تم إنشاء مصروف من هذا الطلب'
  },
  serviceHistory: {
    type: DataTypes.JSON,
    defaultValue: [],
    get() {
      const rawValue = this.getDataValue('serviceHistory');
      if (!rawValue) return [];
      if (typeof rawValue === 'string') {
        try {
          return JSON.parse(rawValue);
        } catch (e) {
          return [];
        }
      }
      return Array.isArray(rawValue) ? rawValue : [];
    }
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
ServiceOrder.belongsTo(User, { foreignKey: 'userId', as: 'user' });
User.hasMany(ServiceOrder, { foreignKey: 'userId', as: 'serviceOrders' });

ServiceOrder.belongsTo(Reservation, { foreignKey: 'reservationId', as: 'reservation' });
Reservation.hasMany(ServiceOrder, { foreignKey: 'reservationId', as: 'serviceOrders' });

module.exports = ServiceOrder;