const express = require('express');
const router = express.Router();

const authRoutes = require('./authRoutes');
const studentRoutes = require('./studentRoutes');
const facultyRoutes = require('./facultyRoutes');
const roomRoutes = require('./roomRoutes');
const examRoutes = require('./examRoutes');
const sessionRoutes = require('./sessionRoutes');
const registrationRoutes = require('./registrationRoutes');
const seatAllocationRoutes = require('./seatAllocationRoutes');
const invigilationRoutes = require('./invigilationRoutes');
const attendanceRoutes = require('./attendanceRoutes');
const dashboardRoutes = require('./dashboardRoutes');

router.use('/api/auth', authRoutes);
router.use('/api/students', studentRoutes);
router.use('/api/faculty', facultyRoutes);
router.use('/api/rooms', roomRoutes);
router.use('/api/exams', examRoutes);
router.use('/api/sessions', sessionRoutes);
router.use('/api/registrations', registrationRoutes);
router.use('/api/seat-allocations', seatAllocationRoutes);
router.use('/api/invigilation', invigilationRoutes);
router.use('/api/attendance', attendanceRoutes);
router.use('/api/dashboard', dashboardRoutes);

module.exports = router;
