const Company = require('../models/company.model');
const User = require('../models/user.model');
const { catchAsync, AppError } = require('../utils/errorHandler');
const fs = require('fs');
const path = require('path');
const { UPLOAD_PATHS } = require('../config/upload');
const generatePassword = require('../utils/generatePassword');
const sequelize = require('../config/database');

// Get all companies
const getAllCompanies = catchAsync(async (req, res) => {
  const companies = await Company.findAll();
  
  res.status(200).json({
    status: 'success',
    results: companies.length,
    data: companies
  });
});

// Get company by ID
// Get company by ID
const getCompanyById = catchAsync(async (req, res, next) => {
    const includeManager = req.query.includeManager === 'true';
    
    const company = await Company.findByPk(req.params.id, {
      include: includeManager ? [{
        model: User,
        as: 'manager',
        attributes: { exclude: ['password'] }
      }] : []
    });
    
    if (!company) {
      return next(new AppError('Company not found', 404));
    }
    
    res.status(200).json({
      status: 'success',
      data: company
    });
  });

// controllers/company.controller.js - فقط الجزء الذي يحتاج تعديل

// تحديث دالة createCompany لاستخدام المسارات الصحيحة وإعادة روابط الملفات
const createCompany = catchAsync(async (req, res) => {
  const { name, email, phone, address, managerFullName, managerEmail, managerPhone } = req.body;
  
  // معالجة رفع الشعار إذا تم توفيره
  let logoImage = null;
  if (req.file) {
    logoImage = req.file.filename;
  }

  // إنشاء الشركة أولاً
  const newCompany = await Company.create({
    name,
    email,
    phone,
    address,
    logoImage
  });

  // إنشاء بيانات اعتماد المدير
  const username = `manager_${newCompany.id}_${Date.now()}`;
  const password = generatePassword(10);

  // إنشاء مستخدم مدير مع معرف الشركة
  const manager = await User.create({
    username,
    password,
    fullName: managerFullName || `${name} Manager`,
    email: managerEmail || email,
    phone: managerPhone || phone,
    role: 'manager',
    companyId: newCompany.id  // تعيين معرف الشركة
  });

  // إرجاع معلومات الشركة والمدير
  res.status(201).json({
    status: 'success',
    data: {
      company: newCompany,  // سيتضمن logoImageUrl بفضل getter المضاف
      manager: {
        id: manager.id,
        username: manager.username,
        password: password, // يتم إرسالها مرة واحدة فقط عند الإنشاء
        fullName: manager.fullName,
        email: manager.email,
        role: manager.role,
        companyId: manager.companyId
      }
    }
  });
});
// Update company
const updateCompany = catchAsync(async (req, res, next) => {
  const company = await Company.findByPk(req.params.id);
  
  if (!company) {
    return next(new AppError('Company not found', 404));
  }
  
  const { name, email, phone, address } = req.body;
  
  // Handle logo upload if provided
  let logoImage = company.logoImage;
  if (req.file) {
    // Delete old logo if it exists
    if (company.logoImage) {
      const oldLogoPath = path.join(UPLOAD_PATHS.logos, company.logoImage);
      if (fs.existsSync(oldLogoPath)) {
        fs.unlinkSync(oldLogoPath);
      }
    }
    logoImage = req.file.filename;
  }
  
  // Update company
  await company.update({
    name: name || company.name,
    email: email || company.email,
    phone: phone || company.phone,
    address: address || company.address,
    logoImage
  });
  
  res.status(200).json({
    status: 'success',
    data: company
  });
});

// Delete company
const deleteCompany = catchAsync(async (req, res, next) => {
  const company = await Company.findByPk(req.params.id);
  
  if (!company) {
    return next(new AppError('Company not found', 404));
  }
  
  // Delete logo if it exists
  if (company.logoImage) {
    const logoPath = path.join(UPLOAD_PATHS.logos, company.logoImage);
    if (fs.existsSync(logoPath)) {
      fs.unlinkSync(logoPath);
    }
  }
  
  await company.destroy();
  
  res.status(204).json({
    status: 'success',
    data: null
  });
});

module.exports = {
  getAllCompanies,
  getCompanyById,
  createCompany,
  updateCompany,
  deleteCompany
};