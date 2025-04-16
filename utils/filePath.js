// utils/fileHelper.js - Utilidad para ayudar con la carga y validación de archivos

const fs = require('fs');
const path = require('path');
const { UPLOAD_PATHS } = require('../config/upload');

/**
 * Verifica si un archivo existe en el sistema de archivos
 * @param {string} filePath - Ruta completa del archivo
 * @returns {boolean} - true si existe, false en caso contrario
 */
const fileExists = (filePath) => {
  try {
    return fs.existsSync(filePath);
  } catch (error) {
    console.error(`Error verificando existencia de archivo: ${error.message}`);
    return false;
  }
};

/**
 * Obtiene la ruta completa de un archivo en el sistema de almacenamiento
 * @param {string} fileName - Nombre del archivo
 * @param {string} fileType - Tipo de archivo (contracts, identities, etc.)
 * @returns {string} - Ruta completa del archivo
 */
const getFilePath = (fileName, fileType) => {
  if (!fileName) return null;
  
  const uploadPath = UPLOAD_PATHS[fileType];
  if (!uploadPath) {
    throw new Error(`Tipo de archivo inválido: ${fileType}`);
  }
  
  return path.join(uploadPath, fileName);
};

/**
 * Registra información sobre los archivos recibidos en una solicitud
 * @param {Object} req - Objeto de solicitud de Express
 */
const logRequestFiles = (req) => {
  console.log('===== Información de archivos en la solicitud =====');
  
  // Registrar información sobre req.file (para single)
  if (req.file) {
    console.log('req.file:', {
      fieldname: req.file.fieldname,
      originalname: req.file.originalname,
      encoding: req.file.encoding,
      mimetype: req.file.mimetype,
      destination: req.file.destination,
      filename: req.file.filename,
      path: req.file.path,
      size: req.file.size
    });
  } else {
    console.log('req.file: No existe');
  }
  
  // Registrar información sobre req.files (para multiple/fields)
  if (req.files) {
    console.log('req.files:');
    Object.keys(req.files).forEach(fieldname => {
      const files = req.files[fieldname];
      console.log(`Campo ${fieldname}:`);
      files.forEach((file, index) => {
        console.log(`  Archivo ${index + 1}:`, {
          originalname: file.originalname,
          encoding: file.encoding,
          mimetype: file.mimetype,
          destination: file.destination,
          filename: file.filename,
          path: file.path,
          size: file.size
        });
      });
    });
  } else {
    console.log('req.files: No existe');
  }
  
  // Registrar información sobre req.body
  console.log('req.body (Campos relacionados con archivos):');
  const fileFields = ['contractImage', 'identityImage', 'commercialRegisterImage', 
                       'checkImage', 'attachmentFile', 'logoImage'];
  
  fileFields.forEach(field => {
    if (req.body[field]) {
      console.log(`  ${field}: ${req.body[field]}`);
    }
  });
  
  console.log('=================================================');
};

/**
 * Verifica y corrige problemas comunes con los directorios de carga
 */
const verifyUploadDirectories = () => {
  console.log('Verificando directorios de carga...');
  
  Object.entries(UPLOAD_PATHS).forEach(([key, dir]) => {
    try {
      // Verificar si el directorio existe
      if (!fs.existsSync(dir)) {
        console.log(`Creando directorio faltante: ${dir}`);
        fs.mkdirSync(dir, { recursive: true });
      }
      
      // Verificar permisos
      fs.accessSync(dir, fs.constants.R_OK | fs.constants.W_OK);
      console.log(`✓ Directorio ${key} (${dir}) existe y tiene permisos correctos`);
    } catch (error) {
      console.error(`✗ Error con directorio ${key} (${dir}): ${error.message}`);
    }
  });
};

/**
 * Limpia caracteres no válidos de un nombre de archivo
 * @param {string} filename - Nombre del archivo original
 * @returns {string} - Nombre de archivo limpio
 */
const sanitizeFilename = (filename) => {
  if (!filename) return '';
  
  // Eliminar caracteres no válidos para nombres de archivo
  return filename
    .replace(/[\\/:*?"<>|]/g, '_') // Caracteres no válidos en Windows
    .replace(/\s+/g, '_');         // Espacios a guiones bajos
};

module.exports = {
  fileExists,
  getFilePath,
  logRequestFiles,
  verifyUploadDirectories,
  sanitizeFilename
};