// utils/serviceOrderStatusHelper.js

/**
 * دالة للتحقق من صحة تحولات الحالة
 * @param {string} currentStatus - الحالة الحالية
 * @param {string} newStatus - الحالة الجديدة المراد التحول إليها
 * @returns {Object} - نتيجة التحقق
 */
const validateStatusTransition = (currentStatus, newStatus) => {
  // تحديد الحالات المسموحة لكل حالة
  const allowedTransitions = {
    'pending': ['in-progress', 'rejected'],
    'in-progress': ['completed', 'rejected'],
    'completed': [], // لا يمكن تغيير الحالة بعد الإكمال
    'rejected': [] // لا يمكن تغيير الحالة بعد الرفض
  };

  // تحديد أولوية الحالات لمنع التراجع
  const statusPriority = {
    'pending': 1,
    'in-progress': 2,
    'completed': 3,
    'rejected': 3 // نفس مستوى completed
  };

  const currentPriority = statusPriority[currentStatus];
  const newPriority = statusPriority[newStatus];

  // التحقق من وجود الحالة الحالية والجديدة
  if (!allowedTransitions[currentStatus]) {
    return {
      isValid: false,
      message: `حالة غير صحيحة: ${currentStatus}`
    };
  }

  if (!statusPriority[newStatus]) {
    return {
      isValid: false,
      message: `حالة غير صحيحة: ${newStatus}`
    };
  }

  // التحقق من عدم التراجع في الأولوية
  if (newPriority < currentPriority) {
    return {
      isValid: false,
      message: `لا يمكن التراجع من حالة ${currentStatus} إلى ${newStatus}`
    };
  }

  // التحقق من الحالات النهائية
  if (currentStatus === 'completed') {
    return {
      isValid: false,
      message: 'لا يمكن تغيير حالة الطلب بعد إكماله'
    };
  }

  if (currentStatus === 'rejected') {
    return {
      isValid: false,
      message: 'لا يمكن تغيير حالة الطلب بعد رفضه'
    };
  }

  // التحقق من التحولات المسموحة
  const allowedNextStatuses = allowedTransitions[currentStatus];
  if (!allowedNextStatuses.includes(newStatus)) {
    return {
      isValid: false,
      message: `لا يمكن التحول من ${currentStatus} إلى ${newStatus}. الحالات المسموحة: ${allowedNextStatuses.join(', ')}`
    };
  }

  return {
    isValid: true,
    message: 'تحول صحيح'
  };
};

/**
 * دالة للحصول على الحالات المسموحة لحالة معينة
 * @param {string} currentStatus - الحالة الحالية
 * @returns {Array} - مصفوفة بالحالات المسموحة
 */
const getAllowedNextStatuses = (currentStatus) => {
  const allowedTransitions = {
    'pending': ['in-progress', 'rejected'],
    'in-progress': ['completed', 'rejected'],
    'completed': [],
    'rejected': []
  };

  return allowedTransitions[currentStatus] || [];
};

/**
 * دالة للحصول على وصف الحالة
 * @param {string} status - الحالة
 * @returns {string} - وصف الحالة
 */
const getStatusDescription = (status) => {
  const statusDescriptions = {
    'pending': 'في انتظار المعالجة',
    'in-progress': 'قيد التنفيذ',
    'completed': 'مكتمل',
    'rejected': 'مرفوض'
  };

  return statusDescriptions[status] || 'حالة غير معروفة';
};

/**
 * دالة للتحقق من إمكانية تعديل الطلب
 * @param {string} status - الحالة الحالية
 * @param {string} userRole - دور المستخدم
 * @returns {Object} - نتيجة التحقق
 */
const canEditServiceOrder = (status, userRole) => {
  // المستأجرون يمكنهم تعديل الطلبات في حالة pending فقط
  if (userRole === 'tenant') {
    return {
      canEdit: status === 'pending',
      canEditDescription: status === 'pending',
      canEditStatus: false,
      message: status === 'pending' ? 
        'يمكن تعديل الوصف فقط للطلبات في انتظار المعالجة' : 
        'لا يمكن تعديل الطلبات بعد بدء المعالجة'
    };
  }

  // المدراء وعمال الصيانة يمكنهم تعديل الحالة
  if (['admin', 'manager', 'maintenance', 'accountant'].includes(userRole)) {
    return {
      canEdit: true,
      canEditDescription: true,
      canEditStatus: !['completed', 'rejected'].includes(status),
      message: ['completed', 'rejected'].includes(status) ? 
        'لا يمكن تغيير حالة الطلبات المكتملة أو المرفوضة' : 
        'يمكن تعديل جميع الحقول'
    };
  }

  return {
    canEdit: false,
    canEditDescription: false,
    canEditStatus: false,
    message: 'غير مصرح بالتعديل'
  };
};

module.exports = {
  validateStatusTransition,
  getAllowedNextStatuses,
  getStatusDescription,
  canEditServiceOrder
};