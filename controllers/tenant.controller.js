// controllers/tenant.controller.js

const Tenant = require('../models/tenant.model');
const User = require('../models/user.model');
const { catchAsync, AppError } = require('../utils/errorHandler');
const generatePassword = require('../utils/generatePassword');
const fs = require('fs');
const path = require('path');
const { UPLOAD_PATHS } = require('../config/upload');

// الحصول على جميع المستأجرين (فقط للمسؤولين والمديرين)
const getAllTenants = catchAsync(async (req, res, next) => {
  // فقط المسؤولون والمديرون يمكنهم رؤية جميع المستأجرين
  if (req.user.role === 'tenant') {
    return next(new AppError('غير مصرح لك بعرض جميع المستأجرين', 403));
  }
  
  const tenants = await Tenant.findAll({
    include: [
      { 
        model: User, 
        as: 'user', 
        attributes: { exclude: ['password'] }
      }
    ]
  });
  
  res.status(200).json({
    status: 'success',
    results: tenants.length,
    data: tenants
  });
});

// الحصول على مستأجر حسب المعرف
const getTenantById = catchAsync(async (req, res, next) => {
  const tenant = await Tenant.findByPk(req.params.id, {
    include: [
      { 
        model: User, 
        as: 'user', 
        attributes: { exclude: ['password'] } 
      }
    ]
  });
  
  if (!tenant) {
    return next(new AppError('لم يتم العثور على المستأجر', 404));
  }
  
  // التحقق من الصلاحيات - المستأجر يمكنه فقط رؤية معلوماته الشخصية
  if (req.user.role === 'tenant' && req.user.id !== tenant.userId) {
    return next(new AppError('غير مصرح لك بعرض معلومات هذا المستأجر', 403));
  }
  
  res.status(200).json({
    status: 'success',
    data: tenant
  });
});

// الحصول على معلومات المستأجر حسب معرف المستخدم
const getTenantByUserId = catchAsync(async (req, res, next) => {
  const userId = req.params.userId || req.user.id;
  
  // التحقق من الصلاحيات - المستأجر يمكنه فقط رؤية معلوماته الشخصية
  if (req.user.role === 'tenant' && req.user.id !== parseInt(userId)) {
    return next(new AppError('غير مصرح لك بعرض معلومات هذا المستأجر', 403));
  }
  
  const tenant = await Tenant.findOne({
    where: { userId },
    include: [
      { 
        model: User, 
        as: 'user', 
        attributes: { exclude: ['password'] } 
      }
    ]
  });
  
  if (!tenant) {
    return next(new AppError('لم يتم العثور على معلومات المستأجر', 404));
  }
  
  res.status(200).json({
    status: 'success',
    data: tenant
  });
});

