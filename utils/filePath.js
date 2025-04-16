// utils/filePath.js - Helper for generating full file paths and URLs

const path = require('path');
const { UPLOAD_PATHS } = require('../config/upload');

// Base URL for file access (adjust according to your deployment)
const BASE_URL = 'http://62.171.153.198:3101';

/**
 * Get the absolute file path for a stored file
 * @param {string} fileName - The name of the file
 * @param {string} fileType - The type of file ('contracts', 'identities', 'checks', 'attachments', 'logos')
 * @returns {string} The absolute file path
 */
const getFilePath = (fileName, fileType) => {
  if (!fileName) return null;
  
  const uploadPath = UPLOAD_PATHS[fileType];
  if (!uploadPath) {
    throw new Error(`Invalid file type: ${fileType}`);
  }
  
  return path.join(uploadPath, fileName);
};

/**
 * Generate a public URL for accessing the file
 * @param {string} fileName - The name of the file
 * @param {string} fileType - The type of file ('contracts', 'identities', 'checks', 'attachments', 'logos')
 * @returns {string} The public URL for the file
 */
const getFileUrl = (fileName, fileType) => {
  if (!fileName) return null;
  
  const uploadPath = UPLOAD_PATHS[fileType];
  if (!uploadPath) {
    throw new Error(`Invalid file type: ${fileType}`);
  }
  
  // Convert path like 'public/uploads/logos' to '/uploads/logos' for URL
  const publicPath = uploadPath.replace('public', '');
  
  return `${BASE_URL}${publicPath}/${fileName}`;
};

/**
 * Add file URLs to an object containing file names
 * @param {Object} obj - The object containing file name properties
 * @param {Object} fileFields - Mapping of object properties to file types, e.g. {logoImage: 'logos'}
 * @returns {Object} A new object with added URL properties
 */
const addFileUrls = (obj, fileFields) => {
  if (!obj) return obj;
  
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