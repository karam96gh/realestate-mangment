// models/company.model.js

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./user.model');
const { getFileUrl } = require('../utils/filePath');

const Company = sequelize.define('Company', {
  // Existing fields
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  // ADD COMPANY TYPE FIELD
  companyType: {
    type: DataTypes.ENUM('owner', 'agency'),
    allowNull: false,
    defaultValue: 'agency',
    comment: 'نوع الشركة: مالك أو شركة عقارية'
  },
  email: {
    type: DataTypes.STRING(100),
    validate: { isEmail: true }
  },
  phone: {
    type: DataTypes.STRING(20)
  },
  address: {
    type: DataTypes.TEXT
  },
  logoImage: {
    type: DataTypes.STRING(255)
  },
  logoImageUrl: {
    type: DataTypes.VIRTUAL,
    get() {
      return this.logoImage ? getFileUrl(this.logoImage, 'logos') : null;
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

// Existing associations
Company.hasOne(User, {
  foreignKey: 'companyId',
  as: 'manager',
  scope: {
    role: 'manager'
  }
});

User.belongsTo(Company, {
  foreignKey: 'companyId',
  as: 'company'
});

module.exports = Company;