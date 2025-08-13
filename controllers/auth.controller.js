// controllers/auth.controller.js - تحديث دالة تسجيل الدخول للتحقق من حالة المستخدم

const User = require('../models/user.model');
const Company = require('../models/company.model');
const { generateToken } = require('../config/auth');
const { catchAsync, AppError } = require('../utils/errorHandler');

// ✅ تحديث دالة تسجيل الدخول مع التحقق من حالة المستخدم
const login = catchAsync(async (req, res, next) => {
  const { username, password } = req.body;
  
  // العثور على المستخدم بواسطة اسم المستخدم
  const user = await User.findOne({ where: { username } });
  
  // التحقق من وجود المستخدم وصحة كلمة المرور
  if (!user || !(await user.validatePassword(password))) {
    return next(new AppError('اسم المستخدم أو كلمة المرور غير صحيحة', 401));
  }
  
  // ✅ التحقق من حالة المستخدم (نشط أم معطل)
  if (!user.isActive) {
    const reason = user.deactivationReason || 'تم تعطيل الحساب';
    const deactivatedDate = user.deactivatedAt ? 
      new Date(user.deactivatedAt).toLocaleDateString('ar-SA') : '';
    
    return next(new AppError(
      `تم تعطيل حسابك. السبب: ${reason}${deactivatedDate ? ` - تاريخ التعطيل: ${deactivatedDate}` : ''}. يرجى التواصل مع الإدارة.`, 
      403
    ));
  }
  
  // إنشاء رمز JWT
  const token = generateToken(user.id, user.role);
  
  // إرسال الاستجابة
  res.status(200).json({
    status: 'success',
    data: {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      token
    }
  });
});

// ✅ دالة جديدة لتعطيل المستخدم (للمديرين والمسؤولين)
const deactivateUser = catchAsync(async (req, res, next) => {
  // فقط المسؤولون والمديرون يمكنهم تعطيل المستخدمين
  if (!['admin', 'manager'].includes(req.user.role)) {
    return next(new AppError('غير مصرح لك بتعطيل المستخدمين', 403));
  }
  
  const { userId, reason } = req.body;
  
  if (!userId) {
    return next(new AppError('معرف المستخدم مطلوب', 400));
  }
  
  const user = await User.findByPk(userId);
  
  if (!user) {
    return next(new AppError('المستخدم غير موجود', 404));
  }
  
  // منع تعطيل المسؤولين والمديرين (اختياري)
  if (['admin', 'manager'].includes(user.role) && req.user.role !== 'admin') {
    return next(new AppError('لا يمكن تعطيل حسابات المسؤولين أو المديرين', 403));
  }
  
  // تعطيل المستخدم
  await user.deactivate(reason || 'تم التعطيل من قبل الإدارة');
  
  res.status(200).json({
    status: 'success',
    message: 'تم تعطيل المستخدم بنجاح',
    data: {
      userId: user.id,
      username: user.username,
      fullName: user.fullName,
      isActive: user.isActive,
      deactivationReason: user.deactivationReason,
      deactivatedAt: user.deactivatedAt
    }
  });
});

// ✅ دالة جديدة لتفعيل المستخدم
const activateUser = catchAsync(async (req, res, next) => {
  // فقط المسؤولون والمديرون يمكنهم تفعيل المستخدمين
  if (!['admin', 'manager'].includes(req.user.role)) {
    return next(new AppError('غير مصرح لك بتفعيل المستخدمين', 403));
  }
  
  const { userId } = req.body;
  
  if (!userId) {
    return next(new AppError('معرف المستخدم مطلوب', 400));
  }
  
  const user = await User.findByPk(userId);
  
  if (!user) {
    return next(new AppError('المستخدم غير موجود', 404));
  }
  
  // تفعيل المستخدم
  await user.activate();
  
  res.status(200).json({
    status: 'success',
    message: 'تم تفعيل المستخدم بنجاح',
    data: {
      userId: user.id,
      username: user.username,
      fullName: user.fullName,
      isActive: user.isActive
    }
  });
});

// ✅ دالة للحصول على المستخدمين المعطلين
const getDeactivatedUsers = catchAsync(async (req, res, next) => {
  // فقط المسؤولون والمديرون يمكنهم عرض المستخدمين المعطلين
  if (!['admin', 'manager'].includes(req.user.role)) {
    return next(new AppError('غير مصرح لك بعرض المستخدمين المعطلين', 403));
  }
  
  let whereCondition = { isActive: false };
  
  // المدير يرى فقط المستخدمين المعطلين من شركته
  if (req.user.role === 'manager') {
    // يمكن إضافة شروط أخرى حسب الحاجة
    whereCondition.companyId = req.user.companyId;
  }
  
  const deactivatedUsers = await User.findAll({
    where: whereCondition,
    attributes: ['id', 'username', 'fullName', 'email', 'role', 'isActive', 'deactivationReason', 'deactivatedAt'],
    order: [['deactivatedAt', 'DESC']]
  });
  
  res.status(200).json({
    status: 'success',
    results: deactivatedUsers.length,
    data: deactivatedUsers
  });
});

// الدوال الموجودة مسبقاً...
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
    const companyId = req.user.companyId;
    
    // التحقق من أن companyId مقدم وصالح
    if (!companyId) {
      return res.status(400).json({ message: 'معرف الشركة مطلوب' });
    }
    
    // التحقق من وجود الشركة
    const company = await Company.findByPk(companyId);
    if (!company) {
      return res.status(404).json({ message: 'الشركة غير موجودة' });
    }
    
    // التأكد من أن المدير ينتمي إلى نفس الشركة
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
    const companyId = req.user.companyId;
    
    // التحقق من أن companyId مقدم وصالح
    if (!companyId) {
      return res.status(400).json({ message: 'معرف الشركة مطلوب' });
    }
    
    // التحقق من وجود الشركة
    const company = await Company.findByPk(companyId);
    if (!company) {
      return res.status(404).json({ message: 'الشركة غير موجودة' });
    }
    
    // التأكد من أن المدير أو المسؤول ينتمي إلى نفس الشركة
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
    const companyId = req.user.companyId;
    
    // التحقق من أن companyId مقدم وصالح
    if (!companyId) {
      return res.status(400).json({ message: 'معرف الشركة مطلوب' });
    }
    
    // التحقق من وجود الشركة
    const company = await Company.findByPk(companyId);
    if (!company) {
      return res.status(404).json({ message: 'الشركة غير موجودة' });
    }
    
    // التأكد من أن المدير ينتمي إلى نفس الشركة
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
  user.copassword = newPassword;
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
  registerOwner,
  // ✅ إضافة الدوال الجديدة
  deactivateUser,
  activateUser,
  getDeactivatedUsers
};