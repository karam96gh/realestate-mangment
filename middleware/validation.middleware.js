// middleware/validation.middleware.js
const { validationResult, check } = require('express-validator');

// وسيط التحقق من الأخطاء
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// قواعد التحقق من إعادة تعيين كلمة مرور المدير
const resetManagerPasswordvalidate = [
  check('managerId').isInt().withMessage('معرف المدير يجب أن يكون رقمًا صحيحًا'),
  check('newPassword').isLength({ min: 6 }).withMessage('كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل')
];

// قواعد التحقق من المستخدم
const userValidationRules = [
  check('username').optional().isLength({ min: 3 }).withMessage('اسم المستخدم يجب أن يكون 3 أحرف على الأقل'),
  check('password').optional().isLength({ min: 6 }).withMessage('كلمة المرور يجب أن تكون 6 أحرف على الأقل'),
  check('fullName').optional().notEmpty().withMessage('الاسم الكامل مطلوب'),
  check('email').optional({ nullable: true }).isEmail().withMessage('البريد الإلكتروني غير صالح'),
  check('phone').optional({ nullable: true }),
  check('whatsappNumber').optional({ nullable: true }),
  check('idNumber').optional({ nullable: true })
];

// قواعد التحقق من المستأجر
const tenantValidationRules = [
  check('userId').optional().isInt().withMessage('معرف المستخدم يجب أن يكون رقمًا صحيحًا'),
  check('tenantType').optional().isIn([
    'partnership', 
    'commercial_register', 
    'person', 
    'embassy', 
    'foreign_company', 
    'government', 
    'inheritance', 
    'civil_registry'
  ]).withMessage('نوع المستأجر غير صالح'),
  check('businessActivities').optional({ nullable: true }),
  check('contactPerson').optional({ nullable: true }),
  check('contactPosition').optional({ nullable: true }),
  check('notes').optional({ nullable: true })
];

// قواعد التحقق من الشركة
// Updated validation rules without bedrooms field and with companyType field

// Company validation rules - UPDATED with companyType
// تعديل قواعد التحقق من الشركة في middleware/validation.middleware.js

// Company validation rules - UPDATED with new fields
const companyValidationRules = [
  check('name').notEmpty().withMessage('اسم الشركة مطلوب'),
  check('companyType').optional().isIn(['owner', 'agency']).withMessage('نوع الشركة غير صالح، يجب أن يكون مالك أو شركة عقارية'),
  check('email').optional({ nullable: true }).isEmail().withMessage('البريد الإلكتروني غير صالح'),
  check('phone').optional({ nullable: true }),
  check('whatsappNumber').optional({ nullable: true }),
  check('secondaryPhone').optional({ nullable: true }),
  check('registrationNumber').optional({ nullable: true }),
  check('delegateName').optional({ nullable: true }),
  check('address').optional({ nullable: true }),
  check('managerFullName').optional({ nullable: true }),
  check('managerEmail').optional({ nullable: true }).isEmail().withMessage('البريد الإلكتروني للمدير غير صالح'),
  check('managerPhone').optional({ nullable: true })
];

// Unit validation rules - UPDATED with string floor and no bedrooms
const unitValidationRules = [
  check('buildingId').isInt().withMessage('معرف المبنى يجب أن يكون رقمًا صحيحًا'),
  check('unitNumber').notEmpty().withMessage('رقم الوحدة مطلوب'),
  check('unitType').isIn(['studio', 'apartment', 'shop', 'office', 'villa', 'room']).withMessage('نوع الوحدة غير صالح'),
  check('unitLayout').optional({ nullable: true }).isIn(['studio', '1bhk', '2bhk', '3bhk', '4bhk', '5bhk', '6bhk', '7bhk', 'other']).withMessage('تخطيط الوحدة غير صالح'),
  // Modified floor validation - no longer integer
check('floor').optional({ nullable: true }).isString().withMessage('الطابق يجب أن يكون صالحًا'),
  check('area').optional({ nullable: true }).isNumeric().withMessage('المساحة يجب أن تكون رقمًا'),
  // bedrooms validation removed
  check('bathrooms').optional({ nullable: true }).isInt().withMessage('عدد الحمامات يجب أن يكون رقمًا صحيحًا'),
  check('price').isNumeric().withMessage('السعر يجب أن يكون رقمًا'),
  check('status').optional({ nullable: true }).isIn(['available', 'rented', 'maintenance']).withMessage('حالة الوحدة غير صالحة'),
  check('description').optional({ nullable: true })
];

