const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const registrationController = require('../controllers/registrationController');
const { verifyToken } = require('../middleware/auth');

// Apply verifyToken to all routes
router.use(verifyToken);

// GET / - Get all registrations
router.get('/', registrationController.getRegistrations);

// POST / - Register a student for a session
router.post(
  '/',
  [
    body('session_id').isInt().withMessage('Session ID must be an integer'),
    body('student_id').isInt().withMessage('Student ID must be an integer')
  ],
  registrationController.createRegistration
);

// POST /bulk - Bulk register students for a session
router.post(
  '/bulk',
  [
    body('session_id').isInt().withMessage('Session ID must be an integer'),
    body('student_ids')
      .isArray({ min: 1 }).withMessage('student_ids must be a non-empty array')
  ],
  registrationController.bulkRegister
);

// DELETE /:id - Remove a registration
router.delete(
  '/:id',
  [param('id').isInt().withMessage('Registration ID must be an integer')],
  registrationController.deleteRegistration
);

module.exports = router;
