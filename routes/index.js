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

router.use('/auth', authRoutes);
router.use('/students', studentRoutes);
router.use('/faculty', facultyRoutes);
router.use('/rooms', roomRoutes);
router.use('/exams', examRoutes);
router.use('/sessions', sessionRoutes);
router.use('/registrations', registrationRoutes);
router.use('/seat-allocations', seatAllocationRoutes);
router.use('/invigilation', invigilationRoutes);
router.use('/attendance', attendanceRoutes);
router.use('/dashboard', dashboardRoutes);

module.exports = router;
