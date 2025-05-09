// Validation middleware 
const { validationResult, check } = require('express-validator');

// Validation middleware to check for errors
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};
const resetManagerPasswordvalidate=[
  check('managerId').isInt().withMessage('Manager ID must be an integer'),
  check('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
];

// User validation rules
const userValidationRules = [
  check('username').isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
  check('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  check('fullName').notEmpty().withMessage('Full name is required'),
  check('email').optional({ nullable: true }).isEmail().withMessage('Valid email is required'),
  check('phone').optional({ nullable: true })
];

// Company validation rules
// Company validation rules
const companyValidationRules = [
    check('name').notEmpty().withMessage('Company name is required'),
    check('email').optional({ nullable: true }).isEmail().withMessage('Valid email is required'),
    check('phone').optional({ nullable: true }),
    check('address').optional({ nullable: true }),
    check('managerFullName').optional({ nullable: true }),
    check('managerEmail').optional({ nullable: true }).isEmail().withMessage('Valid manager email is required'),
    check('managerPhone').optional({ nullable: true })
  ];

// تعديل قواعد التحقق للمبنى
const buildingValidationRules = [
  check('buildingNumber').notEmpty().withMessage('رقم المبنى مطلوب'),
  check('name').notEmpty().withMessage('اسم المبنى مطلوب'),
  check('address').notEmpty().withMessage('عنوان المبنى مطلوب'),
  check('buildingType').isIn(['residential', 'commercial', 'mixed']).withMessage('نوع المبنى غير صالح'),
  check('totalUnits').optional({ nullable: true }).isInt().withMessage('إجمالي الوحدات يجب أن يكون رقماً صحيحاً'),
  check('totalFloors').optional({ nullable: true }).isInt().withMessage('عدد الطوابق يجب أن يكون رقماً صحيحاً'),
  check('internalParkingSpaces').optional({ nullable: true }).isInt().withMessage('عدد المواقف الداخلية يجب أن يكون رقماً صحيحاً'),
  check('description').optional({ nullable: true })
];

// Real Estate Unit validation rules
const unitValidationRules = [
  check('buildingId').isInt().withMessage('يجب أن يكون معرف المبنى رقمًا صحيحًا'),
  check('unitNumber').notEmpty().withMessage('رقم الوحدة مطلوب'),
  check('unitType').isIn(['studio', 'apartment', 'shop', 'office', 'villa', 'room']).withMessage('نوع الوحدة غير صالح'),
  check('unitLayout').optional({ nullable: true }).isIn(['studio', '1bhk', '2bhk', '3bhk', '4bhk', '5bhk', '6bhk', '7bhk', 'other']).withMessage('تخطيط الوحدة غير صالح'),
  check('floor').optional({ nullable: true }).isInt().withMessage('يجب أن يكون الطابق رقمًا صحيحًا'),
  check('area').optional({ nullable: true }).isNumeric().withMessage('يجب أن تكون المساحة رقمًا'),
  check('bedrooms').optional({ nullable: true }).isInt().withMessage('يجب أن يكون عدد غرف النوم رقمًا صحيحًا'),
  check('bathrooms').optional({ nullable: true }).isInt().withMessage('يجب أن يكون عدد الحمامات رقمًا صحيحًا'),
  check('price').isNumeric().withMessage('يجب أن يكون السعر رقمًا'),
  check('status').optional({ nullable: true }).isIn(['available', 'rented', 'maintenance']).withMessage('حالة الوحدة غير صالحة'),
  check('description').optional({ nullable: true })
];
// Reservation validation rules
const reservationValidationRules = [
  check('userId').optional({nullable:true}).isInt().withMessage('User ID must be an integer'),
  check('unitId').isInt().withMessage('Unit ID must be an integer'),
  check('startDate').isDate().withMessage('Valid start date is required'),
  check('endDate').isDate().withMessage('Valid end date is required'),
  check('status').optional({ nullable: true }).isIn(['active', 'expired', 'cancelled']).withMessage('Invalid status'),
  check('notes').optional({ nullable: true })
];

// Service Order validation rules
const serviceOrderValidationRules = [
  check('reservationId').isInt().withMessage('Reservation ID must be an integer'),
  check('serviceType').isIn(['financial', 'maintenance', 'administrative']).withMessage('Invalid service type'),
  check('serviceSubtype').notEmpty().withMessage('Service subtype is required'),
  check('description').notEmpty().withMessage('Description is required'),
  check('status').optional({ nullable: true }).isIn(['pending', 'in-progress', 'completed', 'rejected']).withMessage('Invalid status')
];

// Payment validation rules
const paymentValidationRules = [
  check('reservationId').isInt().withMessage('Reservation ID must be an integer'),
  check('amount').isNumeric().withMessage('Amount must be a number'),
  check('paymentDate').isDate().withMessage('Valid payment date is required'),
  check('paymentMethod').optional({ nullable: true }),
  check('status').optional({ nullable: true }).isIn(['paid', 'pending', 'delayed', 'cancelled']).withMessage('Invalid status'),
  check('notes').optional({ nullable: true })
];

// Login validation rules
const loginValidationRules = [
  check('username').notEmpty().withMessage('Username is required'),
  check('password').notEmpty().withMessage('Password is required')
];

module.exports = {
  validate,
  userValidationRules,
  companyValidationRules,
  buildingValidationRules,
  unitValidationRules,
  reservationValidationRules,
  serviceOrderValidationRules,
  paymentValidationRules,
  loginValidationRules,
  resetManagerPasswordvalidate
};