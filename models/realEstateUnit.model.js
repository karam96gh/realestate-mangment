// Real Estate Unit model 
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Building = require('./building.model');

const RealEstateUnit = sequelize.define('RealEstateUnit', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  buildingId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Building,
      key: 'id'
    }
  },
  unitNumber: {
    type: DataTypes.STRING(20),
    allowNull: false
  },
  unitType: {
    type: DataTypes.ENUM('studio', 'apartment', 'shop', 'office', 'villa', 'room'),
    allowNull: false,
    comment: 'نوع الوحدة (ستديو/شقة/محل/مكتب/فيلا/غرفة)'
  },
  unitLayout: {
    type: DataTypes.ENUM('studio', '1bhk', '2bhk', '3bhk', '4bhk', '5bhk', '6bhk', '7bhk', 'other'),
    allowNull: true,
    comment: 'تخطيط الوحدة (عدد الغرف والمطابخ والحمامات)'
  },
  floor: {
    type: DataTypes.INTEGER
  },
  area: {
    type: DataTypes.DECIMAL(10, 2)
  },
  bedrooms: {
    type: DataTypes.INTEGER
  },
  bathrooms: {
    type: DataTypes.INTEGER
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('available', 'rented', 'maintenance'),
    defaultValue: 'available'
  },
  description: {
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

// Define association
RealEstateUnit.belongsTo(Building, { foreignKey: 'buildingId', as: 'building' });
Building.hasMany(RealEstateUnit, { foreignKey: 'buildingId', as: 'units' });

module.exports = RealEstateUnit;