// إنشاء مستأجر جديد
const createTenant = catchAsync(async (req, res, next) => {
  // فقط المسؤولون والمديرون يمكنهم إنشاء مستأجرين جدد
  if (req.user.role === 'tenant') {
    return next(new AppError('غير مصرح لك بإنشاء مستأجرين', 403));
  }
  
  const {
    // بيانات المستخدم
    username,
    password,
    fullName,
    email,
    phone,
    whatsappNumber,
    idNumber,
    
    // بيانات المستأجر
    tenantType,
    businessActivities,
    contactPerson,
    contactPosition,
    notes
  } = req.body;
  
  // التحقق من القيم المطلوبة
  if (!username || !password || !fullName) {
    return next(new AppError('اسم المستخدم وكلمة المرور والاسم الكامل مطلوبة', 400));
  }
  
  // معالجة الملفات المرفقة
  let identityImageFront = null;
  let identityImageBack = null;
  let commercialRegisterImage = null;
  
  if (req.files) {
    if (req.files.identityImageFront && req.files.identityImageFront.length > 0) {
      identityImageFront = req.files.identityImageFront[0].filename;
    }
    
    if (req.files.identityImageBack && req.files.identityImageBack.length > 0) {
      identityImageBack = req.files.identityImageBack[0].filename;
    }
    
    if (req.files.commercialRegisterImage && req.files.commercialRegisterImage.length > 0) {
      commercialRegisterImage = req.files.commercialRegisterImage[0].filename;
    }
  }
  
  try {
    // إنشاء المستخدم
    const user = await User.create({
      username,
      password,
      fullName,
      email,
      phone,
      whatsappNumber,
      idNumber,
      identityImageFront,
      identityImageBack,
      commercialRegisterImage,
      role: 'tenant'
    });
    
    // إنشاء المستأجر
    const tenant = await Tenant.create({
      userId: user.id,
      tenantType: tenantType || 'person',
      businessActivities,
      contactPerson,
      contactPosition,
      notes
    });
    
    // استرجاع البيانات المتكاملة
    const tenantWithUser = await Tenant.findByPk(tenant.id, {
      include: [
        { 
          model: User, 
          as: 'user', 
          attributes: { exclude: ['password'] } 
        }
      ]
    });
    
    res.status(201).json({
      status: 'success',
      data: {
        ...tenantWithUser.toJSON(),
        user: {
          ...tenantWithUser.user.toJSON(),
          // إرسال كلمة المرور بشكل نصي فقط عند إنشاء المستخدم لأول مرة
          rawPassword: password
        }
      }
    });
    
  } catch (error) {
    // حذف الملفات المرفقة في حالة فشل الإنشاء
    if (identityImageFront) {
      const filePath = path.join(UPLOAD_PATHS.identities, identityImageFront);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    
    if (identityImageBack) {
      const filePath = path.join(UPLOAD_PATHS.identities, identityImageBack);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    
    if (commercialRegisterImage) {
      const filePath = path.join(UPLOAD_PATHS.identities, commercialRegisterImage);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    
    // رمي الخطأ لمعالجته في وحدة التحكم بالأخطاء المركزية
    throw error;
  }
});

// تحديث بيانات مستأجر
const updateTenant = catchAsync(async (req, res, next) => {
  const tenantId = req.params.id;
  
  // البحث عن المستأجر
  const tenant = await Tenant.findByPk(tenantId, {
    include: [{ model: User, as: 'user' }]
  });
  
  if (!tenant) {
    return next(new AppError('لم يتم العثور على المستأجر', 404));
  }
  
  // التحقق من الصلاحيات - المستأجر يمكنه فقط تحديث معلوماته الشخصية
  if (req.user.role === 'tenant' && req.user.id !== tenant.userId) {
    return next(new AppError('غير مصرح لك بتعديل معلومات هذا المستأجر', 403));
  }
  
  const {
    // بيانات المستأجر
    tenantType,
    businessActivities,
    contactPerson,
    contactPosition,
    notes,
    
    // بيانات المستخدم
    fullName,
    email,
    phone,
    whatsappNumber,
    idNumber
  } = req.body;
  
  // معالجة الملفات المرفقة
  let identityImageFront = tenant.user.identityImageFront;
  let identityImageBack = tenant.user.identityImageBack;
  let commercialRegisterImage = tenant.user.commercialRegisterImage;
  
  if (req.files) {
    // معالجة صورة الهوية الأمامية
    if (req.files.identityImageFront && req.files.identityImageFront.length > 0) {
      // حذف الصورة القديمة إذا وجدت
      if (tenant.user.identityImageFront) {
        const oldPath = path.join(UPLOAD_PATHS.identities, tenant.user.identityImageFront);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      identityImageFront = req.files.identityImageFront[0].filename;
    }
    
    // معالجة صورة الهوية الخلفية
    if (req.files.identityImageBack && req.files.identityImageBack.length > 0) {
      // حذف الصورة القديمة إذا وجدت
      if (tenant.user.identityImageBack) {
        const oldPath = path.join(UPLOAD_PATHS.identities, tenant.user.identityImageBack);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      identityImageBack = req.files.identityImageBack[0].filename;
    }
    
    // معالجة صورة السجل التجاري
    if (req.files.commercialRegisterImage && req.files.commercialRegisterImage.length > 0) {
      // حذف الصورة القديمة إذا وجدت
      if (tenant.user.commercialRegisterImage) {
        const oldPath = path.join(UPLOAD_PATHS.identities, tenant.user.commercialRegisterImage);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      commercialRegisterImage = req.files.commercialRegisterImage[0].filename;
    }
  }
  
  try {
    // تحديث بيانات المستأجر
    await tenant.update({
      tenantType: tenantType || tenant.tenantType,
      businessActivities: businessActivities !== undefined ? businessActivities : tenant.businessActivities,
      contactPerson: contactPerson !== undefined ? contactPerson : tenant.contactPerson,
      contactPosition: contactPosition !== undefined ? contactPosition : tenant.contactPosition,
      notes: notes !== undefined ? notes : tenant.notes
    });
    
    // تحديث بيانات المستخدم
    await tenant.user.update({
      fullName: fullName || tenant.user.fullName,
      email: email !== undefined ? email : tenant.user.email,
      phone: phone !== undefined ? phone : tenant.user.phone,
      whatsappNumber: whatsappNumber !== undefined ? whatsappNumber : tenant.user.whatsappNumber,
      idNumber: idNumber !== undefined ? idNumber : tenant.user.idNumber,
      identityImageFront,
      identityImageBack,
      commercialRegisterImage
    });
    
    // استرجاع البيانات المحدثة
    const updatedTenant = await Tenant.findByPk(tenant.id, {
      include: [
        { 
          model: User, 
          as: 'user', 
          attributes: { exclude: ['password'] } 
        }
      ]
    });
    
    res.status(200).json({
      status: 'success',
      data: updatedTenant
    });
    
  } catch (error) {
    // رمي الخطأ لمعالجته في وحدة التحكم بالأخطاء المركزية
    throw error;
  }
});

// حذف مستأجر
const deleteTenant = catchAsync(async (req, res, next) => {
  // فقط المسؤولون يمكنهم حذف المستأجرين
  if (req.user.role !== 'admin') {
    return next(new AppError('غير مصرح لك بحذف المستأجرين', 403));
  }
  
  const tenantId = req.params.id;
  
  // البحث عن المستأجر
  const tenant = await Tenant.findByPk(tenantId, {
    include: [{ model: User, as: 'user' }]
  });
  
  if (!tenant) {
    return next(new AppError('لم يتم العثور على المستأجر', 404));
  }
  
  // حذف الملفات المرتبطة بالمستخدم
  if (tenant.user.identityImageFront) {
    const filePath = path.join(UPLOAD_PATHS.identities, tenant.user.identityImageFront);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
  
  if (tenant.user.identityImageBack) {
    const filePath = path.join(UPLOAD_PATHS.identities, tenant.user.identityImageBack);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
  
  if (tenant.user.commercialRegisterImage) {
    const filePath = path.join(UPLOAD_PATHS.identities, tenant.user.commercialRegisterImage);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
  
  try {
    // حذف المستأجر (سيؤدي إلى حذف المستخدم أيضًا بسبب قيود الحذف المتتالي)
    await tenant.destroy();
    
    res.status(204).json({
      status: 'success',
      data: null
    });
    
  } catch (error) {
    // رمي الخطأ لمعالجته في وحدة التحكم بالأخطاء المركزية
    throw error;
  }
});

module.exports = {
  getAllTenants,
  getTenantById,
  getTenantByUserId,
  createTenant,
  updateTenant,
  deleteTenant
};