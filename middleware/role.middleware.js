// Role middleware 
// Role middleware function
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
  
  // Export specific role check functions
  module.exports = {
    isAdmin: checkRole(['admin']),
    isManager: checkRole(['admin', 'manager']),
    isTenant: checkRole(['tenant']),
    isAdminOrManager: checkRole(['admin', 'manager']),
    checkRole // Export the generic function for custom role checks
  };