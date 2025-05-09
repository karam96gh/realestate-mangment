// Building model 
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Company = require('./company.model');

const Building = sequelize.define('Building', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  buildingNumber: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: 'رقم المبنى الخارجي'
  },
  companyId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Company,
      key: 'id'
    }
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  address: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  buildingType: {
    type: DataTypes.ENUM('residential', 'commercial', 'mixed'),
    allowNull: false,
    comment: 'سكني/تجاري/سكني-تجاري'
  },
  totalUnits: {
    type: DataTypes.INTEGER
  },
  totalFloors: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
    comment: 'عدد الطوابق في المبنى'
  },
  internalParkingSpaces: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    comment: 'عدد المواقف الداخلية'
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
Building.belongsTo(Company, { foreignKey: 'companyId', as: 'company' });
Company.hasMany(Building, { foreignKey: 'companyId', as: 'buildings' });

module.exports = Building;