// Auth controller 
const User = require('../models/user.model');
const Company = require('../models/company.model');

const { generateToken } = require('../config/auth');
const { catchAsync, AppError } = require('../utils/errorHandler');
// controllers/auth.controller.js

// Add this function to your existing controller
const resetManagerPassword = catchAsync(async (req, res, next) => {
    // Only allow admin to reset passwords
    if (req.user.role !== 'admin') {
      return next(new AppError('Not authorized to reset manager passwords', 403));
    }
    
    const { managerId, newPassword } = req.body;
    
    // Find the manager user
    const manager = await User.findOne({ 
      where: { 
        id: managerId,
        role: 'manager' 
      } 
    });
    
    if (!manager) {
      return next(new AppError('Manager not found', 404));
    }
    
    // Update password
    manager.password = newPassword;
    await manager.save();
    
    res.status(200).json({
      status: 'success',
      message: 'Manager password has been reset successfully'
    });
  });
  

// Login controller
const login = catchAsync(async (req, res, next) => {
  const { username, password } = req.body;
  
  // Find user by username
  const user = await User.findOne({ where: { username } });
  

  // Check if user exists and password is correct
  if (!user || !(await user.validatePassword(password))) {
    return next(new AppError('Invalid username or password', 401));
  }
  
  // Generate JWT token
  const token = generateToken(user.id, user.role);
  
  // Send response
  res.status(200).json({
    status: 'success',
    data: {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      token
    }
  });
});

// Register admin user
const registerAdmin = catchAsync(async (req, res, next) => {
  // Only allow creation of admin accounts by system admins
  if (req.user && req.user.role !== 'admin') {
    return next(new AppError('Not authorized to create admin accounts', 403));
  }
  
  const { username, password, fullName, email, phone } = req.body;
  
  // Check if username already exists
  const existingUser = await User.findOne({ where: { username } });
  if (existingUser) {
    return next(new AppError('Username already exists', 400));
  }
  
  // Create new admin user
  const newUser = await User.create({
    username,
    password,
    fullName,
    email,
    phone,
    role: 'admin'
  });
  
  // Send response (without password)
  res.status(201).json({
    status: 'success',
    data: {
      id: newUser.id,
      username: newUser.username,
      fullName: newUser.fullName,
      email: newUser.email,
      role: newUser.role
    }
  });
});

