// scripts/runMigration.js - تشغيل التحديثات على قاعدة البيانات

const sequelize = require('../config/database');

const runExpenseSystemMigration = async () => {
  try {
    console.log('🚀 بدء تحديث نظام المصاريف...');
    
    // 1. تحديث جدول المصاريف (Expenses)
    console.log('📊 تحديث جدول المصاريف...');
    
    // إضافة عمود buildingId
    await sequelize.query(`
      ALTER TABLE Expenses 
      ADD COLUMN IF NOT EXISTS buildingId INT,
      ADD CONSTRAINT IF NOT EXISTS fk_expense_building
      FOREIGN KEY (buildingId) REFERENCES Buildings(id) 
      ON DELETE CASCADE ON UPDATE CASCADE
    `);

    // تعديل عمود unitId ليصبح اختياري
    await sequelize.query(`
      ALTER TABLE Expenses 
      MODIFY COLUMN unitId INT NULL
    `);

    // إضافة عمود serviceOrderId
    await sequelize.query(`
      ALTER TABLE Expenses 
      ADD COLUMN IF NOT EXISTS serviceOrderId INT,
      ADD CONSTRAINT IF NOT EXISTS fk_expense_service_order
      FOREIGN KEY (serviceOrderId) REFERENCES ServiceOrders(id) 
      ON DELETE SET NULL ON UPDATE CASCADE
    `);

    // إضافة عمود responsibleParty
    await sequelize.query(`
      ALTER TABLE Expenses 
      ADD COLUMN IF NOT EXISTS responsibleParty ENUM('owner', 'tenant')
    `);

    // إضافة عمود attachmentFile
    await sequelize.query(`
      ALTER TABLE Expenses 
      ADD COLUMN IF NOT EXISTS attachmentFile VARCHAR(255)
    `);

    // إضافة عمود attachmentDescription
    await sequelize.query(`
      ALTER TABLE Expenses 
      ADD COLUMN IF NOT EXISTS attachmentDescription VARCHAR(500)
    `);

    // 2. تحديث البيانات الموجودة
    console.log('🔄 تحديث البيانات الموجودة...');
    
    // نقل البيانات من unitId إلى buildingId
    await sequelize.query(`
      UPDATE Expenses 
      SET buildingId = (
        SELECT buildingId 
        FROM RealEstateUnits 
        WHERE RealEstateUnits.id = Expenses.unitId
      )
      WHERE unitId IS NOT NULL AND buildingId IS NULL
    `);

    // تعيين قيمة افتراضية لـ responsibleParty
    await sequelize.query(`
      UPDATE Expenses 
      SET responsibleParty = 'owner' 
      WHERE responsibleParty IS NULL
    `);

    // جعل buildingId و responsibleParty إجبارية
    await sequelize.query(`
      ALTER TABLE Expenses 
      MODIFY COLUMN buildingId INT NOT NULL
    `);

    await sequelize.query(`
      ALTER TABLE Expenses 
      MODIFY COLUMN responsibleParty ENUM('owner', 'tenant') NOT NULL
    `);

    // 3. تحديث جدول طلبات الخدمة (ServiceOrders)
    console.log('🛠️ تحديث جدول طلبات الخدمة...');

    // إضافة عمود servicePrice
    await sequelize.query(`
      ALTER TABLE ServiceOrders 
      ADD COLUMN IF NOT EXISTS servicePrice DECIMAL(10, 2)
    `);

    // إضافة عمود completionAttachment
    await sequelize.query(`
      ALTER TABLE ServiceOrders 
      ADD COLUMN IF NOT EXISTS completionAttachment VARCHAR(255)
    `);

    // إضافة عمود completionDescription
    await sequelize.query(`
      ALTER TABLE ServiceOrders 
      ADD COLUMN IF NOT EXISTS completionDescription TEXT
    `);

    // إضافة عمود isExpenseCreated
    await sequelize.query(`
      ALTER TABLE ServiceOrders 
      ADD COLUMN IF NOT EXISTS isExpenseCreated BOOLEAN DEFAULT FALSE
    `);

    // 4. إضافة الفهارس للأداء
    console.log('📈 إضافة الفهارس...');

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS expenses_building_id_index ON Expenses(buildingId)
    `);

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS expenses_responsible_party_index ON Expenses(responsibleParty)
    `);

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS expenses_service_order_id_index ON Expenses(serviceOrderId)
    `);

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS service_orders_is_expense_created_index ON ServiceOrders(isExpenseCreated)
    `);

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS service_orders_status_price_index ON ServiceOrders(status, servicePrice)
    `);

    // 5. التحقق من نجاح التحديث
    console.log('🔍 التحقق من نجاح التحديث...');

    const [expenseColumns] = await sequelize.query(`
      DESCRIBE Expenses
    `);

    const [serviceOrderColumns] = await sequelize.query(`
      DESCRIBE ServiceOrders
    `);

    console.log('✅ أعمدة جدول المصاريف:');
    expenseColumns.forEach(col => {
      console.log(`  - ${col.Field}: ${col.Type} ${col.Null === 'NO' ? '(إجباري)' : '(اختياري)'}`);
    });

    console.log('✅ أعمدة جدول طلبات الخدمة:');
    serviceOrderColumns.forEach(col => {
      if (['servicePrice', 'completionAttachment', 'completionDescription', 'isExpenseCreated'].includes(col.Field)) {
        console.log(`  - ${col.Field}: ${col.Type} ${col.Null === 'NO' ? '(إجباري)' : '(اختياري)'}`);
      }
    });

    console.log('🎉 تم تحديث نظام المصاريف بنجاح!');
    console.log('📝 الميزات الجديدة:');
    console.log('   • ربط المصاريف بالمباني (إجباري) والوحدات (اختياري)');
    console.log('   • تحديد المسؤول عن الدفع (مالك أو مستأجر)');
    console.log('   • إضافة مرفقات للمصاريف');
    console.log('   • ربط المصاريف بطلبات الخدمة');
    console.log('   • سعر الخدمة ومرفقات الإكمال لطلبات الخدمة');
    
  } catch (error) {
    console.error('❌ خطأ في تحديث نظام المصاريف:', error);
    
    // معلومات إضافية للتشخيص
    if (error.message.includes('column')) {
      console.log('💡 قد يكون العمود موجود مسبقاً، تحقق من البيانات الحالية');
    }
    
    if (error.message.includes('foreign key')) {
      console.log('💡 تحقق من وجود الجداول المرجعية (Buildings, ServiceOrders)');
    }
  } finally {
    await sequelize.close();
    console.log('🔐 تم إغلاق الاتصال بقاعدة البيانات');
  }
};

// تشغيل المايجريشن
if (require.main === module) {
  runExpenseSystemMigration();
}

module.exports = runExpenseSystemMigration;