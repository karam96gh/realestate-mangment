// models/reservation.model.js

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./user.model');
const RealEstateUnit = require('./realEstateUnit.model');
const { getFileUrl } = require('../utils/filePath');

const Reservation = sequelize.define('Reservation', {
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
  unitId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: RealEstateUnit,
      key: 'id'
    }
  },
  startDate: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  endDate: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  contractImage: {
    type: DataTypes.STRING(255)
  },
  contractImageUrl: {
    type: DataTypes.VIRTUAL,
    get() {
      if (!this.contractImage) return null;
      return `${process.env.BASE_URL || 'http://localhost:3000'}/uploads/contracts/${this.contractImage}`;
    }
  },
  status: {
    type: DataTypes.ENUM('active', 'expired', 'cancelled'),
    defaultValue: 'active'
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

// تعريف العلاقات
Reservation.belongsTo(User, { foreignKey: 'userId', as: 'user' });
User.hasMany(Reservation, { foreignKey: 'userId', as: 'reservations' });

Reservation.belongsTo(RealEstateUnit, { foreignKey: 'unitId', as: 'unit' });
RealEstateUnit.hasMany(Reservation, { foreignKey: 'unitId', as: 'reservations' });

module.exports = Reservation;