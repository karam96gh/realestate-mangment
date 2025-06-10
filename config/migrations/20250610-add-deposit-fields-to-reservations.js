// migrations/20250610-add-deposit-fields-to-reservations.js

'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // إضافة حقول التأمين الجديدة إلى جدول Reservations
    await queryInterface.addColumn('Reservations', 'depositPaymentMethod', {
      type: Sequelize.ENUM('cash', 'check'),
      allowNull: true,
      comment: 'طريقة دفع التأمين: نقدي أو شيك'
    });

    await queryInterface.addColumn('Reservations', 'depositCheckImage', {
      type: Sequelize.STRING(255),
      allowNull: true,
      comment: 'صورة شيك التأمين في حالة الدفع بالشيك'
    });

    await queryInterface.addColumn('Reservations', 'depositStatus', {
      type: Sequelize.ENUM('unpaid', 'paid', 'returned'),
      allowNull: true,
      defaultValue: 'unpaid',
      comment: 'حالة التأمين: غير مدفوع، مدفوع، مسترجع'
    });

    await queryInterface.addColumn('Reservations', 'depositPaidDate', {
      type: Sequelize.DATEONLY,
      allowNull: true,
      comment: 'تاريخ دفع التأمين'
    });

    await queryInterface.addColumn('Reservations', 'depositReturnedDate', {
      type: Sequelize.DATEONLY,
      allowNull: true,
      comment: 'تاريخ استرجاع التأمين'
    });

    await queryInterface.addColumn('Reservations', 'depositNotes', {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: 'ملاحظات خاصة بالتأمين'
    });

    // إضافة index للأداء على حالة التأمين
    await queryInterface.addIndex('Reservations', ['depositStatus'], {
      name: 'reservations_deposit_status_index'
    });

    console.log('تم إضافة حقول التأمين بنجاح إلى جدول Reservations');
  },

  async down(queryInterface, Sequelize) {
    // إزالة الـ index أولاً
    await queryInterface.removeIndex('Reservations', 'reservations_deposit_status_index');

    // ثم إزالة الأعمدة بالترتيب العكسي
    await queryInterface.removeColumn('Reservations', 'depositNotes');
    await queryInterface.removeColumn('Reservations', 'depositReturnedDate');
    await queryInterface.removeColumn('Reservations', 'depositPaidDate');
    await queryInterface.removeColumn('Reservations', 'depositStatus');
    await queryInterface.removeColumn('Reservations', 'depositCheckImage');
    await queryInterface.removeColumn('Reservations', 'depositPaymentMethod');

    console.log('تم حذف حقول التأمين من جدول Reservations');
  }
};