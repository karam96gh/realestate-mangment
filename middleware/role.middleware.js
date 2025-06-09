const Reservation = require('../models/reservation.model');
const RealEstateUnit = require('../models/realEstateUnit.model');
const Building = require('../models/building.model');

const checkRole = (roles) => {
  return (req, res, next) => {
    // Ensure user exists on request (from auth middleware)
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized access' });
    }
    
    // Check if user role is in the allowed roles array
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Access forbidden. Insufficient permissions' });
    }

    next();
  };
};

const isTenantOrManagerWithAccess = async (req, res, next) => {
  try {
    const reservationId = req.params.reservationId;
    const reservation = await Reservation.findByPk(reservationId);
    
    if (!reservation) {
      return res.status(404).json({ message: 'الحجز غير موجود' });
    }
    
    // إذا كان المستخدم مستأجر، تحقق أنه مالك الحجز
    if (req.user.role === 'tenant' && reservation.userId !== req.user.id) {
      return res.status(403).json({ message: 'غير مصرح لك بالوصول لهذا الحجز' });
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
        return res.status(403).json({ message: 'غير مصرح بالوصول لهذا الحجز' });
      }
    }
    
    next();
  } catch (error) {
    return res.status(500).json({ message: 'خطأ في التحقق من الصلاحيات' });
    }
};

// التحقق من ملكية المستأجر للحجز
const isTenantOwner = async (req, res, next) => {
  try {
    const reservationId = req.params.reservationId || req.body.reservationId;
    if (!reservationId) {
      return res.status(400).json({ message: 'معرف الحجز مطلوب' });
    }
    
    const reservation = await Reservation.findByPk(reservationId);
    if (!reservation) {
      return res.status(404).json({ message: 'الحجز غير موجود' });
    }
    
    if (req.user.role === 'tenant' && reservation.userId !== req.user.id) {
      return res.status(403).json({ message: 'غير مصرح بالوصول لهذا الحجز' });
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
        return res.status(403).json({ message: 'غير مصرح بالوصول لهذا الحجز' });
      }
    }
    
    next();
  } catch (error) {
    return res.status(500).json({ message: 'خطأ في التحقق من ملكية الحجز' });
  }
};

// وسيط للتحقق من دور المحاسب مع التأكد من انتمائه للشركة
const isAccountant = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Unauthorized access' });
  }
  
  if (req.user.role !== 'accountant') {
    return res.status(403).json({ message: 'Access forbidden. Insufficient permissions' });
  }
  
  // التأكد من أن المحاسب لديه companyId
  if (!req.user.companyId) {
    return res.status(403).json({ message: 'Access forbidden. Accountant must be associated with a company' });
  }
  
  next();
};

// وسيط مشترك للمدير أو المحاسب مع التأكد من انتمائهما لنفس الشركة
const isManagerOrAccountant = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Unauthorized access' });
  }
  
  if (!['manager', 'accountant'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Access forbidden. Insufficient permissions' });
  }
  
  // التأكد من أن المستخدم لديه companyId
  if (!req.user.companyId) {
    return res.status(403).json({ message: 'Access forbidden. User must be associated with a company' });
  }
  
  next();
};
const isAdminOrManagerOrAccountant = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Unauthorized access' });
  }
  
  if (!['manager', 'accountant','admin'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Access forbidden. Insufficient permissions' });
  }
  
  // التأكد من أن المستخدم لديه companyId
  if (!req.user.companyId) {
    return res.status(403).json({ message: 'Access forbidden. User must be associated with a company' });
  }
  
  next();
};

// وسيط للتحقق من دور عامل الصيانة مع التأكد من انتمائه للشركة
const isMaintenance = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Unauthorized access' });
  }
  
  if (req.user.role !== 'maintenance') {
    return res.status(403).json({ message: 'Access forbidden. Insufficient permissions' });
  }
  
  // التأكد من أن عامل الصيانة لديه companyId
  if (!req.user.companyId) {
    return res.status(403).json({ message: 'Access forbidden. Maintenance worker must be associated with a company' });
  }
  
  next();
};

// وسيط مشترك للمدير أو عامل الصيانة مع التأكد من انتمائهما لنفس الشركة
const isAdminOrManagerOrMaintenance = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Unauthorized access' });
  }
  
  if (!['admin', 'manager', 'maintenance'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Access forbidden. Insufficient permissions' });
  }
  
  // التأكد من أن المستخدم لديه companyId (باستثناء admin)
  if (req.user.role !== 'admin' && !req.user.companyId) {
    return res.status(403).json({ message: 'Access forbidden. User must be associated with a company' });
  }
  
  next();
};

// وسيط للتحقق من دور مالك العقار مع التأكد من انتمائه للشركة
const isOwner = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Unauthorized access' });
  }
  
  if (req.user.role !== 'owner') {
    return res.status(403).json({ message: 'Access forbidden. Insufficient permissions' });
  }
  
  // التأكد من أن مالك العقار لديه companyId
  if (!req.user.companyId) {
    return res.status(403).json({ message: 'Access forbidden. Owner must be associated with a company' });
  }
  
  next();
};

// وسيط مشترك للمدير أو مالك العقار مع التأكد من انتمائهما لنفس الشركة
const isAdminOrManagerOrOwner = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Unauthorized access' });
  }
  
  if (!['admin', 'manager', 'owner'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Access forbidden. Insufficient permissions' });
  }
  
  // التأكد من أن المستخدم لديه companyId (باستثناء admin)
  if (req.user.role !== 'admin' && !req.user.companyId) {
    return res.status(403).json({ message: 'Access forbidden. User must be associated with a company' });
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