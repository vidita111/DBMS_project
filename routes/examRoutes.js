const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const examController = require('../controllers/examController');
const { verifyToken } = require('../middleware/auth');

// Apply verifyToken to all routes
router.use(verifyToken);

const examValidation = [
  body('subject_code').notEmpty().withMessage('Subject code is required'),
  body('subject_name').notEmpty().withMessage('Subject name is required')
];

// GET / - Get all exams
router.get('/', examController.getAllExams);

// GET /:id - Get exam by ID
router.get(
  '/:id',
  [param('id').isInt().withMessage('Exam ID must be an integer')],
  examController.getExamById
);

// POST / - Create exam
router.post('/', examValidation, examController.createExam);

// PUT /:id - Update exam
router.put(
  '/:id',
  [
    param('id').isInt().withMessage('Exam ID must be an integer'),
    ...examValidation
  ],
  examController.updateExam
);

// DELETE /:id - Delete exam
router.delete(
  '/:id',
  [param('id').isInt().withMessage('Exam ID must be an integer')],
  examController.deleteExam
);

module.exports = router;
