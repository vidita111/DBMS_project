const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const roomController = require('../controllers/roomController');
const { verifyToken } = require('../middleware/auth');

// Apply verifyToken to all routes
router.use(verifyToken);

const roomValidation = [
  body('room_number').notEmpty().withMessage('Room number is required'),
  body('capacity')
    .isInt({ min: 1 }).withMessage('Capacity must be a positive integer')
];

// GET / - Get all rooms
router.get('/', roomController.getAllRooms);

// GET /:id - Get room by ID
router.get(
  '/:id',
  [param('id').isInt().withMessage('Room ID must be an integer')],
  roomController.getRoomById
);

// POST / - Create room
router.post('/', roomValidation, roomController.createRoom);

// PUT /:id - Update room
router.put(
  '/:id',
  [
    param('id').isInt().withMessage('Room ID must be an integer'),
    ...roomValidation
  ],
  roomController.updateRoom
);

// DELETE /:id - Delete room
router.delete(
  '/:id',
  [param('id').isInt().withMessage('Room ID must be an integer')],
  roomController.deleteRoom
);

module.exports = router;
