// runExpenseMigration.js
const sequelize = require('./config/database');

const runExpenseMigration = async () => {
  try {
    console.log('🚀 بدء إنشاء جدول المصاريف...');
    
    // إنشاء جدول المصاريف
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS Expenses (
        id INT AUTO_INCREMENT PRIMARY KEY,
        unitId INT NOT NULL,
        expenseType ENUM(
          'maintenance', 
          'utilities', 
          'insurance', 
          'cleaning', 
          'security', 
          'management', 
          'repairs', 
          'other'
        ) NOT NULL COMMENT 'نوع المصروف',
        amount DECIMAL(10, 2) NOT NULL COMMENT 'قيمة المصروف',
        expenseDate DATE NOT NULL COMMENT 'تاريخ المصروف',
        notes TEXT COMMENT 'ملاحظات',
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_expense_unit 
          FOREIGN KEY (unitId) REFERENCES RealEstateUnits(id) 
          ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log('✅ تم إنشاء جدول المصاريف بنجاح');

    // إضافة الفهارس للأداء
    console.log('📊 إضافة الفهارس...');
    
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS expenses_unit_id_index ON Expenses(unitId);
    `);
    
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS expenses_expense_date_index ON Expenses(expenseDate);
    `);
    
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS expenses_expense_type_index ON Expenses(expenseType);
    `);

    console.log('✅ تم إضافة جميع الفهارس بنجاح');

    // التحقق من إنشاء الجدول
    const [results] = await sequelize.query(`
      SELECT COUNT(*) as tableExists 
      FROM information_schema.tables 
      WHERE table_schema = DATABASE() 
      AND table_name = 'Expenses'
    `);

    if (results[0].tableExists > 0) {
      console.log('🎉 تم إنشاء جدول المصاريف بنجاح وهو جاهز للاستخدام!');
      
      // عرض هيكل الجدول
      const [tableStructure] = await sequelize.query('DESCRIBE Expenses');
      console.log('📋 هيكل جدول المصاريف:');
      console.table(tableStructure);
      
    } else {
      console.log('❌ فشل في إنشاء الجدول');
    }

  } catch (error) {
    console.error('❌ خطأ في إنشاء جدول المصاريف:', error.message);
    
    // إذا كان الخطأ متعلق بالجدول المرجعي
    if (error.message.includes('RealEstateUnits')) {
      console.log('💡 تأكد من وجود جدول RealEstateUnits أولاً');
    }
  } finally {
    await sequelize.close();
    console.log('🔐 تم إغلاق الاتصال بقاعدة البيانات');
  }
};

// تشغيل Migration
runExpenseMigration();