// models/realEstateUnit.model.js - النسخة المحدثة مع إنشاء طلب صيانة

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
}, {
  hooks: {
    // ✅ إنشاء طلب صيانة عند تحديث حالة الوحدة إلى صيانة
    afterUpdate: async (unit, options) => {
      try {
        // التحقق من تغيير الحالة إلى maintenance
        if (unit.changed('status') && unit.status === 'maintenance') {
          console.log(`🔧 إنشاء طلب صيانة للوحدة ${unit.unitNumber}...`);
          
          // استيراد النماذج المطلوبة (تجنب المراجع الدائرية)
          const Reservation = require('./reservation.model');
          const ServiceOrder = require('./serviceOrder.model');
          
          // البحث عن الحجز النشط للوحدة
          const activeReservation = await Reservation.findOne({
            where: {
              unitId: unit.id,
              status: 'active'
            },
            transaction: options.transaction
          });
          
          if (!activeReservation) {
            console.log(`⚠️ لا يوجد حجز نشط للوحدة ${unit.unitNumber} - لا يمكن إنشاء طلب صيانة`);
            return;
          }
          
          // التحقق من عدم وجود طلب صيانة مفتوح بالفعل
          const existingMaintenanceOrder = await ServiceOrder.findOne({
            where: {
              reservationId: activeReservation.id,
              serviceType: 'maintenance',
              status: {
                [sequelize.Sequelize.Op.in]: ['pending', 'in-progress']
              }
            },
            transaction: options.transaction
          });
          
          if (existingMaintenanceOrder) {
            console.log(`⚠️ يوجد طلب صيانة مفتوح بالفعل للوحدة ${unit.unitNumber}`);
            return;
          }
          
          // إنشاء طلب صيانة جديد
          const maintenanceOrder = await ServiceOrder.create({
            userId: activeReservation.userId,
            reservationId: activeReservation.id,
            serviceType: 'maintenance',
            serviceSubtype: 'general_maintenance',
            description: `طلب صيانة تلقائي للوحدة ${unit.unitNumber} - تم تحديد حالة الوحدة إلى "تحت الصيانة"`,
            status: 'pending',
            serviceHistory: [{
              status: 'pending',
              date: new Date().toISOString(),
              changedBy: 'system',
              changedByRole: 'system',
              changedByName: 'النظام الآلي',
              note: 'طلب صيانة تلقائي عند تحديث حالة الوحدة'
            }]
          }, { transaction: options.transaction });
          
          console.log(`✅ تم إنشاء طلب صيانة ${maintenanceOrder.id} للوحدة ${unit.unitNumber}`);
          
          // تسجيل في الـ audit log إذا كان متاحاً
          try {
            const { auditLog } = require('../utils/logger');
            auditLog('AUTO_MAINTENANCE_ORDER_CREATED', 'system', {
              unitId: unit.id,
              unitNumber: unit.unitNumber,
              serviceOrderId: maintenanceOrder.id,
              reservationId: activeReservation.id,
              reason: 'Unit status changed to maintenance'
            });
          } catch (logError) {
            // تجاهل أخطاء التسجيل
            console.log('تحذير: فشل في تسجيل العملية في audit log');
          }
        }
      } catch (error) {
        console.error(`❌ خطأ في إنشاء طلب صيانة للوحدة ${unit.id}:`, error);
        // عدم رمي الخطأ لتجنب توقف العملية الأساسية
      }
    }
  }
});

// Define associations
RealEstateUnit.belongsTo(Building, { foreignKey: 'buildingId', as: 'building' });
Building.hasMany(RealEstateUnit, { foreignKey: 'buildingId', as: 'units' });

RealEstateUnit.belongsTo(User, { foreignKey: 'ownerId', as: 'owner' });
User.hasMany(RealEstateUnit, { foreignKey: 'ownerId', as: 'ownedUnits' });

module.exports = RealEstateUnit;