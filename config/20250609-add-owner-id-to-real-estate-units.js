// migrations/20250609-add-owner-id-to-real-estate-units.js

'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('RealEstateUnits', 'ownerId', {
      type: Sequelize.INTEGER,
      allowNull: true, // نجعلها nullable في البداية للبيانات الموجودة
      references: {
        model: 'Users',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
      comment: 'معرف مالك الوحدة'
    });

    // إضافة index للأداء
    await queryInterface.addIndex('RealEstateUnits', ['ownerId'], {
      name: 'real_estate_units_owner_id_index'
    });
  },

  async down(queryInterface, Sequelize) {
    // إزالة الـ index أولاً
    await queryInterface.removeIndex('RealEstateUnits', 'real_estate_units_owner_id_index');
    
    // ثم إزالة العمود
    await queryInterface.removeColumn('RealEstateUnits', 'ownerId');
  }
};