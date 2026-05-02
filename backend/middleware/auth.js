const jwt = require('jsonwebtoken');
const Booking = require('../models/Booking'); // Required for chat permissions

// ==========================================
// 1. Standard Authentication Middleware
// ==========================================
const auth = (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    const token = authHeader.split(' ')[1];
    
    // Verify the JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');

    // Attach user payload to the request object
    // We map decoded.userId to req.user.id to match the server.js routes
    req.user = {
      id: decoded.userId,
      name: decoded.name,
      role: decoded.role,
      proId: decoded.proId // Available if the user is a professional
    };

    next();
  } catch (err) {
    res.status(401).json({ message: 'Token is invalid or expired.' });
  }
};

// ==========================================
// 2. Chat Access Middleware (Message Permissions)
// ==========================================
const verifyChatAccess = async (req, res, next) => {
  try {
    const bookingId = req.params.bookingId;
    if (!bookingId) {
      return res.status(400).json({ message: 'Booking ID is required.' });
    }

    // Fetch the booking to check who is allowed to view this chat
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found.' });
    }

    // 1. Admin Override (Admins can view any chat for moderation)
    if (req.user.role === 'admin') return next();

    // 2. Client Check (Is the logged-in user the client who made the booking?)
    if (String(booking.userId) === String(req.user.id)) return next();

    // 3. Professional Check (Is the logged-in user the pro assigned to the booking?)
    if (req.user.proId && String(booking.professionalId) === String(req.user.proId)) return next();

    // If none of the above match, the user is an intruder. Deny access.
    return res.status(403).json({ message: 'Forbidden: You do not have permission to view this chat.' });
  } catch (err) {
    console.error('Chat Access Error:', err);
    res.status(500).json({ message: 'Server error verifying chat permissions.' });
  }
};

// Export `auth` as the primary function, and attach `verifyChatAccess` so it can be used when needed
auth.verifyChatAccess = verifyChatAccess;

module.exports = auth;