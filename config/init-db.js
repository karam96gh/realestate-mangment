// تحديث ملف config/init-db.js
const sequelize = require('./database');
const bcrypt = require('bcryptjs');

// استيراد العلاقات بين النماذج التي تتضمن جميع النماذج المعرفة
const {
  User,
  Company,
  Building,
  RealEstateUnit,
  Reservation,
  ServiceOrder,
  PaymentHistory
} = require('../models/associations');

// Initialize database and create tables
const initializeDatabase = async () => {
  try {
    // Sync all models with database
    await sequelize.sync({ force: true });
    console.log('Database synchronized successfully');
    
    // Create default admin user
    const adminUser = await User.create({
      username: 'admin',
      password: 'admin123',
      fullName: 'System Administrator',
      email: 'admin@example.com',
      role: 'admin'
    });
    
    const isValid = await adminUser.validatePassword('admin123');
    console.log('Password validation test:', isValid ? 'PASSED' : 'FAILED');
    
    console.log('Default admin user created');
    console.log('Username: admin');
    console.log('Password: admin123');
    
    console.log('Database initialization completed');
  } catch (error) {
    console.error('Error initializing database:', error);
  }
};

// Run the initialization if this script is run directly
if (require.main === module) {
  initializeDatabase();
}

module.exports = initializeDatabase;