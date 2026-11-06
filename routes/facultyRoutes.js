const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const facultyController = require('../controllers/facultyController');
const { verifyToken } = require('../middleware/auth');

// Apply verifyToken to all routes
router.use(verifyToken);

const facultyValidation = [
  body('employee_id').notEmpty().withMessage('Employee ID is required'),
  body('name').notEmpty().withMessage('Name is required'),
  body('department').optional().isString().withMessage('Department must be a string')
];

// GET / - Get all faculty
router.get('/', facultyController.getAllFaculty);

// GET /:id - Get faculty by ID
router.get(
  '/:id',
  [param('id').isInt().withMessage('Faculty ID must be an integer')],
  facultyController.getFacultyById
);

// POST / - Create faculty
router.post('/', facultyValidation, facultyController.createFaculty);

// PUT /:id - Update faculty
router.put(
  '/:id',
  [
    param('id').isInt().withMessage('Faculty ID must be an integer'),
    ...facultyValidation
  ],
  facultyController.updateFaculty
);

// DELETE /:id - Delete faculty
router.delete(
  '/:id',
  [param('id').isInt().withMessage('Faculty ID must be an integer')],
  facultyController.deleteFaculty
);

// GET /:id/assignments - Get invigilation assignments for a faculty member
router.get(
  '/:id/assignments',
  [param('id').isInt().withMessage('Faculty ID must be an integer')],
  facultyController.getFacultyAssignments
);

module.exports = router;
