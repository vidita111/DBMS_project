const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const attendanceController = require('../controllers/attendanceController');
const { verifyToken } = require('../middleware/auth');

// Apply verifyToken to all routes
router.use(verifyToken);

// GET / - Get attendance records
router.get('/', attendanceController.getAttendance);

// POST / - Mark attendance for a student
router.post(
  '/',
  [
    body('session_id').isInt().withMessage('Session ID must be an integer'),
    body('student_id').isInt().withMessage('Student ID must be an integer'),
    body('status')
      .isIn(['Present', 'Absent']).withMessage('Status must be either "Present" or "Absent"')
  ],
  attendanceController.markAttendance
);

// POST /bulk - Bulk mark attendance
router.post('/bulk', attendanceController.bulkMarkAttendance);

// GET /session/:sessionId/stats - Get attendance statistics for a session
router.get(
  '/session/:sessionId/stats',
  [param('sessionId').isInt().withMessage('Session ID must be an integer')],
  attendanceController.getSessionStats
);

// DELETE /:id - Delete an attendance record (for correction)
router.delete(
  '/:id',
  [param('id').isInt().withMessage('Attendance ID must be an integer')],
  attendanceController.deleteAttendance
);

module.exports = router;