// قواعد التحقق من المبنى
const buildingValidationRules = [
  check('buildingNumber').notEmpty().withMessage('رقم المبنى مطلوب'),
  check('name').notEmpty().withMessage('اسم المبنى مطلوب'),
  check('address').notEmpty().withMessage('عنوان المبنى مطلوب'),
  check('buildingType').isIn(['residential', 'commercial', 'mixed']).withMessage('نوع المبنى غير صالح'),
  check('totalUnits').optional({ nullable: true }).isInt().withMessage('إجمالي الوحدات يجب أن يكون رقمًا صحيحًا'),
  check('totalFloors').optional({ nullable: true }).isInt().withMessage('عدد الطوابق يجب أن يكون رقمًا صحيحًا'),
  check('internalParkingSpaces').optional({ nullable: true }).isInt().withMessage('عدد المواقف الداخلية يجب أن يكون رقمًا صحيحًا'),
  check('description').optional({ nullable: true })
];
const expenseValidationRules = [
  check('unitId').isInt().withMessage('معرف الوحدة يجب أن يكون رقمًا صحيحًا'),
  check('expenseType').isIn([
    'maintenance', 'utilities', 'insurance', 'cleaning', 
    'security', 'management', 'repairs', 'other'
  ]).withMessage('نوع المصروف غير صالح'),
  check('amount').isNumeric().withMessage('المبلغ يجب أن يكون رقمًا'),
  check('expenseDate').isDate().withMessage('تاريخ المصروف مطلوب وبتنسيق صحيح'),
  check('notes').optional({ nullable: true }).isLength({ max: 500 }).withMessage('الملاحظات يجب أن تكون أقل من 500 حرف')
];


// قواعد التحقق من الحجز - محدثة مع حقول العقد الجديدة
// قواعد التحقق من الحجز - محدثة لدعم إنشاء مستأجر جديد
const reservationValidationRules = [
  check('unitId').isInt().withMessage('معرف الوحدة يجب أن يكون رقمًا صحيحًا'),
  check('contractType').optional({ nullable: true }).isIn(['residential', 'commercial']).withMessage('نوع العقد يجب أن يكون سكني أو تجاري'),
  check('startDate').isDate().withMessage('تاريخ بداية العقد مطلوب وبتنسيق صحيح'),
  check('endDate').isDate().withMessage('تاريخ نهاية العقد مطلوب وبتنسيق صحيح'),
  check('status').optional({ nullable: true }).isIn(['active', 'expired', 'cancelled']).withMessage('حالة الحجز غير صالحة'),
  check('paymentMethod').optional({ nullable: true }).isIn(['cash', 'checks']).withMessage('طريقة الدفع يجب أن تكون نقدًا أو شيكات'),
  check('paymentSchedule').optional({ nullable: true }).isIn([
    'monthly', 'quarterly', 'triannual', 'biannual', 'annual'
  ]).withMessage('جدول الدفع غير صالح'),
  
  // قواعد التحقق من التأمين - محدثة
  check('includesDeposit').optional({ nullable: true }).isBoolean().withMessage('يشمل الضمان يجب أن يكون قيمة منطقية'),
  check('depositAmount').optional({ nullable: true }).isNumeric().withMessage('قيمة الضمان يجب أن تكون رقمًا'),
  check('depositPaymentMethod').optional({ nullable: true }).isIn(['cash', 'check']).withMessage('طريقة دفع التأمين يجب أن تكون نقدي أو شيك'),
  check('depositStatus').optional({ nullable: true }).isIn(['unpaid', 'paid', 'returned']).withMessage('حالة التأمين غير صالحة'),
  check('depositPaidDate').optional({ nullable: true }).isDate().withMessage('تاريخ دفع التأمين يجب أن يكون تاريخًا صالحًا'),
  check('depositReturnedDate').optional({ nullable: true }),
  check('depositNotes').optional({ nullable: true }),
  
  check('notes').optional({ nullable: true }),
  
  // إضافة قواعد التحقق من بيانات المستأجر الجديد
  check('tenantFullName').notEmpty().withMessage('اسم المستأجر الكامل مطلوب'),
  check('tenantEmail').optional({ nullable: true }).isEmail().withMessage('البريد الإلكتروني للمستأجر غير صالح'),
  check('tenantPhone').optional({ nullable: true }),
  check('tenantWhatsappNumber').optional({ nullable: true }),
  check('tenantIdNumber').optional({ nullable: true }),
  check('tenantType').optional({ nullable: true }).isIn([
    'partnership', 
    'commercial_register', 
    'person', 
    'embassy', 
    'foreign_company', 
    'government', 
    'inheritance', 
    'civil_registry'
  ]).withMessage('نوع المستأجر غير صالح'),
  check('tenantBusinessActivities').optional({ nullable: true }),
  check('tenantContactPerson').optional({ nullable: true }),
  check('tenantContactPosition').optional({ nullable: true }),
  check('tenantNotes').optional({ nullable: true })
];

