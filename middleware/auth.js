const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'exam_seating_secret_key';

/**
 * Middleware to verify JWT token from Authorization header.
 * Extracts Bearer token, verifies it, and attaches decoded payload to req.user.
 */
const verifyToken = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.',
      });
    }

    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. Invalid token format. Use: Bearer <token>',
      });
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. Token is empty.',
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token has expired. Please login again.',
      });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token.',
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Failed to authenticate token.',
    });
  }
};

module.exports = { verifyToken };
