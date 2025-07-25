const User = require('../models/user.model');
const Company = require('../models/company.model'); // إضافة استيراد نموذج Company
const { catchAsync, AppError } = require('../utils/errorHandler');
const fs = require('fs');
const path = require('path');
const { UPLOAD_PATHS } = require('../config/upload');

// Get all users (admin only)
const { createUserWhereCondition } = require('../utils/userHelpers');

const getAllUsers = catchAsync(async (req, res, next) => {
  try {
    // إنشاء شرط البحث حسب دور المستخدم
    const whereCondition = await createUserWhereCondition(req.user);
    
    // جلب المستخدمين مع تضمين معلومات الشركة
    const users = await User.findAll({
      where: whereCondition,
      attributes: { exclude: ['password'] },
      include: [
        {
          model: Company,
          as: 'company',
          required: false
        }
      ],
    });
    
    res.status(200).json({
      status: 'success',
      results: users.length,
      data: users
    });
  } catch (error) {
    return next(new AppError(error.message, 403));
  }
});
// Get user by ID
// controllers/user.controller.js

// Get user by ID
const getUserById = catchAsync(async (req, res, next) => {
    // Admin can view any user, tenant can only view themselves
    if (req.user.role === 'tenant' && req.params.id != req.user.id) {
      return next(new AppError('You are not authorized to view this user', 403));
    }
    
    const user = await User.findByPk(req.params.id, {
      attributes: { exclude: ['password'] },
      include: req.user.role === 'manager' ? [{
        model: Company,
        as: 'company'
      }] : []
    });
    
    if (!user) {
      return next(new AppError('User not found', 404));
    }
    
    res.status(200).json({
      status: 'success',
      data: user
    });
  });

// Update user
const updateUser = catchAsync(async (req, res, next) => {
  // Admin can update any user, tenant can only update themselves
  if (req.user.role === 'tenant' && req.params.id != req.user.id) {
    return next(new AppError('You are not authorized to update this user', 403));
  }
  
  const user = await User.findByPk(req.params.id);
  
  if (!user) {
    return next(new AppError('User not found', 404));
  }
  
  const { fullName, email, phone } = req.body;
  
  // Only admin can update role
  const role = req.user.role === 'admin' ? req.body.role : user.role;
  
  // Handle identity image upload if provided
  let identityImage = user.identityImage;
  if (req.files && req.files.identityImage) {
    // Delete old identity image if it exists
    if (user.identityImage) {
      const oldIdentityPath = path.join(UPLOAD_PATHS.identities, user.identityImage);
      if (fs.existsSync(oldIdentityPath)) {
        fs.unlinkSync(oldIdentityPath);
      }
    }
    identityImage = req.files.identityImage[0].filename;
  }
  
  // Handle commercial register image upload if provided
  let commercialRegisterImage = user.commercialRegisterImage;
  if (req.files && req.files.commercialRegisterImage) {
    // Delete old commercial register image if it exists
    if (user.commercialRegisterImage) {
      const oldRegisterPath = path.join(UPLOAD_PATHS.identities, user.commercialRegisterImage);
      if (fs.existsSync(oldRegisterPath)) {
        fs.unlinkSync(oldRegisterPath);
      }
    }
    commercialRegisterImage = req.files.commercialRegisterImage[0].filename;
  }
  
  // Update user
  await user.update({
    fullName: fullName || user.fullName,
    email: email || user.email,
    phone: phone || user.phone,
    role,
    identityImage,
    commercialRegisterImage
  });
  
  // Remove password from response
  const userResponse = user.toJSON();
  
  res.status(200).json({
    status: 'success',
    data: userResponse
  });
});

// Delete user
const deleteUser = catchAsync(async (req, res, next) => {
  // Only admin can delete users
  if (req.user.role !== 'admin'&&req.user.role !== 'manager') {
    return next(new AppError('You are not authorized to delete users', 403));
  }
  
  const user = await User.findByPk(req.params.id);
  
  if (!user) {
    return next(new AppError('User not found', 404));
  }
  
  // Delete identity image if it exists
  if (user.identityImage) {
    const identityPath = path.join(UPLOAD_PATHS.identities, user.identityImage);
    if (fs.existsSync(identityPath)) {
      fs.unlinkSync(identityPath);
    }
  }
  
  // Delete commercial register image if it exists
  if (user.commercialRegisterImage) {
    const registerPath = path.join(UPLOAD_PATHS.identities, user.commercialRegisterImage);
    if (fs.existsSync(registerPath)) {
      fs.unlinkSync(registerPath);
    }
  }
  
  await user.destroy();
  
  res.status(204).json({
    status: 'success',
    data: null
  });
});

module.exports = {
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser
};