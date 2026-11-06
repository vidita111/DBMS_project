const { pool } = require('../config/db');
const { asyncHandler, ApiError } = require('../utils/helpers');

// GET /api/attendance
const getAttendance = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;
  const { session_id, student_id, status } = req.query;

  let query = `
    SELECT ea.attendance_id, ea.session_id, ea.student_id, ea.status, ea.marked_at,
           s.roll_no, s.name AS student_name, s.department,
           es.exam_date, es.start_time, es.end_time,
           e.subject_code, e.subject_name
    FROM exam_attendance ea
    JOIN students s ON ea.student_id = s.student_id
    JOIN exam_sessions es ON ea.session_id = es.session_id
    JOIN exams e ON es.exam_id = e.exam_id`;
  let countQuery = 'SELECT COUNT(*) AS total FROM exam_attendance ea';

  const params = [];
  const countParams = [];
  const conditions = [];

  if (session_id) {
    conditions.push('ea.session_id = ?');
    params.push(session_id);
    countParams.push(session_id);
  }

  if (student_id) {
    conditions.push('ea.student_id = ?');
    params.push(student_id);
    countParams.push(student_id);
  }

  if (status) {
    conditions.push('ea.status = ?');
    params.push(status);
    countParams.push(status);
  }

  if (conditions.length > 0) {
    const whereClause = ' WHERE ' + conditions.join(' AND ');
    query += whereClause;
    countQuery += whereClause;
  }

  query += ' ORDER BY ea.marked_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const [rows] = await pool.query(query, params);
  const [countRows] = await pool.query(countQuery, countParams);
  const total = countRows[0].total;

  res.json({
    success: true,
    data: rows,
    message: 'Attendance records fetched successfully',
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

// POST /api/attendance
const markAttendance = asyncHandler(async (req, res) => {
  const { session_id, student_id, status } = req.body;

  if (!session_id || !student_id || !status) {
    throw new ApiError(400, 'Session ID, Student ID, and status are required');
  }

  if (!['Present', 'Absent'].includes(status)) {
    throw new ApiError(400, "Status must be 'Present' or 'Absent'");
  }

  try {
    // Use INSERT ... ON DUPLICATE KEY UPDATE for upsert behaviour
    const [result] = await pool.query(
      `INSERT INTO exam_attendance (session_id, student_id, status)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE status = VALUES(status), marked_at = CURRENT_TIMESTAMP`,
      [session_id, student_id, status]
    );

    const [attendance] = await pool.query(
      `SELECT ea.attendance_id, ea.session_id, ea.student_id, ea.status, ea.marked_at,
              s.roll_no, s.name AS student_name
       FROM exam_attendance ea
       JOIN students s ON ea.student_id = s.student_id
       WHERE ea.session_id = ? AND ea.student_id = ?`,
      [session_id, student_id]
    );

    const isNew = result.affectedRows === 1;

    res.status(isNew ? 201 : 200).json({
      success: true,
      data: attendance[0],
      message: isNew ? 'Attendance marked successfully' : 'Attendance updated successfully',
    });
  } catch (err) {
    if (err.code === 'ER_NO_REFERENCED_ROW_2') {
      throw new ApiError(400, 'Invalid session or student reference');
    }
    throw err;
  }
});

// POST /api/attendance/bulk
const bulkMarkAttendance = asyncHandler(async (req, res) => {
  const { session_id, attendances } = req.body;

  if (!session_id || !attendances || !Array.isArray(attendances) || attendances.length === 0) {
    throw new ApiError(400, 'Session ID and a non-empty array of attendances are required');
  }

  // Verify session exists
  const [session] = await pool.query(
    'SELECT * FROM exam_sessions WHERE session_id = ?',
    [session_id]
  );
  if (session.length === 0) {
    throw new ApiError(404, 'Session not found');
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const results = { marked: [], errors: [] };

    for (const entry of attendances) {
      const { student_id, status } = entry;

      if (!student_id || !status || !['Present', 'Absent'].includes(status)) {
        results.errors.push({
          student_id,
          reason: 'Missing student_id or invalid status',
        });
        continue;
      }

      try {
        await connection.query(
          `INSERT INTO exam_attendance (session_id, student_id, status)
           VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE status = VALUES(status), marked_at = CURRENT_TIMESTAMP`,
          [session_id, student_id, status]
        );
        results.marked.push({ student_id, status });
      } catch (err) {
        if (err.code === 'ER_NO_REFERENCED_ROW_2') {
          results.errors.push({ student_id, reason: 'Student not found' });
        } else {
          throw err;
        }
      }
    }

    await connection.commit();

    res.status(201).json({
      success: true,
      data: results,
      message: `Marked ${results.marked.length} attendances, ${results.errors.length} errors`,
    });
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
});

// GET /api/attendance/session/:sessionId/stats
const getSessionAttendanceStats = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;

  const [session] = await pool.query(
    'SELECT * FROM exam_sessions WHERE session_id = ?',
    [sessionId]
  );
  if (session.length === 0) {
    throw new ApiError(404, 'Session not found');
  }

  const [stats] = await pool.query(
    `SELECT
       COUNT(*) AS total_marked,
       SUM(CASE WHEN status = 'Present' THEN 1 ELSE 0 END) AS present_count,
       SUM(CASE WHEN status = 'Absent' THEN 1 ELSE 0 END) AS absent_count
     FROM exam_attendance
     WHERE session_id = ?`,
    [sessionId]
  );

  const [registered] = await pool.query(
    'SELECT COUNT(*) AS total_registered FROM exam_registrations WHERE session_id = ?',
    [sessionId]
  );

  res.json({
    success: true,
    data: {
      session_id: parseInt(sessionId),
      total_registered: registered[0].total_registered,
      total_marked: stats[0].total_marked,
      present_count: parseInt(stats[0].present_count) || 0,
      absent_count: parseInt(stats[0].absent_count) || 0,
      unmarked_count: registered[0].total_registered - stats[0].total_marked,
    },
    message: 'Attendance stats fetched successfully',
  });
});

module.exports = {
  getAttendance,
  markAttendance,
  bulkMarkAttendance,
  getSessionAttendanceStats,
};
