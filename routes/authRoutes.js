const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const { verifyToken } = require('../middleware/auth');

// POST /register
router.post(
  '/register',
  [
    body('username')
      .notEmpty().withMessage('Username is required')
      .isLength({ min: 3, max: 50 }).withMessage('Username must be between 3 and 50 characters'),
    body('password')
      .isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('name')
      .notEmpty().withMessage('Name is required')
  ],
  authController.register
);

// POST /login
router.post(
  '/login',
  [
    body('username').notEmpty().withMessage('Username is required'),
    body('password').notEmpty().withMessage('Password is required')
  ],
  authController.login
);

// GET /profile
router.get('/profile', verifyToken, authController.getProfile);

module.exports = router;
