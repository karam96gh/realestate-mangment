// models/company.model.js

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./user.model');
const { getFileUrl } = require('../utils/filePath');

const Company = sequelize.define('Company', {
  // الحقول الحالية
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
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
  
  // الحقول الجديدة المطلوبة
  whatsappNumber: {
    type: DataTypes.STRING(20),
    comment: 'رقم الواتساب للشركة'
  },
  secondaryPhone: {
    type: DataTypes.STRING(20),
    comment: 'رقم الهاتف الثاني للشركة'
  },
  identityImageFront: {
    type: DataTypes.STRING(255),
    comment: 'صورة البطاقة الشخصية الأمامية'
  },
  identityImageFrontUrl: {
    type: DataTypes.VIRTUAL,
    get() {
      return this.identityImageFront ? getFileUrl(this.identityImageFront, 'identities') : null;
    }
  },
  identityImageBack: {
    type: DataTypes.STRING(255),
    comment: 'صورة البطاقة الشخصية الخلفية'
  },
  identityImageBackUrl: {
    type: DataTypes.VIRTUAL,
    get() {
      return this.identityImageBack ? getFileUrl(this.identityImageBack, 'identities') : null;
    }
  },
  registrationNumber: {
    type: DataTypes.STRING(50),
    comment: 'رقم السجل التجاري'
  },
  delegateName: {
    type: DataTypes.STRING(100),
    comment: 'اسم المفوض'
  },
  
  // الحقول الحالية
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

// العلاقات الحالية
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