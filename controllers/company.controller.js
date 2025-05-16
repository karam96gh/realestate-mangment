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
// Updated Company Controller functions
// تعديل دالة createCompany في controllers/company.controller.js

const createCompany = catchAsync(async (req, res) => {
  const { 
    name, 
    email, 
    phone,
    whatsappNumber,
    secondaryPhone,
    registrationNumber,
    delegateName,
    address, 
    companyType, 
    managerFullName, 
    managerEmail, 
    managerPhone 
  } = req.body;
  
  // معالجة الملفات المرفقة
  let logoImage = null;
  let identityImageFront = null;
  let identityImageBack = null;

  if (req.files) {
    if (req.files.logoImage && req.files.logoImage.length > 0) {
      logoImage = req.files.logoImage[0].filename;
    }
    
    if (req.files.identityImageFront && req.files.identityImageFront.length > 0) {
      identityImageFront = req.files.identityImageFront[0].filename;
    }
    
    if (req.files.identityImageBack && req.files.identityImageBack.length > 0) {
      identityImageBack = req.files.identityImageBack[0].filename;
    }
  }

  // إنشاء الشركة مع الحقول الجديدة
  const newCompany = await Company.create({
    name,
    email,
    phone,
    whatsappNumber,
    secondaryPhone,
    registrationNumber,
    delegateName,
    address,
    companyType: companyType || 'agency',
    logoImage,
    identityImageFront,
    identityImageBack
  });

  // إنشاء بيانات اعتماد المدير
  const username = `manager_${newCompany.id}_${Date.now()}`;
  const password = generatePassword(10);

  // إنشاء مستخدم مدير مرتبط بالشركة
  const manager = await User.create({
    username,
    password,
    fullName: managerFullName || `${name} Manager`,
    email: managerEmail || email,
    phone: managerPhone || phone,
    role: 'manager',
    companyId: newCompany.id
  });

  // إرجاع بيانات الشركة والمدير
  res.status(201).json({
    status: 'success',
    data: {
      company: newCompany,
      manager: {
        id: manager.id,
        username: manager.username,
        password: password, // ترسل مرة واحدة فقط عند الإنشاء
        fullName: manager.fullName,
        email: manager.email,
        role: manager.role,
        companyId: manager.companyId
      }
    }
  });
});

// تعديل دالة updateCompany
const updateCompany = catchAsync(async (req, res, next) => {
  const company = await Company.findByPk(req.params.id);
  
  if (!company) {
    return next(new AppError('الشركة غير موجودة', 404));
  }
  
  const { 
    name, 
    email, 
    phone,
    whatsappNumber,
    secondaryPhone,
    registrationNumber,
    delegateName,
    address, 
    companyType 
  } = req.body;
  
  // معالجة الملفات المرفقة
  let logoImage = company.logoImage;
  let identityImageFront = company.identityImageFront;
  let identityImageBack = company.identityImageBack;

  if (req.files) {
    // معالجة الشعار إذا تم توفيره
    if (req.files.logoImage && req.files.logoImage.length > 0) {
      // حذف الشعار القديم إذا كان موجودًا
      if (company.logoImage) {
        const oldLogoPath = path.join(UPLOAD_PATHS.logos, company.logoImage);
        if (fs.existsSync(oldLogoPath)) {
          fs.unlinkSync(oldLogoPath);
        }
      }
      logoImage = req.files.logoImage[0].filename;
    }
    
    // معالجة صورة البطاقة الأمامية إذا تم توفيرها
    if (req.files.identityImageFront && req.files.identityImageFront.length > 0) {
      // حذف الصورة القديمة إذا كانت موجودة
      if (company.identityImageFront) {
        const oldImagePath = path.join(UPLOAD_PATHS.identities, company.identityImageFront);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }
      identityImageFront = req.files.identityImageFront[0].filename;
    }
    
    // معالجة صورة البطاقة الخلفية إذا تم توفيرها
    if (req.files.identityImageBack && req.files.identityImageBack.length > 0) {
      // حذف الصورة القديمة إذا كانت موجودة
      if (company.identityImageBack) {
        const oldImagePath = path.join(UPLOAD_PATHS.identities, company.identityImageBack);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }
      identityImageBack = req.files.identityImageBack[0].filename;
    }
  }
  
  // تحديث الشركة مع الحقول الجديدة
  await company.update({
    name: name || company.name,
    email: email || company.email,
    phone: phone || company.phone,
    whatsappNumber: whatsappNumber || company.whatsappNumber,
    secondaryPhone: secondaryPhone || company.secondaryPhone,
    registrationNumber: registrationNumber || company.registrationNumber,
    delegateName: delegateName || company.delegateName,
    address: address || company.address,
    companyType: companyType || company.companyType,
    logoImage,
    identityImageFront,
    identityImageBack
  });
  
  res.status(200).json({
    status: 'success',
    data: company
  });
});
// Update company



// Delete company
// تعديل دالة deleteCompany في controllers/company.controller.js

const deleteCompany = catchAsync(async (req, res, next) => {
  const company = await Company.findByPk(req.params.id);
  
  if (!company) {
    return next(new AppError('الشركة غير موجودة', 404));
  }
  
  // حذف الشعار إذا كان موجوداً
  if (company.logoImage) {
    const logoPath = path.join(UPLOAD_PATHS.logos, company.logoImage);
    if (fs.existsSync(logoPath)) {
      fs.unlinkSync(logoPath);
    }
  }
  
  // حذف صورة البطاقة الأمامية إذا كانت موجودة
  if (company.identityImageFront) {
    const frontImagePath = path.join(UPLOAD_PATHS.identities, company.identityImageFront);
    if (fs.existsSync(frontImagePath)) {
      fs.unlinkSync(frontImagePath);
    }
  }
  
  // حذف صورة البطاقة الخلفية إذا كانت موجودة
  if (company.identityImageBack) {
    const backImagePath = path.join(UPLOAD_PATHS.identities, company.identityImageBack);
    if (fs.existsSync(backImagePath)) {
      fs.unlinkSync(backImagePath);
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