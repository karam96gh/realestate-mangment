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
const multiUpload = () => {
  const uploaders = {};
  Object.entries(UPLOAD_PATHS).forEach(([key, path]) => {
    uploaders[key] = createUploader(path);
  });
  
  return (req, res, next) => {
    console.log('Procesando archivos múltiples...');
    console.log('Campos de archivo esperados:', req.body);
    
    // Determinar qué tipos de archivos se están cargando
    const fileTypes = [];
    
    if (req.is('multipart/form-data')) {
      if (req.body.contractImage) fileTypes.push('contracts');
      if (req.body.identityImage) fileTypes.push('identities');
      if (req.body.commercialRegisterImage) fileTypes.push('identities');
      if (req.body.checkImage) fileTypes.push('checks');
      if (req.body.attachmentFile) fileTypes.push('attachments');
      if (req.body.logoImage) fileTypes.push('logos');
    }
    
    // Si no hay archivos para cargar, continuar
    if (fileTypes.length === 0) {
      console.log('No se detectaron archivos para procesar');
      return next();
    }
    
    // Procesar cada tipo de archivo
    let currentIndex = 0;
    const processNextFileType = (err) => {
      if (err) {
        console.error('Error procesando archivo:', err);
        return next(err);
      }
      
      if (currentIndex >= fileTypes.length) {
        console.log('Todos los archivos procesados correctamente');
        return next();
      }
      
      const fileType = fileTypes[currentIndex++];
      console.log(`Procesando archivo tipo: ${fileType}`);
      uploaders[fileType].single(fileType)(req, res, processNextFileType);
    };
    
    processNextFileType(null);
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