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
    type: DataTypes.ENUM('apartment', 'villa', 'commercial'),
    allowNull: false
  },
  totalUnits: {
    type: DataTypes.INTEGER
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