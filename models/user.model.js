// models/user.model.js

const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');
const sequelize = require('../config/database');
const { getFileUrl } = require('../utils/filePath');

const User = sequelize.define('User', {
  // الحقول الموجودة مسبقًا
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  username: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true
  },
  password: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  fullName: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  email: {
    type: DataTypes.STRING(100),
    validate: { isEmail: true }
  },
  phone: {
    type: DataTypes.STRING(20)
  },
  identityImage: {
    type: DataTypes.STRING(255)
  },
  identityImageUrl: {
    type: DataTypes.VIRTUAL,
    get() {
      return this.identityImage ? getFileUrl(this.identityImage, 'identities') : null;
    }
  },
  commercialRegisterImage: {
    type: DataTypes.STRING(255)
  },
  commercialRegisterImageUrl: {
    type: DataTypes.VIRTUAL,
    get() {
      return this.commercialRegisterImage ? getFileUrl(this.commercialRegisterImage, 'identities') : null;
    }
  },
  role: {
    type: DataTypes.ENUM('admin', 'manager', 'tenant'),
    defaultValue: 'tenant'
  },
  companyId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'Companies',
      key: 'id'
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
}, {
  hooks: {
    beforeCreate: async (user) => {
      if (user.password) {
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(user.password, salt);
      }
    },
    beforeUpdate: async (user) => {
      if (user.changed('password')) {
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(user.password, salt);
      }
    }
  }
});

// دالة للتحقق من كلمة المرور
User.prototype.validatePassword = async function(password) {
  return await bcrypt.compare(password, this.password);
};

// طريقة لإرجاع كائن مستخدم آمن (بدون كلمة المرور)
User.prototype.toJSON = function() {
  const values = { ...this.get() };
  delete values.password;
  return values;
};

module.exports = User;