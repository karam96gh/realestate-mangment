// Database initialization 
const sequelize = require('./database');
const User = require('../models/user.model');
const Company = require('../models/company.model');
const Building = require('../models/building.model');
const RealEstateUnit = require('../models/realEstateUnit.model');
const Reservation = require('../models/reservation.model');
const ServiceOrder = require('../models/serviceOrder.model');
const PaymentHistory = require('../models/paymentHistory.model');
const tenant = require('../models/tenant.model');

const bcrypt = require('bcryptjs');

// Initialize database and create tables
const initializeDatabase = async () => {
  try {
    // Sync all models with database
    await sequelize.sync({ force: true });
    console.log('Database synchronized successfully');
    
    // Create default admin user
 const adminUser=   await User.create({
      username: 'admin',
      password:'admin123' ,
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