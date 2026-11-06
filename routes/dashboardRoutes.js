const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { verifyToken } = require('../middleware/auth');

// Apply verifyToken to all routes
router.use(verifyToken);

// GET / - Get dashboard summary statistics
router.get('/', dashboardController.getDashboardStats);

module.exports = router;
