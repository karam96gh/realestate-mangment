// migrations/20250610-create-expenses-table.js

'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Expenses', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      unitId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'RealEstateUnits',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        comment: 'معرف الوحدة العقارية'
      },
      expenseType: {
        type: Sequelize.ENUM(
          'maintenance',    // صيانة
          'utilities',      // خدمات
          'insurance',      // تأمين
          'cleaning',       // تنظيف
          'security',       // أمن
          'management',     // إدارة
          'repairs',        // إصلاحات
          'other'           // أخرى
        ),
        allowNull: false,
        comment: 'نوع المصروف'
      },
      amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        comment: 'قيمة المصروف'
      },
      expenseDate: {
        type: Sequelize.DATEONLY,
        allowNull: false,
        comment: 'تاريخ المصروف'
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'ملاحظات'
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      }
    });

    // إضافة فهرس للأداء
    await queryInterface.addIndex('Expenses', ['unitId'], {
      name: 'expenses_unit_id_index'
    });

    await queryInterface.addIndex('Expenses', ['expenseDate'], {
      name: 'expenses_expense_date_index'
    });

    await queryInterface.addIndex('Expenses', ['expenseType'], {
      name: 'expenses_expense_type_index'
    });

    console.log('تم إنشاء جدول المصاريف بنجاح');
  },

  async down(queryInterface, Sequelize) {
    // إزالة الفهارس أولاً
    await queryInterface.removeIndex('Expenses', 'expenses_unit_id_index');
    await queryInterface.removeIndex('Expenses', 'expenses_expense_date_index');
    await queryInterface.removeIndex('Expenses', 'expenses_expense_type_index');

    // ثم حذف الجدول
    await queryInterface.dropTable('Expenses');

    console.log('تم حذف جدول المصاريف');
  }
};