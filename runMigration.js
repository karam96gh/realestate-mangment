// scripts/runMigration.js - نسخة مُصححة للـ MariaDB

const sequelize = require('./config/database');

const runExpenseSystemMigration = async () => {
  try {
    console.log('🚀 بدء تحديث نظام المصاريف...');
    
    // 1. تحديث جدول المصاريف (Expenses)
    console.log('📊 تحديث جدول المصاريف...');
    
    // إضافة عمود buildingId أولاً
    try {
      await sequelize.query(`
        ALTER TABLE Expenses 
        ADD COLUMN buildingId INT
      `);
      console.log('✅ تم إضافة عمود buildingId');
    } catch (error) {
      if (error.original?.errno === 1060) { // العمود موجود مسبقاً
        console.log('ℹ️ عمود buildingId موجود مسبقاً');
      } else {
        throw error;
      }
    }

    // إضافة القيد الخارجي لـ buildingId
    try {
      await sequelize.query(`
        ALTER TABLE Expenses 
        ADD CONSTRAINT fk_expense_building
        FOREIGN KEY (buildingId) REFERENCES Buildings(id) 
        ON DELETE CASCADE ON UPDATE CASCADE
      `);
      console.log('✅ تم إضافة القيد الخارجي لـ buildingId');
    } catch (error) {
      if (error.original?.errno === 1061) { // القيد موجود مسبقاً
        console.log('ℹ️ القيد الخارجي لـ buildingId موجود مسبقاً');
      } else {
        throw error;
      }
    }

    // تعديل عمود unitId ليصبح اختياري
    try {
      await sequelize.query(`
        ALTER TABLE Expenses 
        MODIFY COLUMN unitId INT NULL
      `);
      console.log('✅ تم تعديل عمود unitId ليصبح اختياري');
    } catch (error) {
      console.log('ℹ️ عمود unitId مُعدّل مسبقاً أو لا يحتاج تعديل');
    }

    // إضافة عمود serviceOrderId
    try {
      await sequelize.query(`
        ALTER TABLE Expenses 
        ADD COLUMN serviceOrderId INT
      `);
      console.log('✅ تم إضافة عمود serviceOrderId');
    } catch (error) {
      if (error.original?.errno === 1060) {
        console.log('ℹ️ عمود serviceOrderId موجود مسبقاً');
      } else {
        throw error;
      }
    }

    // إضافة القيد الخارجي لـ serviceOrderId
    try {
      await sequelize.query(`
        ALTER TABLE Expenses 
        ADD CONSTRAINT fk_expense_service_order
        FOREIGN KEY (serviceOrderId) REFERENCES ServiceOrders(id) 
        ON DELETE SET NULL ON UPDATE CASCADE
      `);
      console.log('✅ تم إضافة القيد الخارجي لـ serviceOrderId');
    } catch (error) {
      if (error.original?.errno === 1061) {
        console.log('ℹ️ القيد الخارجي لـ serviceOrderId موجود مسبقاً');
      } else {
        throw error;
      }
    }

    // إضافة عمود responsibleParty
    try {
      await sequelize.query(`
        ALTER TABLE Expenses 
        ADD COLUMN responsibleParty ENUM('owner', 'tenant')
      `);
      console.log('✅ تم إضافة عمود responsibleParty');
    } catch (error) {
      if (error.original?.errno === 1060) {
        console.log('ℹ️ عمود responsibleParty موجود مسبقاً');
      } else {
        throw error;
      }
    }

    // إضافة عمود attachmentFile
    try {
      await sequelize.query(`
        ALTER TABLE Expenses 
        ADD COLUMN attachmentFile VARCHAR(255)
      `);
      console.log('✅ تم إضافة عمود attachmentFile');
    } catch (error) {
      if (error.original?.errno === 1060) {
        console.log('ℹ️ عمود attachmentFile موجود مسبقاً');
      } else {
        throw error;
      }
    }

    // إضافة عمود attachmentDescription
    try {
      await sequelize.query(`
        ALTER TABLE Expenses 
        ADD COLUMN attachmentDescription VARCHAR(500)
      `);
      console.log('✅ تم إضافة عمود attachmentDescription');
    } catch (error) {
      if (error.original?.errno === 1060) {
        console.log('ℹ️ عمود attachmentDescription موجود مسبقاً');
      } else {
        throw error;
      }
    }

    // 2. تحديث البيانات الموجودة
    console.log('🔄 تحديث البيانات الموجودة...');
    
    // التحقق من وجود بيانات في الجدول
    const [existingExpenses] = await sequelize.query(`
      SELECT COUNT(*) as count FROM Expenses WHERE unitId IS NOT NULL
    `);
    
    if (existingExpenses[0].count > 0) {
      // نقل البيانات من unitId إلى buildingId
      const [updatedRows] = await sequelize.query(`
        UPDATE Expenses 
        SET buildingId = (
          SELECT buildingId 
          FROM RealEstateUnits 
          WHERE RealEstateUnits.id = Expenses.unitId
        )
        WHERE unitId IS NOT NULL AND buildingId IS NULL
      `);
      console.log(`✅ تم تحديث ${updatedRows.affectedRows} سجل بـ buildingId`);
    }

    // تعيين قيمة افتراضية لـ responsibleParty
    const [updatedParty] = await sequelize.query(`
      UPDATE Expenses 
      SET responsibleParty = 'owner' 
      WHERE responsibleParty IS NULL
    `);
    console.log(`✅ تم تحديث ${updatedParty.affectedRows} سجل بـ responsibleParty`);

    // جعل buildingId إجباري بعد تحديث البيانات
    try {
      await sequelize.query(`
        ALTER TABLE Expenses 
        MODIFY COLUMN buildingId INT NOT NULL
      `);
      console.log('✅ تم جعل buildingId إجباري');
    } catch (error) {
      console.log('⚠️ تعذر جعل buildingId إجباري، تحقق من البيانات');
    }

    // جعل responsibleParty إجباري
    try {
      await sequelize.query(`
        ALTER TABLE Expenses 
        MODIFY COLUMN responsibleParty ENUM('owner', 'tenant') NOT NULL
      `);
      console.log('✅ تم جعل responsibleParty إجباري');
    } catch (error) {
      console.log('⚠️ تعذر جعل responsibleParty إجباري، تحقق من البيانات');
    }

    // 3. تحديث جدول طلبات الخدمة (ServiceOrders)
    console.log('🛠️ تحديث جدول طلبات الخدمة...');

    // إضافة عمود servicePrice
    try {
      await sequelize.query(`
        ALTER TABLE ServiceOrders 
        ADD COLUMN servicePrice DECIMAL(10, 2)
      `);
      console.log('✅ تم إضافة عمود servicePrice');
    } catch (error) {
      if (error.original?.errno === 1060) {
        console.log('ℹ️ عمود servicePrice موجود مسبقاً');
      } else {
        throw error;
      }
    }

    // إضافة عمود completionAttachment
    try {
      await sequelize.query(`
        ALTER TABLE ServiceOrders 
        ADD COLUMN completionAttachment VARCHAR(255)
      `);
      console.log('✅ تم إضافة عمود completionAttachment');
    } catch (error) {
      if (error.original?.errno === 1060) {
        console.log('ℹ️ عمود completionAttachment موجود مسبقاً');
      } else {
        throw error;
      }
    }

    // إضافة عمود completionDescription
    try {
      await sequelize.query(`
        ALTER TABLE ServiceOrders 
        ADD COLUMN completionDescription TEXT
      `);
      console.log('✅ تم إضافة عمود completionDescription');
    } catch (error) {
      if (error.original?.errno === 1060) {
        console.log('ℹ️ عمود completionDescription موجود مسبقاً');
      } else {
        throw error;
      }
    }

    // إضافة عمود isExpenseCreated
    try {
      await sequelize.query(`
        ALTER TABLE ServiceOrders 
        ADD COLUMN isExpenseCreated BOOLEAN DEFAULT FALSE
      `);
      console.log('✅ تم إضافة عمود isExpenseCreated');
    } catch (error) {
      if (error.original?.errno === 1060) {
        console.log('ℹ️ عمود isExpenseCreated موجود مسبقاً');
      } else {
        throw error;
      }
    }

    // 4. إضافة الفهارس للأداء
    console.log('📈 إضافة الفهارس...');

    // فهرس buildingId
    try {
      await sequelize.query(`
        CREATE INDEX expenses_building_id_index ON Expenses(buildingId)
      `);
      console.log('✅ تم إضافة فهرس buildingId');
    } catch (error) {
      if (error.original?.errno === 1061) {
        console.log('ℹ️ فهرس buildingId موجود مسبقاً');
      } else {
        throw error;
      }
    }

    // فهرس responsibleParty
    try {
      await sequelize.query(`
        CREATE INDEX expenses_responsible_party_index ON Expenses(responsibleParty)
      `);
      console.log('✅ تم إضافة فهرس responsibleParty');
    } catch (error) {
      if (error.original?.errno === 1061) {
        console.log('ℹ️ فهرس responsibleParty موجود مسبقاً');
      } else {
        throw error;
      }
    }

    // فهرس serviceOrderId
    try {
      await sequelize.query(`
        CREATE INDEX expenses_service_order_id_index ON Expenses(serviceOrderId)
      `);
      console.log('✅ تم إضافة فهرس serviceOrderId');
    } catch (error) {
      if (error.original?.errno === 1061) {
        console.log('ℹ️ فهرس serviceOrderId موجود مسبقاً');
      } else {
        throw error;
      }
    }

    // فهرس isExpenseCreated
    try {
      await sequelize.query(`
        CREATE INDEX service_orders_is_expense_created_index ON ServiceOrders(isExpenseCreated)
      `);
      console.log('✅ تم إضافة فهرس isExpenseCreated');
    } catch (error) {
      if (error.original?.errno === 1061) {
        console.log('ℹ️ فهرس isExpenseCreated موجود مسبقاً');
      } else {
        throw error;
      }
    }

    // فهرس مركب للحالة والسعر
    try {
      await sequelize.query(`
        CREATE INDEX service_orders_status_price_index ON ServiceOrders(status, servicePrice)
      `);
      console.log('✅ تم إضافة فهرس status_price');
    } catch (error) {
      if (error.original?.errno === 1061) {
        console.log('ℹ️ فهرس status_price موجود مسبقاً');
      } else {
        throw error;
      }
    }

    // 5. التحقق من نجاح التحديث
    console.log('🔍 التحقق من نجاح التحديث...');

    const [expenseColumns] = await sequelize.query(`
      DESCRIBE Expenses
    `);

    const [serviceOrderColumns] = await sequelize.query(`
      DESCRIBE ServiceOrders
    `);

    console.log('✅ أعمدة جدول المصاريف الجديدة:');
    const newExpenseColumns = ['buildingId', 'serviceOrderId', 'responsibleParty', 'attachmentFile', 'attachmentDescription'];
    expenseColumns.forEach(col => {
      if (newExpenseColumns.includes(col.Field)) {
        console.log(`  - ${col.Field}: ${col.Type} ${col.Null === 'NO' ? '(إجباري)' : '(اختياري)'}`);
      }
    });

    console.log('✅ أعمدة جدول طلبات الخدمة الجديدة:');
    const newServiceColumns = ['servicePrice', 'completionAttachment', 'completionDescription', 'isExpenseCreated'];
    serviceOrderColumns.forEach(col => {
      if (newServiceColumns.includes(col.Field)) {
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
    if (error.original?.errno === 1060) {
      console.log('💡 العمود موجود مسبقاً، يمكن تجاهل هذا الخطأ');
    } else if (error.original?.errno === 1061) {
      console.log('💡 الفهرس أو القيد موجود مسبقاً، يمكن تجاهل هذا الخطأ');
    } else if (error.original?.errno === 1146) {
      console.log('💡 الجدول غير موجود، تحقق من أسماء الجداول');
    } else if (error.original?.errno === 1452) {
      console.log('💡 خطأ في القيد الخارجي، تحقق من البيانات المرجعية');
    }
    
    console.log('🔧 الحلول المقترحة:');
    console.log('   1. تحقق من وجود الجداول المرجعية (Buildings, ServiceOrders)');
    console.log('   2. تأكد من وجود بيانات صحيحة في الجداول');
    console.log('   3. قم بعمل backup للبيانات قبل إعادة التشغيل');
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