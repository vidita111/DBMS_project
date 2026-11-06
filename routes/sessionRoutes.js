const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const sessionController = require('../controllers/sessionController');
const { verifyToken } = require('../middleware/auth');

// Apply verifyToken to all routes
router.use(verifyToken);

const sessionValidation = [
  body('exam_id').isInt().withMessage('Exam ID must be an integer'),
  body('exam_date').isDate().withMessage('Exam date must be a valid date (YYYY-MM-DD)'),
  body('start_time').notEmpty().withMessage('Start time is required'),
  body('end_time').notEmpty().withMessage('End time is required')
];

// GET / - Get all sessions
router.get('/', sessionController.getAllSessions);

// GET /:id - Get session by ID
router.get(
  '/:id',
  [param('id').isInt().withMessage('Session ID must be an integer')],
  sessionController.getSessionById
);

// POST / - Create session
router.post('/', sessionValidation, sessionController.createSession);

// PUT /:id - Update session
router.put(
  '/:id',
  [
    param('id').isInt().withMessage('Session ID must be an integer'),
    ...sessionValidation
  ],
  sessionController.updateSession
);

// DELETE /:id - Delete session
router.delete(
  '/:id',
  [param('id').isInt().withMessage('Session ID must be an integer')],
  sessionController.deleteSession
);

// POST /:id/rooms - Assign a room to a session
router.post(
  '/:id/rooms',
  [
    param('id').isInt().withMessage('Session ID must be an integer'),
    body('room_id').isInt().withMessage('Room ID must be an integer')
  ],
  sessionController.addRoomToSession
);

// DELETE /:id/rooms/:roomId - Remove a room from a session
router.delete(
  '/:id/rooms/:roomId',
  [
    param('id').isInt().withMessage('Session ID must be an integer'),
    param('roomId').isInt().withMessage('Room ID must be an integer')
  ],
  sessionController.removeRoomFromSession
);

// GET /:id/rooms - Get rooms assigned to a session
router.get(
  '/:id/rooms',
  [param('id').isInt().withMessage('Session ID must be an integer')],
  sessionController.getSessionRooms
);

module.exports = router;
