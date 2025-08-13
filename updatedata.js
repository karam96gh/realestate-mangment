// scripts/addUserStatusFields.js - سكريبت إضافة حقول حالة المستخدم

const sequelize = require('./config/database');

const addUserStatusFields = async () => {
  try {
    console.log('🔄 بدء إضافة حقول حالة المستخدم...');
    
    // إضافة حقل isActive
    await sequelize.query(`
      ALTER TABLE Users 
      ADD COLUMN IF NOT EXISTS isActive BOOLEAN DEFAULT TRUE 
      COMMENT 'حالة المستخدم - نشط أم معطل'
    `);
    console.log('✅ تم إضافة حقل isActive');
    
    // إضافة حقل deactivationReason
    await sequelize.query(`
      ALTER TABLE Users 
      ADD COLUMN IF NOT EXISTS deactivationReason TEXT 
      COMMENT 'سبب تعطيل الحساب'
    `);
    console.log('✅ تم إضافة حقل deactivationReason');
    
    // إضافة حقل deactivatedAt
    await sequelize.query(`
      ALTER TABLE Users 
      ADD COLUMN IF NOT EXISTS deactivatedAt DATETIME 
      COMMENT 'تاريخ تعطيل الحساب'
    `);
    console.log('✅ تم إضافة حقل deactivatedAt');
    
    // إضافة فهرس للبحث السريع في المستخدمين النشطين
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS users_is_active_index ON Users(isActive)
    `);
    console.log('✅ تم إضافة فهرس isActive');
    
    // تحديث جميع المستخدمين الحاليين ليكونوا نشطين
    const [results] = await sequelize.query(`
      UPDATE Users 
      SET isActive = TRUE 
      WHERE isActive IS NULL
    `);
    console.log(`✅ تم تحديث ${results.affectedRows || 0} مستخدم ليكون نشطًا`);
    
    // التحقق من النتائج
    const [userCount] = await sequelize.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN isActive = TRUE THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN isActive = FALSE THEN 1 ELSE 0 END) as inactive
      FROM Users
    `);
    
    console.log('📊 إحصائيات المستخدمين:');
    console.log(`   إجمالي المستخدمين: ${userCount[0].total}`);
    console.log(`   المستخدمون النشطون: ${userCount[0].active}`);
    console.log(`   المستخدمون المعطلون: ${userCount[0].inactive}`);
    
    // عرض هيكل الجدول المحدث
    const [tableStructure] = await sequelize.query('DESCRIBE Users');
    console.log('\n📋 هيكل جدول Users المحدث:');
    
    // البحث عن الحقول الجديدة فقط
    const newFields = tableStructure.filter(field => 
      ['isActive', 'deactivationReason', 'deactivatedAt'].includes(field.Field)
    );
    
    console.table(newFields);
    
    console.log('\n🎉 تم إضافة جميع حقول حالة المستخدم بنجاح!');
    
  } catch (error) {
    console.error('❌ خطأ في إضافة حقول حالة المستخدم:', error);
    console.error('تفاصيل الخطأ:', error.message);
    
    // معلومات إضافية للمساعدة في حل المشكلة
    if (error.message.includes('Duplicate column name')) {
      console.log('💡 يبدو أن الحقول موجودة مسبقًا. سيتم تجاهل هذا الخطأ.');
    } else if (error.message.includes('Table') && error.message.includes("doesn't exist")) {
      console.log('💡 تأكد من أن جدول Users موجود في قاعدة البيانات.');
    }
  } finally {
    await sequelize.close();
    console.log('🔐 تم إغلاق الاتصال بقاعدة البيانات');
  }
};

// تشغيل السكريبت
if (require.main === module) {
  addUserStatusFields();
}

module.exports = addUserStatusFields;