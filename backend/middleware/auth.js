const jwt = require('jsonwebtoken');

module.exports = function (req, res, next) {
  try {
    // 1. Get the Authorization header
    const authHeader = req.header('Authorization');
    if (!authHeader) {
      return res.status(401).json({ message: 'Access Denied: No token provided' });
    }

    // 2. Extract the token (handles "Bearer <token>" format)
    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) {
      return res.status(401).json({ message: 'Access Denied: Invalid token format' });
    }

    // 3. Verify token and attach the payload to req.user
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecretkey');
    
    // This attaches { id, role } directly to req.user so server.js can find it!
    req.user = decoded; 
    
    next();
  } catch (err) {
    console.error('Auth Middleware Error:', err.message);
    res.status(401).json({ message: 'Token is invalid or expired' });
  }
};