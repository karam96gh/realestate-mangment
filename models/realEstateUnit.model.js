const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Building = require('./building.model');
const User = require('./user.model');

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
  ownerId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: User,
      key: 'id'
    },
    comment: 'معرف مالك الوحدة'
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
    type: DataTypes.STRING(20),
    comment: 'الطابق - يمكن أن يحتوي على قيم مثل "الأرضي"، "الميزانين"، إلخ'
  },
  area: {
    type: DataTypes.DECIMAL(10, 2)
  },
  bathrooms: {
    type: DataTypes.INTEGER
  },
  // إضافة حقل رقم الموقف
  parkingNumber: {
    type: DataTypes.STRING(10),
    allowNull: true,
    comment: 'رقم الموقف المخصص للوحدة'
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

// Define associations
RealEstateUnit.belongsTo(Building, { foreignKey: 'buildingId', as: 'building' });
Building.hasMany(RealEstateUnit, { foreignKey: 'buildingId', as: 'units' });

RealEstateUnit.belongsTo(User, { foreignKey: 'ownerId', as: 'owner' });
User.hasMany(RealEstateUnit, { foreignKey: 'ownerId', as: 'ownedUnits' });

module.exports = RealEstateUnit;