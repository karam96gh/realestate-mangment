const Reservation = require('../models/reservation.model');
const RealEstateUnit = require('../models/realEstateUnit.model');
const Building = require('../models/building.model');

const checkRole = (roles) => {
  return (req, res, next) => {
    // Ensure user exists on request (from auth middleware)
    if (!req.user) {
      return res.status(401).json({ message: 'عذرًا، يجب تسجيل الدخول أولاً!' });
    }
    
    // Check if user role is in the allowed roles array
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'عذرًا، ليس لديك الصلاحيات الكافية للوصول إلى هذه الصفحة.' });
    }

    next();
  };
};

const isTenantOrManagerWithAccess = async (req, res, next) => {
  try {
    const reservationId = req.params.reservationId;
    const reservation = await Reservation.findByPk(reservationId);
    
    if (!reservation) {
      return res.status(404).json({ message: 'عذرًا، هذا الحجز غير موجود.' });
    }
    
    // إذا كان المستخدم مستأجر، تحقق أنه مالك الحجز
    if (req.user.role === 'tenant' && reservation.userId !== req.user.id) {
      return res.status(403).json({ message: 'عذرًا، هذا الحجز ليس لك! لا يمكنك الوصول إليه.' });
    }
    
    // إذا كان المستخدم مديرًا، تحقق من أن الحجز ينتمي إلى شركته
    if (req.user.role === 'manager') {
      const unit = await RealEstateUnit.findByPk(reservation.unitId, {
        include: [{
          model: Building,
          as: 'building'
        }]
      });
      
      if (!unit || unit.building.companyId !== req.user.companyId) {
        return res.status(403).json({ message: 'عذرًا، لا يمكنك الوصول إلى هذا الحجز لأنه لا يتبع شركتك.' });
      }
    }
    
    next();
  } catch (error) {
    return res.status(500).json({ message: 'حدث خطأ أثناء التحقق من صلاحياتك، حاول مجددًا لاحقًا!' });
  }
};

// التحقق من ملكية المستأجر للحجز
const isTenantOwner = async (req, res, next) => {
  try {
    const reservationId = req.params.reservationId || req.body.reservationId;
    if (!reservationId) {
      return res.status(400).json({ message: 'عذرًا، يرجى إدخال معرف الحجز.' });
    }
    
    const reservation = await Reservation.findByPk(reservationId);
    if (!reservation) {
      return res.status(404).json({ message: 'عذرًا، هذا الحجز غير موجود.' });
    }
    
    if (req.user.role === 'tenant' && reservation.userId !== req.user.id) {
      return res.status(403).json({ message: 'عذرًا، هذا الحجز ليس لك! لا يمكنك الوصول إليه.' });
    }
    
    // إذا كان المستخدم مديرًا، تحقق من أن الحجز ينتمي إلى شركته
    if (req.user.role === 'manager') {
      const unit = await RealEstateUnit.findByPk(reservation.unitId, {
        include: [{
          model: Building,
          as: 'building'
        }]
      });
      
      if (!unit || unit.building.companyId !== req.user.companyId) {
        return res.status(403).json({ message: 'عذرًا، لا يمكنك الوصول إلى هذا الحجز لأنه لا يتبع شركتك.' });
      }
    }
    
    next();
  } catch (error) {
    return res.status(500).json({ message: 'حدث خطأ أثناء التحقق من ملكية الحجز، حاول مجددًا لاحقًا!' });
  }
};

// وسيط للتحقق من دور المحاسب مع التأكد من انتمائه للشركة
const isAccountant = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'عذرًا، يجب تسجيل الدخول أولاً!' });
  }
  
  if (req.user.role !== 'accountant') {
    return res.status(403).json({ message: 'عذرًا، هذه الصفحة مخصصة للمحاسبين فقط.' });
  }
  
  // التأكد من أن المحاسب لديه companyId
  if (!req.user.companyId) {
    return res.status(403).json({ message: 'عذرًا، حساب المحاسب غير مرتبط بشركة.' });
  }
  
  next();
};

