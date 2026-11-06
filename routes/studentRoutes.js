const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const studentController = require('../controllers/studentController');
const { verifyToken } = require('../middleware/auth');

// Apply verifyToken to all routes
router.use(verifyToken);

const studentValidation = [
  body('roll_no').notEmpty().withMessage('Roll number is required'),
  body('name').notEmpty().withMessage('Name is required'),
  body('department').notEmpty().withMessage('Department is required'),
  body('semester')
    .isInt({ min: 1, max: 10 }).withMessage('Semester must be an integer between 1 and 10')
];

// GET / - Get all students
router.get('/', studentController.getAllStudents);

// GET /:id - Get student by ID
router.get(
  '/:id',
  [param('id').isInt().withMessage('Student ID must be an integer')],
  studentController.getStudentById
);

// POST / - Create student
router.post('/', studentValidation, studentController.createStudent);

// PUT /:id - Update student
router.put(
  '/:id',
  [
    param('id').isInt().withMessage('Student ID must be an integer'),
    ...studentValidation
  ],
  studentController.updateStudent
);

// DELETE /:id - Delete student
router.delete(
  '/:id',
  [param('id').isInt().withMessage('Student ID must be an integer')],
  studentController.deleteStudent
);

// GET /:id/exams - Get exams for a student
router.get(
  '/:id/exams',
  [param('id').isInt().withMessage('Student ID must be an integer')],
  studentController.getStudentExams
);

module.exports = router;
