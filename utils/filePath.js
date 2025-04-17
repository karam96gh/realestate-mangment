// utils/filePath.js - تعديل لضمان التوافق مع بقية التطبيق

const path = require('path');
const { UPLOAD_PATHS } = require('../config/upload');

// تعديل عنوان URL الأساسي حسب بيئة التشغيل
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

/**
 * الحصول على المسار المطلق للملف المخزن
 * @param {string} fileName - اسم الملف
 * @param {string} fileType - نوع الملف ('contracts', 'identities', 'checks', 'attachments', 'logos')
 * @returns {string} المسار المطلق للملف
 */
const getFilePath = (fileName, fileType) => {
  if (!fileName) return null;
  
  const uploadPath = UPLOAD_PATHS[fileType];
  if (!uploadPath) {
    throw new Error(`نوع ملف غير صالح: ${fileType}`);
  }
  
  return path.join(uploadPath, fileName);
};

/**
 * إنشاء عنوان URL عام للوصول إلى الملف
 * @param {string} fileName - اسم الملف
 * @param {string} fileType - نوع الملف ('contracts', 'identities', 'checks', 'attachments', 'logos')
 * @returns {string} عنوان URL العام للملف
 */
const getFileUrl = (fileName, fileType) => {
  if (!fileName) return null;
  
  const uploadPath = UPLOAD_PATHS[fileType];
  if (!uploadPath) {
    throw new Error(`نوع ملف غير صالح: ${fileType}`);
  }
  
  // تحويل المسار من 'public/uploads/logos' إلى '/uploads/logos' للعنوان
  const publicPath = uploadPath.replace('public', '');
  
  return `${BASE_URL}${publicPath}/${fileName}`;
};

/**
 * إضافة عناوين URL للملفات إلى كائن يحتوي على أسماء ملفات
 * @param {Object} obj - الكائن الذي يحتوي على خصائص أسماء الملفات
 * @param {Object} fileFields - تعيين خصائص الكائن إلى أنواع الملفات، مثل {logoImage: 'logos'}
 * @returns {Object} كائن جديد مع خصائص URL إضافية
 */
const addFileUrls = (obj, fileFields) => {
  if (!obj || typeof obj !== 'object') return obj;
  
  const result = { ...obj };
  
  Object.entries(fileFields).forEach(([field, fileType]) => {
    if (result[field]) {
      const urlFieldName = `${field}Url`;
      result[urlFieldName] = getFileUrl(result[field], fileType);
    }
  });
  
  return result;
};

module.exports = {
  getFilePath,
  getFileUrl,
  addFileUrls
};