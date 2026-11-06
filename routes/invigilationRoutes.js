const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const invigilationController = require('../controllers/invigilationController');
const { verifyToken } = require('../middleware/auth');

// Apply verifyToken to all routes
router.use(verifyToken);

// GET / - Get all invigilation assignments
router.get('/', invigilationController.getAssignments);

// POST / - Create an invigilation assignment
router.post(
  '/',
  [
    body('session_id').isInt().withMessage('Session ID must be an integer'),
    body('room_id').isInt().withMessage('Room ID must be an integer'),
    body('faculty_id').isInt().withMessage('Faculty ID must be an integer')
  ],
  invigilationController.createAssignment
);

// POST /bulk - Bulk create invigilation assignments
router.post('/bulk', invigilationController.bulkCreateAssignments);

// DELETE /:id - Delete an invigilation assignment
router.delete(
  '/:id',
  [param('id').isInt().withMessage('Assignment ID must be an integer')],
  invigilationController.deleteAssignment
);

// GET /session/:sessionId - Get assignments for a specific session
router.get(
  '/session/:sessionId',
  [param('sessionId').isInt().withMessage('Session ID must be an integer')],
  invigilationController.getSessionAssignments
);

module.exports = router;
