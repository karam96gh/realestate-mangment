// migrations/update-expense-and-service-order.js

'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    console.log('🔄 بدء تحديث جداول المصاريف وطلبات الخدمة...');

    // 1. تحديث جدول المصاريف (Expenses)
    console.log('📊 تحديث جدول المصاريف...');
    
    // إضافة عمود buildingId
    await queryInterface.addColumn('Expenses', 'buildingId', {
      type: Sequelize.INTEGER,
      allowNull: true, // مؤقتاً للبيانات الموجودة
      references: {
        model: 'Buildings',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
      comment: 'معرف المبنى (إجباري)'
    });

    // تعديل عمود unitId ليصبح اختياري
    await queryInterface.changeColumn('Expenses', 'unitId', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'RealEstateUnits',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
      comment: 'معرف الوحدة (اختياري)'
    });

    // إضافة عمود serviceOrderId
    await queryInterface.addColumn('Expenses', 'serviceOrderId', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'ServiceOrders',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
      comment: 'معرف طلب الخدمة المرتبط'
    });

    // إضافة عمود responsibleParty
    await queryInterface.addColumn('Expenses', 'responsibleParty', {
      type: Sequelize.ENUM('owner', 'tenant'),
      allowNull: true, // مؤقتاً للبيانات الموجودة
      comment: 'من يجب عليه الدفع: المالك أو المستأجر'
    });

    // إضافة عمود attachmentFile
    await queryInterface.addColumn('Expenses', 'attachmentFile', {
      type: Sequelize.STRING(255),
      allowNull: true,
      comment: 'ملف مرفق'
    });

    // إضافة عمود attachmentDescription
    await queryInterface.addColumn('Expenses', 'attachmentDescription', {
      type: Sequelize.STRING(500),
      allowNull: true,
      comment: 'وصف المرفق'
    });

    // 2. تحديث البيانات الموجودة
    console.log('🔄 تحديث البيانات الموجودة...');
    
    // نقل البيانات من unitId إلى buildingId
    await queryInterface.sequelize.query(`
      UPDATE Expenses 
      SET buildingId = (
        SELECT buildingId 
        FROM RealEstateUnits 
        WHERE RealEstateUnits.id = Expenses.unitId
      )
      WHERE unitId IS NOT NULL
    `);

    // تعيين قيمة افتراضية لـ responsibleParty
    await queryInterface.sequelize.query(`
      UPDATE Expenses 
      SET responsibleParty = 'owner' 
      WHERE responsibleParty IS NULL
    `);

    // جعل buildingId و responsibleParty إجبارية بعد تحديث البيانات
    await queryInterface.changeColumn('Expenses', 'buildingId', {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: 'Buildings',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    });

    await queryInterface.changeColumn('Expenses', 'responsibleParty', {
      type: Sequelize.ENUM('owner', 'tenant'),
      allowNull: false
    });

    // 3. تحديث جدول طلبات الخدمة (ServiceOrders)
    console.log('🛠️ تحديث جدول طلبات الخدمة...');

    // إضافة عمود servicePrice
    await queryInterface.addColumn('ServiceOrders', 'servicePrice', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
      comment: 'سعر الخدمة عند الإكمال'
    });

    // إضافة عمود completionAttachment
    await queryInterface.addColumn('ServiceOrders', 'completionAttachment', {
      type: Sequelize.STRING(255),
      allowNull: true,
      comment: 'مرفق الإكمال أو الإلغاء'
    });

    // إضافة عمود completionDescription
    await queryInterface.addColumn('ServiceOrders', 'completionDescription', {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: 'وصف مرفق الإكمال أو الإلغاء'
    });

    // إضافة عمود isExpenseCreated
    await queryInterface.addColumn('ServiceOrders', 'isExpenseCreated', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      comment: 'هل تم إنشاء مصروف من هذا الطلب'
    });

    // 4. إضافة الفهارس للأداء
    console.log('📈 إضافة الفهارس...');

    await queryInterface.addIndex('Expenses', ['buildingId'], {
      name: 'expenses_building_id_index'
    });

    await queryInterface.addIndex('Expenses', ['responsibleParty'], {
      name: 'expenses_responsible_party_index'
    });

    await queryInterface.addIndex('Expenses', ['serviceOrderId'], {
      name: 'expenses_service_order_id_index'
    });

    await queryInterface.addIndex('ServiceOrders', ['isExpenseCreated'], {
      name: 'service_orders_is_expense_created_index'
    });

    console.log('✅ تم تحديث الجداول بنجاح');
  },

  async down(queryInterface, Sequelize) {
    console.log('🔄 إلغاء تحديث الجداول...');

    // إزالة الفهارس
    await queryInterface.removeIndex('Expenses', 'expenses_building_id_index');
    await queryInterface.removeIndex('Expenses', 'expenses_responsible_party_index');
    await queryInterface.removeIndex('Expenses', 'expenses_service_order_id_index');
    await queryInterface.removeIndex('ServiceOrders', 'service_orders_is_expense_created_index');

    // إزالة الأعمدة من ServiceOrders
    await queryInterface.removeColumn('ServiceOrders', 'servicePrice');
    await queryInterface.removeColumn('ServiceOrders', 'completionAttachment');
    await queryInterface.removeColumn('ServiceOrders', 'completionDescription');
    await queryInterface.removeColumn('ServiceOrders', 'isExpenseCreated');

    // إزالة الأعمدة من Expenses
    await queryInterface.removeColumn('Expenses', 'attachmentDescription');
    await queryInterface.removeColumn('Expenses', 'attachmentFile');
    await queryInterface.removeColumn('Expenses', 'responsibleParty');
    await queryInterface.removeColumn('Expenses', 'serviceOrderId');
    await queryInterface.removeColumn('Expenses', 'buildingId');

    // إعادة unitId إلى كونه إجباري
    await queryInterface.changeColumn('Expenses', 'unitId', {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: 'RealEstateUnits',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    });

    console.log('✅ تم إلغاء التحديث بنجاح');
  }
};