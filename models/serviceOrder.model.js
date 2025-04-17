// models/serviceOrder.model.js

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
    allowNull: false,
    references: {
      model: User,
      key: 'id'
    }
  },
  reservationId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Reservation,
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