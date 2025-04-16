// Versión actualizada de config/upload.js

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// Definir rutas de almacenamiento
const UPLOAD_PATHS = {
  contracts: 'public/uploads/contracts',
  identities: 'public/uploads/identities',
  checks: 'public/uploads/checks',
  attachments: 'public/uploads/attachments',
  logos: 'public/uploads/logos'
};

// Asegurar que existan los directorios de carga
Object.values(UPLOAD_PATHS).forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`Directorio creado: ${dir}`);
  } else {
    console.log(`Directorio existente: ${dir}`);
  }
});

// Configurar almacenamiento
const storage = (destination) => multer.diskStorage({
  destination: (req, file, cb) => {
    // Registrar el destino al que se enviará el archivo
    console.log(`Guardando archivo en: ${destination}`);
    cb(null, destination);
  },
  filename: (req, file, cb) => {
    // Crear nombre único para el archivo
    const uniqueFileName = `${uuidv4()}${path.extname(file.originalname)}`;
    console.log(`Archivo renombrado a: ${uniqueFileName}`);
    cb(null, uniqueFileName);
  }
});

// Filtro de archivos
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'application/pdf'
  ];
  
  // Registrar tipo de archivo recibido
  console.log(`Archivo recibido: ${file.originalname}, tipo: ${file.mimetype}`);
  
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    console.log(`Archivo rechazado: ${file.originalname} (tipo no permitido)`);
    cb(new Error('Tipo de archivo inválido. Solo se permiten JPEG, PNG, GIF y PDF.'), false);
  }
};

// Crear middleware de carga
const createUploader = (destination) => multer({
  storage: storage(destination),
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE, 10) || 5 * 1024 * 1024 // Por defecto 5MB
  },
  fileFilter
});

// Función para procesar múltiples tipos de archivos en una sola solicitud

// تحسين دالة multiUpload في ملف config/upload.js

/**
 * وظيفة محسنة لمعالجة تحميل الملفات المتعددة
 * هذه الوظيفة تتعامل بشكل أفضل مع حالات التحميل المختلفة
 */
// تحسين دالة multiUpload في ملف config/upload.js

/**
 * وظيفة محسنة لمعالجة تحميل الملفات المتعددة
 * هذه الوظيفة تتعامل بشكل أفضل مع حالات التحميل المختلفة
 */
const multiUpload = () => {
  const uploaders = {};
  Object.entries(UPLOAD_PATHS).forEach(([key, path]) => {
    uploaders[key] = createUploader(path);
  });
  
  return (req, res, next) => {
    console.log('معالجة الملفات المتعددة...');
    console.log('محتوى الطلب:', req.body);
    
    // إذا لم يكن هناك ملفات مرفقة، مواصلة التنفيذ
    if (!req.is('multipart/form-data')) {
      console.log('لا توجد ملفات للمعالجة، نوع الطلب ليس multipart/form-data');
      return next();
    }

    // تحضير الملفات المراد تحميلها
    const fileFields = [
      { name: 'contractImage', type: 'contracts' },
      { name: 'identityImage', type: 'identities' },
      { name: 'commercialRegisterImage', type: 'identities' },
      { name: 'checkImage', type: 'checks' },
      { name: 'attachmentFile', type: 'attachments' },
      { name: 'logoImage', type: 'logos' }
    ];
    
    // معالجة الملفات واحدًا تلو الآخر
    let processedFields = 0;
    const errors = [];

    // إنشاء كائن req.files إذا لم يكن موجودًا
    if (!req.files) {
      req.files = {};
    }
    
    // معالجة كل حقل ملف
    const processField = (fieldIndex) => {
      if (fieldIndex >= fileFields.length) {
        if (errors.length > 0) {
          return next(new Error(`أخطاء في تحميل الملفات: ${errors.join(', ')}`));
        }
        console.log('تم معالجة جميع حقول الملفات بنجاح');
        return next();
      }
      
      const field = fileFields[fieldIndex];
      const uploader = uploaders[field.type];
      
      // استخدام دالة multer لمعالجة الملف
      uploader.single(field.name)(req, res, (err) => {
        if (err) {
          console.error(`خطأ في معالجة الملف ${field.name}:`, err);
          errors.push(`${field.name}: ${err.message}`);
        } else if (req.file) {
          // إذا تم تحميل الملف، إضافته إلى req.files
          req.files[field.name] = [req.file];
          console.log(`تم معالجة الملف ${field.name} بنجاح:`, req.file.filename);
          delete req.file; // مسح req.file لتجنب تداخل الملفات
        }
        
        // معالجة الحقل التالي
        processField(fieldIndex + 1);
      });
    };
    
    // بدء معالجة الحقول
    processField(0);
  };
};
// Exportar middlewares de carga
module.exports = {
  contractUpload: createUploader(UPLOAD_PATHS.contracts),
  identityUpload: createUploader(UPLOAD_PATHS.identities),
  checkUpload: createUploader(UPLOAD_PATHS.checks),
  attachmentUpload: createUploader(UPLOAD_PATHS.attachments),
  logoUpload: createUploader(UPLOAD_PATHS.logos),
  multiUpload,
  UPLOAD_PATHS
};