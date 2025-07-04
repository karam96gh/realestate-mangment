// Server entry point 
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const companyRoutes = require('./routes/company.routes');
const buildingRoutes = require('./routes/building.routes');
const realEstateUnitRoutes = require('./routes/realEstateUnit.routes');
const reservationRoutes = require('./routes/reservation.routes');
const serviceOrderRoutes = require('./routes/serviceOrder.routes');
const paymentHistoryRoutes = require('./routes/paymentHistory.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const tenantRoutes = require('./routes/tenant.routes');
const ownerReportRoutes = require('./routes/ownerReport.routes');

const expenseRoutes = require('./routes/expense.routes');


// Import error handler
const { errorHandler } = require('./utils/errorHandler');

// Initialize database connection
require('./config/database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Serve static files
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/buildings', buildingRoutes);
app.use('/api/units', realEstateUnitRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/services', serviceOrderRoutes);
app.use('/api/payments', paymentHistoryRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/owner-reports', ownerReportRoutes);
// تسجيل المسارات في التطبيق
app.use('/api/tenants', tenantRoutes);
// Default route
app.use('/api/expenses', expenseRoutes);

app.get('/', (req, res) => {
  res.json({ message: 'Welcome to Real Estate Management API' });
});

// Error handling middleware
app.use(errorHandler);

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = app; // For testing purposes