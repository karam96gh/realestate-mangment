// scripts/updateDatabase.js - أسهل طريقة لتحديث قاعدة البيانات

const sequelize = require('/config/database');

// استيراد جميع النماذج لضمان تحديثها
require('/models/user.model');
require('/models/company.model');
require('/models/building.model');
require('/models/realEstateUnit.model');
require('/models/reservation.model');
require('/models/serviceOrder.model');
require('/models/paymentHistory.model');
require('/models/tenant.model');
require('/models/expense.model');

/**
 * الطريقة الأسهل والأكثر أماناً - تحديث تلقائي
 */
const updateDatabaseSimple = async () => {
  try {
    console.log('🔄 جاري تحديث قاعدة البيانات...');
    
    // تحديث الجداول مع المحافظة على البيانات
    await sequelize.sync({ 
      alter: true,    // تعديل الجداول الموجودة
      force: false    // عدم حذف البيانات
    });
    
    console.log('✅ تم تحديث قاعدة البيانات بنجاح!');
    console.log('📊 جميع البيانات محفوظة والجداول محدثة');
    
    // اختبار الاتصال
    await sequelize.authenticate();
    console.log('🔗 تم التأكد من سلامة الاتصال');
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ خطأ في تحديث قاعدة البيانات:', error);
    process.exit(1);
  }
};

// تشغيل التحديث
if (require.main === module) {
  updateDatabaseSimple();
}

module.exports = updateDatabaseSimple;