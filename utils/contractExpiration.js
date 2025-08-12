// utils/contractExpiration.js - نظام انتهاء العقود التلقائي

const { Op } = require('sequelize');
const Reservation = require('../models/reservation.model');
const RealEstateUnit = require('../models/realEstateUnit.model');
const User = require('../models/user.model');
const cron = require('node-cron');
const { auditLog } = require('./logger');

class ContractExpirationService {
  
  /**
   * فحص العقود المنتهية وتحديث حالة الوحدات
   */
  static async checkExpiredContracts() {
    try {
      console.log('🔍 بدء فحص العقود المنتهية...');
      
      const today = new Date().toISOString().split('T')[0];
      
      // البحث عن العقود المنتهية التي ما زالت نشطة
      const expiredReservations = await Reservation.findAll({
        where: {
          endDate: {
            [Op.lt]: today // تاريخ انتهاء أقل من اليوم
          },
          status: 'active' // ما زالت نشطة
        },
        include: [
          {
            model: RealEstateUnit,
            as: 'unit',
            attributes: ['id', 'unitNumber', 'status']
          },
          {
            model: User,
            as: 'user',
            attributes: ['id', 'fullName', 'email', 'phone']
          }
        ]
      });

      console.log(`📋 تم العثور على ${expiredReservations.length} عقد منتهي`);

      const results = {
        processed: 0,
        errors: 0,
        details: []
      };

      // معالجة كل عقد منتهي
      for (const reservation of expiredReservations) {
        try {
          await this.expireContract(reservation);
          results.processed++;
          results.details.push({
            reservationId: reservation.id,
            unitNumber: reservation.unit.unitNumber,
            tenantName: reservation.user.fullName,
            endDate: reservation.endDate,
            status: 'success'
          });
          
          console.log(`✅ تم انتهاء عقد الوحدة ${reservation.unit.unitNumber} للمستأجر ${reservation.user.fullName}`);
          
        } catch (error) {
          results.errors++;
          results.details.push({
            reservationId: reservation.id,
            unitNumber: reservation.unit?.unitNumber || 'غير معروف',
            error: error.message,
            status: 'error'
          });
          
          console.error(`❌ خطأ في معالجة العقد ${reservation.id}:`, error.message);
        }
      }

      // تسجيل النتائج في سجل التدقيق
      auditLog('CONTRACT_EXPIRATION_BATCH', 'system', {
        totalFound: expiredReservations.length,
        processed: results.processed,
        errors: results.errors,
        date: today
      });

      console.log(`📊 انتهت معالجة العقود: ${results.processed} نجحت، ${results.errors} فشلت`);
      
      return results;
      
    } catch (error) {
      console.error('❌ خطأ عام في فحص العقود المنتهية:', error);
      throw error;
    }
  }

  /**
   * انتهاء عقد واحد
   */
  static async expireContract(reservation) {
    const transaction = await reservation.sequelize.transaction();
    
    try {
      // تحديث حالة الحجز إلى منتهي
      await reservation.update({
        status: 'expired'
      }, { transaction });

      // تحديث حالة الوحدة إلى متاحة
      await RealEstateUnit.update(
        { status: 'available' },
        { 
          where: { id: reservation.unitId },
          transaction 
        }
      );

      await transaction.commit();

      // تسجيل العملية في سجل التدقيق
      auditLog('CONTRACT_EXPIRED', 'system', {
        reservationId: reservation.id,
        unitId: reservation.unitId,
        tenantId: reservation.userId,
        endDate: reservation.endDate,
        unitNumber: reservation.unit?.unitNumber
      });

    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * فحص العقود المنتهية خلال فترة معينة (للاختبار)
   */
  static async checkExpiredContractsInRange(startDate, endDate) {
    try {
      const expiredReservations = await Reservation.findAll({
        where: {
          endDate: {
            [Op.between]: [startDate, endDate]
          },
          status: 'active'
        },
        include: [
          {
            model: RealEstateUnit,
            as: 'unit',
            attributes: ['id', 'unitNumber', 'status']
          },
          {
            model: User,
            as: 'user',
            attributes: ['id', 'fullName', 'email', 'phone']
          }
        ]
      });

      return expiredReservations;
    } catch (error) {
      console.error('خطأ في فحص العقود المنتهية في النطاق المحدد:', error);
      throw error;
    }
  }

  /**
   * الحصول على العقود التي ستنتهي قريباً (للإشعارات)
   */
  static async getContractsExpiringIn(days = 30) {
    try {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + days);
      
      const expiringContracts = await Reservation.findAll({
        where: {
          endDate: {
            [Op.between]: [
              new Date().toISOString().split('T')[0],
              futureDate.toISOString().split('T')[0]
            ]
          },
          status: 'active'
        },
        include: [
          {
            model: RealEstateUnit,
            as: 'unit',
            attributes: ['id', 'unitNumber']
          },
          {
            model: User,
            as: 'user',
            attributes: ['id', 'fullName', 'email', 'phone']
          }
        ],
        order: [['endDate', 'ASC']]
      });

      return expiringContracts;
    } catch (error) {
      console.error('خطأ في الحصول على العقود المنتهية قريباً:', error);
      throw error;
    }
  }

  /**
   * معالجة يدوية لعقد واحد
   */
  static async manuallyExpireContract(reservationId, userId) {
    try {
      const reservation = await Reservation.findByPk(reservationId, {
        include: [
          {
            model: RealEstateUnit,
            as: 'unit'
          },
          {
            model: User,
            as: 'user'
          }
        ]
      });

      if (!reservation) {
        throw new Error('الحجز غير موجود');
      }

      if (reservation.status !== 'active') {
        throw new Error('العقد ليس نشطاً');
      }

      await this.expireContract(reservation);

      // تسجيل العملية اليدوية
      auditLog('CONTRACT_MANUALLY_EXPIRED', userId, {
        reservationId: reservation.id,
        unitId: reservation.unitId,
        tenantId: reservation.userId,
        endDate: reservation.endDate
      });

      return {
        success: true,
        message: `تم إنهاء عقد الوحدة ${reservation.unit.unitNumber} بنجاح`
      };

    } catch (error) {
      console.error('خطأ في الإنهاء اليدوي للعقد:', error);
      throw error;
    }
  }
}

// جدولة المهمة للتشغيل يومياً في الساعة 2:00 صباحاً
const scheduleContractExpiration = () => {
  // تشغيل كل يوم في الساعة 2:00 صباحاً
  cron.schedule('0 2 * * *', async () => {
    console.log('⏰ بدء المهمة المجدولة لفحص العقود المنتهية...');
    try {
      await ContractExpirationService.checkExpiredContracts();
    } catch (error) {
      console.error('❌ خطأ في المهمة المجدولة:', error);
    }
  });

  console.log('📅 تم جدولة مهمة فحص العقود المنتهية (يومياً الساعة 2:00 صباحاً)');
};

// تشغيل المهمة عند بدء التطبيق (اختياري)
const runOnStartup = async () => {
  console.log('🚀 تشغيل فحص العقود المنتهية عند بدء التطبيق...');
  try {
    await ContractExpirationService.checkExpiredContracts();
  } catch (error) {
    console.error('❌ خطأ في الفحص عند بدء التطبيق:', error);
  }
};

module.exports = {
  ContractExpirationService,
  scheduleContractExpiration,
  runOnStartup
};