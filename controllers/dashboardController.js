const { pool } = require('../config/db');
const { asyncHandler, ApiError } = require('../utils/helpers');

// GET /api/dashboard/stats
const getDashboardStats = asyncHandler(async (req, res) => {
  const [[students]] = await pool.query('SELECT COUNT(*) AS count FROM students');
  const [[faculty]] = await pool.query('SELECT COUNT(*) AS count FROM faculty');
  const [[rooms]] = await pool.query('SELECT COUNT(*) AS count FROM rooms');
  const [[exams]] = await pool.query('SELECT COUNT(*) AS count FROM exams');
  const [[sessions]] = await pool.query('SELECT COUNT(*) AS count FROM exam_sessions');
  const [[upcomingSessions]] = await pool.query(
    'SELECT COUNT(*) AS count FROM exam_sessions WHERE exam_date >= CURDATE()'
  );

  res.json({
    success: true,
    data: {
      total_students: students.count,
      total_faculty: faculty.count,
      total_rooms: rooms.count,
      total_exams: exams.count,
      total_sessions: sessions.count,
      upcoming_sessions: upcomingSessions.count,
    },
    message: 'Dashboard stats fetched successfully',
  });
});

// GET /api/dashboard/upcoming
const getUpcomingSessions = asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit) || 10;

  const [rows] = await pool.query(
    `SELECT es.session_id, es.exam_id, es.exam_date, es.start_time, es.end_time,
            e.subject_code, e.subject_name,
            (SELECT COUNT(*) FROM exam_registrations er WHERE er.session_id = es.session_id) AS registered_students,
            (SELECT COUNT(*) FROM session_rooms sr WHERE sr.session_id = es.session_id) AS assigned_rooms
     FROM exam_sessions es
     JOIN exams e ON es.exam_id = e.exam_id
     WHERE es.exam_date >= CURDATE()
     ORDER BY es.exam_date ASC, es.start_time ASC
     LIMIT ?`,
    [limit]
  );

  res.json({
    success: true,
    data: rows,
    message: 'Upcoming sessions fetched successfully',
  });
});

module.exports = {
  getDashboardStats,
  getUpcomingSessions,
};
