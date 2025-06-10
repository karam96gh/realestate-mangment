// models/reservation.model.js - النسخة المحدثة مع حقول التأمين

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
  // المستأجر (مرتبط بجدول المستخدمين)
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: User,
      key: 'id'
    }
  },
  // الوحدة العقارية
  unitId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: RealEstateUnit,
      key: 'id'
    }
  },
  // نوع العقد (سكني - تجاري)
  contractType: {
    type: DataTypes.ENUM('residential', 'commercial'),
    allowNull: false,
    defaultValue: 'residential'
  },
  // تاريخ بداية العقد
  startDate: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  // تاريخ نهاية العقد
  endDate: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  // مدة العقد (تُحسب تلقائيًا)
  contractDuration: {
    type: DataTypes.VIRTUAL,
    get() {
      if (!this.startDate || !this.endDate) return null;
      
      const start = new Date(this.startDate);
      const end = new Date(this.endDate);
      
      const yearDiff = end.getFullYear() - start.getFullYear();
      const monthDiff = end.getMonth() - start.getMonth();
      
      const totalMonths = (yearDiff * 12) + monthDiff;
      
      // تنسيق العرض: سنوات وشهور
      const years = Math.floor(totalMonths / 12);
      const months = totalMonths % 12;
      
      if (years > 0 && months > 0) {
        return `${years} سنة و ${months} شهر`;
      } else if (years > 0) {
        return `${years} سنة`;
      } else {
        return `${months} شهر`;
      }
    }
  },
  // صورة العقد
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
  // ملف العقد PDF
  contractPdf: {
    type: DataTypes.STRING(255)
  },
  contractPdfUrl: {
    type: DataTypes.VIRTUAL,
    get() {
      if (!this.contractPdf) return null;
      return `${process.env.BASE_URL || 'http://localhost:3000'}/uploads/contracts/${this.contractPdf}`;
    }
  },
  // طريقة الدفع (كاش - شيكات)
  paymentMethod: {
    type: DataTypes.ENUM('cash', 'checks'),
    defaultValue: 'cash'
  },
  // آلية الدفع (شهري، ربع سنوي، إلخ)
  paymentSchedule: {
    type: DataTypes.ENUM('monthly', 'quarterly', 'triannual', 'biannual', 'annual'),
    defaultValue: 'monthly',
    comment: 'شهري، 4 دفعات، 3 دفعات، دفعتين، أو سنوي'
  },
  
  // ===== حقول التأمين المحدثة =====
  // هل يشمل الضمان؟
  includesDeposit: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  // قيمة الضمان
  depositAmount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true
  },
  // طريقة دفع التأمين
  depositPaymentMethod: {
    type: DataTypes.ENUM('cash', 'check'),
    allowNull: true,
    comment: 'طريقة دفع التأمين: نقدي أو شيك'
  },
  // صورة شيك التأمين
  depositCheckImage: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'صورة شيك التأمين في حالة الدفع بالشيك'
  },
  depositCheckImageUrl: {
    type: DataTypes.VIRTUAL,
    get() {
      return `${process.env.BASE_URL || 'http://localhost:3000'}/uploads/checks/${this.depositCheckImage}`;
    }
  },
  // حالة التأمين
  depositStatus: {
    type: DataTypes.ENUM('unpaid', 'paid', 'returned'),
    allowNull: true,
    defaultValue: 'unpaid',
    comment: 'حالة التأمين: غير مدفوع، مدفوع، مسترجع'
  },
  // تاريخ دفع التأمين
  depositPaidDate: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    comment: 'تاريخ دفع التأمين'
  },
  // تاريخ استرجاع التأمين
  depositReturnedDate: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    comment: 'تاريخ استرجاع التأمين'
  },
  // ملاحظات التأمين
  depositNotes: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'ملاحظات خاصة بالتأمين'
  },
  
  // حالة الحجز
  status: {
    type: DataTypes.ENUM('active', 'expired', 'cancelled'),
    defaultValue: 'active'
  },
  // ملاحظات
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