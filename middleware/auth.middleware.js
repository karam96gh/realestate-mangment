// middleware/auth.middleware.js
const { verifyToken } = require('../config/auth');
const User = require('../models/user.model');

const authMiddleware = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authorization token required' });
    }
    
    const token = authHeader.split(' ')[1];
    
    // Verify token
    const decodedToken = verifyToken(token);
    
    // Get user from database to get the latest data (including companyId)
    const user = await User.findByPk(decodedToken.id);
    
    if (!user) {
      return res.status(401).json({ message: 'Invalid token: User not found' });
    }
    
    // Add user data to request
    req.user = {
      id: user.id,
      role: user.role,
      companyId: user.companyId
    };
    
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

module.exports = authMiddleware;