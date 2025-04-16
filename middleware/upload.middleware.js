// middleware/uploadDebug.middleware.js - Middleware para depurar problemas de carga de archivos

const { logRequestFiles, verifyUploadDirectories } = require('../utils/fileHelper');

/**
 * Middleware que registra información detallada sobre la solicitud
 * de carga de archivos para depuración
 */
const uploadDebugLogger = (req, res, next) => {
  console.log('\n======== INICIO DEPURACIÓN DE CARGA DE ARCHIVOS ========');
  console.log(`Método: ${req.method}, URL: ${req.originalUrl}`);
  console.log(`Content-Type: ${req.get('Content-Type')}`);
  
  // Verificar si es una solicitud multipart/form-data
  const isMultipart = req.get('Content-Type')?.includes('multipart/form-data');
  console.log(`Es multipart/form-data: ${isMultipart ? 'SÍ' : 'NO'}`);
  
  // Registrar información sobre el cuerpo de la solicitud
  const bodyKeys = Object.keys(req.body);
  console.log(`Campos en req.body (${bodyKeys.length}):`, bodyKeys);
  
  // Registrar información sobre archivos
  logRequestFiles(req);
  
  // Verificar directorios de carga
  verifyUploadDirectories();
  
  console.log('======== FIN DEPURACIÓN DE CARGA DE ARCHIVOS ========\n');
  
  next();
};

/**
 * Middleware que verifica y corrige problemas comunes con multer y la carga de archivos
 */
const fixUploadIssues = (req, res, next) => {
  console.log('Verificando problemas comunes con carga de archivos...');
  
  // Problema: req.files es undefined porque el cliente no envió el encabezado Content-Type correcto
  if (!req.files && req.method === 'POST' && req.body && Object.keys(req.body).length > 0) {
    const possibleFileFields = ['contractImage', 'identityImage', 'commercialRegisterImage'];
    const fileFieldsPresent = possibleFileFields.some(field => req.body[field]);
    
    if (fileFieldsPresent) {
      console.warn('⚠️ Se detectaron campos de archivo en req.body pero req.files es undefined');
      console.warn('⚠️ Es posible que el cliente no esté enviando el encabezado Content-Type correcto');
      console.warn('⚠️ Debe ser "multipart/form-data" para cargas de archivos');
    }
  }
  
  // Continuar con la solicitud
  next();
};

module.exports = {
  uploadDebugLogger,
  fixUploadIssues
};