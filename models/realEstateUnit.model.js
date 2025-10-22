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
  // إضافة حقل عدد المواقف
  parkingNumber: {
    type: DataTypes.STRING(10),
    allowNull: true,
    comment: 'عدد المواقف الداخلية للوحدة'
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
}, // استبدل الـ hooks section في models/realEstateUnit.model.js

{
  hooks: {
    // ✅ إنشاء طلب صيانة عند تحديث حالة الوحدة إلى صيانة
    afterUpdate: async (unit, options) => {
      try {
        // التحقق من تغيير الحالة إلى maintenance
        if (unit.changed('status') && unit.status === 'maintenance') {
          console.log(`🔧 Hook: إنشاء طلب صيانة للوحدة ${unit.unitNumber}...`);

          // استيراد النماذج المطلوبة (تجنب المراجع الدائرية)
          const Reservation = require('./reservation.model');
          const ServiceOrder = require('./serviceOrder.model');

          // البحث عن الحجز النشط للوحدة (اختياري)
          const activeReservation = await Reservation.findOne({
            where: {
              unitId: unit.id,
              status: 'active'
            },
            transaction: options.transaction
          });

          // تحديد المستخدم والحجز (إذا كان موجوداً)
          const userId = activeReservation ? activeReservation.userId : (options.updatedBy || null);
          const reservationId = activeReservation ? activeReservation.id : null;

          // التحقق من عدم وجود طلب صيانة مفتوح بالفعل للوحدة
          const whereCondition = {
            serviceType: 'maintenance',
            status: {
              [sequelize.Sequelize.Op.in]: ['pending', 'in-progress']
            }
          };

          // البحث عن طلبات صيانة مفتوحة للوحدة (سواء مرتبطة بحجز أو مباشرة)
          if (reservationId) {
            whereCondition.reservationId = reservationId;
          } else {
            // البحث في الطلبات المرتبطة مباشرة بالوحدة أو عبر حجوزاتها
            const unitReservations = await Reservation.findAll({
              where: { unitId: unit.id },
              attributes: ['id'],
              transaction: options.transaction
            });

            if (unitReservations.length > 0) {
              whereCondition[sequelize.Sequelize.Op.or] = [
                { reservationId: { [sequelize.Sequelize.Op.in]: unitReservations.map(r => r.id) } },
                { unitId: unit.id }
              ];
            } else {
              whereCondition.unitId = unit.id;
            }
          }

          const existingMaintenanceOrder = await ServiceOrder.findOne({
            where: whereCondition,
            transaction: options.transaction
          });

          if (existingMaintenanceOrder) {
            console.log(`⚠️ Hook: يوجد طلب صيانة مفتوح بالفعل (${existingMaintenanceOrder.id}) للوحدة ${unit.unitNumber}`);
            return existingMaintenanceOrder;
          }

          // إنشاء طلب صيانة دورية جديد
          const orderData = {
            unitId: unit.id,  // ← إضافة معرف الوحدة
            serviceType: 'maintenance',
            serviceSubtype: 'periodic_maintenance',
            description: `صيانة دورية - طلب تلقائي للوحدة ${unit.unitNumber}`,
            status: 'pending',
            serviceHistory: [{
              status: 'pending',
              date: new Date().toISOString(),
              changedBy: options.updatedBy || 'system',  // ← استخدام updatedBy من options
              changedByRole: options.updatedBy ? 'manager' : 'system',
              changedByName: options.updatedBy ? 'المدير' : 'النظام الآلي',
              note: activeReservation
                ? 'طلب صيانة دورية تلقائي عند تحديث حالة الوحدة إلى صيانة'
                : 'طلب صيانة دورية تلقائي للوحدة غير المحجوزة'
            }]
          };

          // إضافة معلومات المستخدم والحجز إذا كانت متوفرة
          if (userId) orderData.userId = userId;
          if (reservationId) orderData.reservationId = reservationId;

          const maintenanceOrder = await ServiceOrder.create(orderData, { transaction: options.transaction });

          console.log(`✅ Hook: تم إنشاء طلب صيانة ${maintenanceOrder.id} للوحدة ${unit.unitNumber}`);

          // تسجيل في الـ audit log إذا كان متاحاً
          try {
            const { auditLog } = require('../utils/logger');
            auditLog('AUTO_MAINTENANCE_ORDER_CREATED', 'system', {
              unitId: unit.id,
              unitNumber: unit.unitNumber,
              serviceOrderId: maintenanceOrder.id,
              reservationId: reservationId,
              hasActiveReservation: !!activeReservation,
              reason: 'Unit status changed to maintenance',
              triggeredBy: 'afterUpdate hook'
            });
          } catch (logError) {
            // تجاهل أخطاء التسجيل
            console.log('تحذير Hook: فشل في تسجيل العملية في audit log');
          }

          return maintenanceOrder;
        }
      } catch (error) {
        console.error(`❌ Hook: خطأ في إنشاء طلب صيانة للوحدة ${unit.id}:`, error);
        // ✅ عدم رمي الخطأ لتجنب توقف العملية الأساسية
        // لكن نسجل الخطأ للمراجعة اللاحقة
        try {
          const { auditLog } = require('../utils/logger');
          auditLog('AUTO_MAINTENANCE_ORDER_FAILED', 'system', {
            unitId: unit.id,
            unitNumber: unit.unitNumber || 'unknown',
            error: error.message,
            reason: 'Hook execution failed'
          });
        } catch (logError) {
          // تجاهل حتى أخطاء التسجيل
        }
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