// Register manager user
const registerManager = catchAsync(async (req, res, next) => {
  // Only allow creation of manager accounts by admins
  if (req.user && req.user.role !== 'admin') {
    return next(new AppError('Not authorized to create manager accounts', 403));
  }
  
  const { username, password, fullName, email, phone } = req.body;
  
  // Check if username already exists
  const existingUser = await User.findOne({ where: { username } });
  if (existingUser) {
    return next(new AppError('Username already exists', 400));
  }
  
  // Create new manager user
  const newUser = await User.create({
    username,
    password,
    fullName,
    email,
    phone,
    role: 'manager'
  });
  
  // Send response (without password)
  res.status(201).json({
    status: 'success',
    data: {
      id: newUser.id,
      username: newUser.username,
      fullName: newUser.fullName,
      email: newUser.email,
      role: newUser.role
    }
  });
});
const registerMaintenance = async (req, res) => {
  try {
    const { username, password, fullName, email, phone, whatsappNumber, idNumber } = req.body;
    const companyId=req.user.companyId;
    // التحقق من أن companyId مقدم وصالح
    if (!companyId) {
      return res.status(400).json({ message: 'معرف الشركة مطلوب' });
    }
    
    // التحقق من وجود الشركة
    const company = await Company.findByPk(companyId);
    if (!company) {
      return res.status(404).json({ message: 'الشركة غير موجودة' });
    }
    
    // التأكد من أن المدير ينتمي إلى نفس الشركة (إذا كان الطلب من مدير)
    if (req.user.role === 'manager' && req.user.companyId !== companyId) {
      return res.status(403).json({ message: 'غير مصرح لك بإنشاء عامل صيانة لهذه الشركة' });
    }
    
    const user = await User.create({
      username,
      password,
      fullName,
      email,
      phone,
      whatsappNumber,
      idNumber,
      role: 'maintenance',
      companyId
    });
    
    return res.status(201).json({ message: 'تم إنشاء عامل الصيانة بنجاح', user: user.toJSON() });
  } catch (error) {
    return res.status(500).json({ message: 'خطأ في إنشاء عامل الصيانة', error: error.message });
  }
};
const registerAccountant = async (req, res) => {
  try {
    const { username, password, fullName, email, phone, whatsappNumber, idNumber } = req.body;
    const companyId=req.user.companyId;    
    // التحقق من أن companyId مقدم وصالح
    if (!companyId) {
      return res.status(400).json({ message: 'معرف الشركة مطلوب' });
    }
    
    // التحقق من وجود الشركة
    const company = await Company.findByPk(companyId);
    if (!company) {
      return res.status(404).json({ message: 'الشركة غير موجودة' });
    }
    
    // التأكد من أن المدير أو المسؤول ينتمي إلى نفس الشركة (إذا كان الطلب من مدير)
    if (req.user.role === 'manager' && req.user.companyId !== companyId) {
      return res.status(403).json({ message: 'غير مصرح لك بإنشاء محاسب لهذه الشركة' });
    }
    
    const user = await User.create({
      username,
      password,
      fullName,
      email,
      phone,
      whatsappNumber,
      idNumber,
      role: 'accountant',
      companyId
    });
    
    return res.status(201).json({ message: 'تم إنشاء المحاسب بنجاح', user: user.toJSON() });
  } catch (error) {
    return res.status(500).json({ message: 'خطأ في إنشاء المحاسب', error: error.message });
  }
};
const registerOwner = async (req, res) => {
  try {
    const { username, password, fullName, email, phone, whatsappNumber, idNumber } = req.body;
    const companyId=req.user.companyId;    
    // التحقق من أن companyId مقدم وصالح
    if (!companyId) {
      return res.status(400).json({ message: 'معرف الشركة مطلوب' });
    }
    
    // التحقق من وجود الشركة
    const company = await Company.findByPk(companyId);
    if (!company) {
      return res.status(404).json({ message: 'الشركة غير موجودة' });
    }
    
    // التأكد من أن المدير ينتمي إلى نفس الشركة (إذا كان الطلب من مدير)
    if (req.user.role === 'manager' && req.user.companyId !== companyId) {
      return res.status(403).json({ message: 'غير مصرح لك بإنشاء مالك عقار لهذه الشركة' });
    }
    
    const user = await User.create({
      username,
      password,
      fullName,
      email,
      phone,
      whatsappNumber,
      idNumber,
      role: 'owner',
      companyId
    });
    
    return res.status(201).json({ message: 'تم إنشاء مالك العقار بنجاح', user: user.toJSON() });
  } catch (error) {
    return res.status(500).json({ message: 'خطأ في إنشاء مالك العقار', error: error.message });
  }
};
// Change password
const changePassword = catchAsync(async (req, res, next) => {
  const { currentPassword, newPassword } = req.body;
  
  // Get user from database
  const user = await User.findByPk(req.user.id);
  
  // Check if user exists and current password is correct
  if (!user || !(await user.validatePassword(currentPassword))) {
    return next(new AppError('Current password is incorrect', 401));
  }
  
  // Update password
  user.password = newPassword;
  user.copassword=newPassword;
  await user.save();
  
  res.status(200).json({
    status: 'success',
    message: 'Password updated successfully'
  });
});

// Get current user profile
const getMe = catchAsync(async (req, res, next) => {
  const user = await User.findByPk(req.user.id, {
    attributes: { exclude: ['password'] }
  });
  
  if (!user) {
    return next(new AppError('User not found', 404));
  }
  
  res.status(200).json({
    status: 'success',
    data: user
  });
});

module.exports = {
  login,
  registerAdmin,
  registerManager,
  changePassword,
  getMe,
  resetManagerPassword,
  registerAccountant,
  registerMaintenance,
  registerOwner
};