// models/paymentHistory.model.js

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Reservation = require('./reservation.model');
const { getFileUrl } = require('../utils/filePath');

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
      model: Reservation,
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
  checkImageUrl: {
    type: DataTypes.VIRTUAL,
    get() {
      return this.checkImage ? getFileUrl(this.checkImage, 'checks') : null;
    }
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

// تعريف العلاقة
PaymentHistory.belongsTo(Reservation, { foreignKey: 'reservationId', as: 'reservation' });
Reservation.hasMany(PaymentHistory, { foreignKey: 'reservationId', as: 'payments' });

module.exports = PaymentHistory;