// تحديث قواعد التحقق من الحجز للتحديث (بدون بيانات المستأجر)
const reservationUpdateValidationRules = [
  check('contractType').optional({ nullable: true }).isIn(['residential', 'commercial']).withMessage('نوع العقد يجب أن يكون سكني أو تجاري'),
  check('startDate').optional({ nullable: true }).isDate().withMessage('تاريخ بداية العقد يجب أن يكون تاريخًا صالحًا'),
  check('endDate').optional({ nullable: true }).isDate().withMessage('تاريخ نهاية العقد يجب أن يكون تاريخًا صالحًا'),
  check('status').optional({ nullable: true }).isIn(['active', 'expired', 'cancelled']).withMessage('حالة الحجز غير صالحة'),
  check('paymentMethod').optional({ nullable: true }).isIn(['cash', 'checks']).withMessage('طريقة الدفع يجب أن تكون نقدًا أو شيكات'),
  check('paymentSchedule').optional({ nullable: true }).isIn([
    'monthly', 'quarterly', 'triannual', 'biannual', 'annual'
  ]).withMessage('جدول الدفع غير صالح'),
  
  // قواعد التحقق من التأمين للتحديث
  check('includesDeposit').optional({ nullable: true }).isBoolean().withMessage('يشمل الضمان يجب أن يكون قيمة منطقية'),
  check('depositAmount').optional({ nullable: true }).isNumeric().withMessage('قيمة الضمان يجب أن تكون رقمًا'),
  check('depositPaymentMethod').optional({ nullable: true }).isIn(['cash', 'check']).withMessage('طريقة دفع التأمين يجب أن تكون نقدي أو شيك'),
  check('depositStatus').optional({ nullable: true }).isIn(['unpaid', 'paid', 'returned']).withMessage('حالة التأمين غير صالحة'),
  check('depositPaidDate').optional({ nullable: true }).isDate().withMessage('تاريخ دفع التأمين يجب أن يكون تاريخًا صالحًا'),
  check('depositReturnedDate').optional({ nullable: true }).isDate().withMessage('تاريخ استرجاع التأمين يجب أن يكون تاريخًا صالحًا'),
  check('depositNotes').optional({ nullable: true }),
  
  check('notes').optional({ nullable: true })
];

// قواعد التحقق من طلب الخدمة
const serviceOrderValidationRules = [
  check('reservationId').isInt().withMessage('معرف الحجز يجب أن يكون رقمًا صحيحًا'),
  check('serviceType').isIn(['financial', 'maintenance', 'administrative']).withMessage('نوع الخدمة غير صالح'),
  check('serviceSubtype').notEmpty().withMessage('النوع الفرعي للخدمة مطلوب'),
  check('description').notEmpty().withMessage('وصف الخدمة مطلوب'),
  check('status').optional({ nullable: true }).isIn(['pending', 'in-progress', 'completed', 'rejected']).withMessage('حالة الطلب غير صالحة')
];

// قواعد التحقق من الدفع
const paymentValidationRules = [
  check('reservationId').isInt().withMessage('معرف الحجز يجب أن يكون رقمًا صحيحًا'),
  check('amount').isNumeric().withMessage('المبلغ يجب أن يكون رقمًا'),
  check('paymentDate').isDate().withMessage('تاريخ الدفع مطلوب وبتنسيق صحيح'),
  check('paymentMethod').optional({ nullable: true }),
  check('status').optional({ nullable: true }).isIn(['paid', 'pending', 'delayed', 'cancelled']).withMessage('حالة الدفع غير صالحة'),
  check('notes').optional({ nullable: true })
];

// قواعد التحقق من تسجيل الدخول
const loginValidationRules = [
  check('username').notEmpty().withMessage('اسم المستخدم مطلوب'),
  check('password').notEmpty().withMessage('كلمة المرور مطلوبة')
];

module.exports = {
  validate,
  userValidationRules,
  tenantValidationRules,
  companyValidationRules,
  buildingValidationRules,
  unitValidationRules,
  reservationValidationRules,
  serviceOrderValidationRules,
  paymentValidationRules,
  loginValidationRules,
  resetManagerPasswordvalidate,
  reservationUpdateValidationRules,
  expenseValidationRules
};