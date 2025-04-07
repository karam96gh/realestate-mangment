// config/add-companyId-migration.js
const sequelize = require('./database');

const migrateAddCompanyId = async () => {
  try {
    // Add companyId column to Users table if it doesn't exist
    await sequelize.query(`
      ALTER TABLE Users 
      ADD COLUMN IF NOT EXISTS companyId INT,
      ADD CONSTRAINT fk_users_company
      FOREIGN KEY (companyId) REFERENCES Companies(id)
      ON DELETE SET NULL;
    `);
    
    console.log('Migration completed: Added companyId to Users table');
  } catch (error) {
    console.error('Migration failed:', error);
  }
};

// Run the migration if called directly
if (require.main === module) {
  migrateAddCompanyId();
}

module.exports = migrateAddCompanyId;