// وسيط مشترك للمدير أو المحاسب مع التأكد من انتمائهما لنفس الشركة
const isManagerOrAccountant = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'عذرًا، يجب تسجيل الدخول أولاً!' });
  }
  
  if (!['manager', 'accountant'].includes(req.user.role)) {
    return res.status(403).json({ message: 'عذرًا، هذه الصفحة مخصصة للمديرين أو المحاسبين فقط.' });
  }
  
  // التأكد من أن المستخدم لديه companyId
  if (!req.user.companyId) {
    return res.status(403).json({ message: 'عذرًا، حسابك غير مرتبط بشركة.' });
  }
  
  next();
};

// وسيط مشترك للمسؤول أو المدير أو المحاسب
const isAdminOrManagerOrAccountant = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'عذرًا، يجب تسجيل الدخول أولاً!' });
  }
  
  if (!['manager', 'accountant', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ message: 'عذرًا، هذه الصفحة مخصصة للمسؤولين، المديرين، أو المحاسبين فقط.' });
  }
  
  // التأكد من أن المستخدم لديه companyId (باستثناء admin)
  if (req.user.role !== 'admin' && !req.user.companyId) {
    return res.status(403).json({ message: 'عذرًا، حسابك غير مرتبط بشركة.' });
  }
  
  next();
};

// وسيط للتحقق من دور عامل الصيانة مع التأكد من انتمائه للشركة
const isMaintenance = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'عذرًا، يجب تسجيل الدخول أولاً!' });
  }
  
  if (req.user.role !== 'maintenance') {
    return res.status(403).json({ message: 'عذرًا، هذه الصفحة مخصصة لعمال الصيانة فقط.' });
  }
  
  // التأكد من أن عامل الصيانة لديه companyId
  if (!req.user.companyId) {
    return res.status(403).json({ message: 'عذرًا، حساب عامل الصيانة غير مرتبط بشركة.' });
  }
  
  next();
};

// وسيط مشترك للمدير أو عامل الصيانة مع التأكد من انتمائهما لنفس الشركة
const isAdminOrManagerOrMaintenance = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'عذرًا، يجب تسجيل الدخول أولاً!' });
  }
  
  if (!['admin', 'manager', 'maintenance'].includes(req.user.role)) {
    return res.status(403).json({ message: 'عذرًا، هذه الصفحة مخصصة للمسؤولين، المديرين، أو عمال الصيانة فقط.' });
  }
  
  // التأكد من أن المستخدم لديه companyId (باستثناء admin)
  if (req.user.role !== 'admin' && !req.user.companyId) {
    return res.status(403).json({ message: 'عذرًا، حسابك غير مرتبط بشركة.' });
  }
  
  next();
};

// وسيط للتحقق من دور مالك العقار مع التأكد من انتمائه للشركة
const isOwner = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'عذرًا، يجب تسجيل الدخول أولاً!' });
  }
  
  if (req.user.role !== 'owner') {
    return res.status(403).json({ message: 'عذرًا، هذه الصفحة مخصصة لمالكي العقارات فقط.' });
  }
  
  // التأكد من أن مالك العقار لديه companyId
  if (!req.user.companyId) {
    return res.status(403).json({ message: 'عذرًا، حساب مالك العقار غير مرتبط بشركة.' });
  }
  
  next();
};

// وسيط مشترك للمدير أو مالك العقار مع التأكد من انتمائهما لنفس الشركة
const isAdminOrManagerOrOwner = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'عذرًا، يجب تسجيل الدخول أولاً!' });
  }
  
  if (!['admin', 'manager', 'owner'].includes(req.user.role)) {
    return res.status(403).json({ message: 'عذرًا، هذه الصفحة مخصصة للمسؤولين، المديرين، أو مالكي العقارات فقط.' });
  }
  
  // التأكد من أن المستخدم لديه companyId (باستثناء admin)
  if (req.user.role !== 'admin' && !req.user.companyId) {
    return res.status(403).json({ message: 'عذرًا، حسابك غير مرتبط بشركة.' });
  }
  
  next();
};

module.exports = {
  isAdmin: checkRole(['admin']),
  isManager: checkRole(['manager']),
  isTenant: checkRole(['tenant']),
  isAdminOrManager: checkRole(['admin', 'manager']),
  isAccountant,
  isManagerOrAccountant,
  isMaintenance,
  isAdminOrManagerOrMaintenance,
  isOwner,
  isAdminOrManagerOrOwner,
  isTenantOwner,
  checkRole,
  isTenantOrManagerWithAccess,
  isAdminOrManagerOrAccountant
};