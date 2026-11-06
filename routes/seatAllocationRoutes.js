const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const seatAllocationController = require('../controllers/seatAllocationController');
const { verifyToken } = require('../middleware/auth');

// Apply verifyToken to all routes
router.use(verifyToken);

// GET / - Get all seat allocations
router.get('/', seatAllocationController.getAllocations);

// POST /auto-allocate - Automatically allocate seats for a session
router.post(
  '/auto-allocate',
  [body('session_id').isInt().withMessage('Session ID must be an integer')],
  seatAllocationController.autoAllocate
);

// POST / - Manually allocate a seat
router.post(
  '/',
  [
    body('session_id').isInt().withMessage('Session ID must be an integer'),
    body('student_id').isInt().withMessage('Student ID must be an integer'),
    body('room_id').isInt().withMessage('Room ID must be an integer'),
    body('seat_number').isInt().withMessage('Seat number must be an integer')
  ],
  seatAllocationController.createAllocation
);

// DELETE /session/:sessionId - Delete all allocations for a session
router.delete(
  '/session/:sessionId',
  [param('sessionId').isInt().withMessage('Session ID must be an integer')],
  seatAllocationController.deleteSessionAllocations
);

// GET /session/:sessionId/seat-map - Get seat map for a session
router.get(
  '/session/:sessionId/seat-map',
  [param('sessionId').isInt().withMessage('Session ID must be an integer')],
  seatAllocationController.getSessionSeatMap
);

// DELETE /:id - Delete a specific seat allocation
router.delete(
  '/:id',
  [param('id').isInt().withMessage('Allocation ID must be an integer')],
  seatAllocationController.deleteAllocation
);

module.exports = router;
