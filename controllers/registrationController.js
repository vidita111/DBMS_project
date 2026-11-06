const { pool } = require('../config/db');
const { asyncHandler, ApiError } = require('../utils/helpers');

// GET /api/registrations
const getRegistrations = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;
  const { session_id, student_id } = req.query;

  let query = `
    SELECT er.registration_id, er.registration_date,
           er.session_id, er.student_id,
           s.roll_no, s.name AS student_name, s.department,
           es.exam_date, es.start_time, es.end_time,
           e.subject_code, e.subject_name
    FROM exam_registrations er
    JOIN students s ON er.student_id = s.student_id
    JOIN exam_sessions es ON er.session_id = es.session_id
    JOIN exams e ON es.exam_id = e.exam_id`;
  let countQuery = `
    SELECT COUNT(*) AS total
    FROM exam_registrations er`;

  const params = [];
  const countParams = [];
  const conditions = [];

  if (session_id) {
    conditions.push('er.session_id = ?');
    params.push(session_id);
    countParams.push(session_id);
  }

  if (student_id) {
    conditions.push('er.student_id = ?');
    params.push(student_id);
    countParams.push(student_id);
  }

  if (conditions.length > 0) {
    const whereClause = ' WHERE ' + conditions.join(' AND ');
    query += whereClause;
    countQuery += whereClause;
  }

  query += ' ORDER BY er.registration_id DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const [rows] = await pool.query(query, params);
  const [countRows] = await pool.query(countQuery, countParams);
  const total = countRows[0].total;

  res.json({
    success: true,
    data: rows,
    message: 'Registrations fetched successfully',
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

// POST /api/registrations
const registerStudent = asyncHandler(async (req, res) => {
  const { session_id, student_id } = req.body;

  if (!session_id || !student_id) {
    throw new ApiError(400, 'Session ID and Student ID are required');
  }

  try {
    const [result] = await pool.query(
      'INSERT INTO exam_registrations (session_id, student_id) VALUES (?, ?)',
      [session_id, student_id]
    );

    const [registration] = await pool.query(
      `SELECT er.registration_id, er.session_id, er.student_id, er.registration_date,
              s.roll_no, s.name AS student_name
       FROM exam_registrations er
       JOIN students s ON er.student_id = s.student_id
       WHERE er.registration_id = ?`,
      [result.insertId]
    );

    res.status(201).json({
      success: true,
      data: registration[0],
      message: 'Student registered for exam session successfully',
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      throw new ApiError(409, 'Student is already registered for this session');
    }
    if (err.code === 'ER_NO_REFERENCED_ROW_2') {
      throw new ApiError(400, 'Invalid session or student reference');
    }
    throw err;
  }
});

// POST /api/registrations/bulk
const bulkRegister = asyncHandler(async (req, res) => {
  const { session_id, student_ids } = req.body;

  if (!session_id || !student_ids || !Array.isArray(student_ids) || student_ids.length === 0) {
    throw new ApiError(400, 'Session ID and a non-empty array of student IDs are required');
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

    const results = { registered: [], skipped: [], errors: [] };

    for (const student_id of student_ids) {
      try {
        await connection.query(
          'INSERT INTO exam_registrations (session_id, student_id) VALUES (?, ?)',
          [session_id, student_id]
        );
        results.registered.push(student_id);
      } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
          results.skipped.push({ student_id, reason: 'Already registered' });
        } else if (err.code === 'ER_NO_REFERENCED_ROW_2') {
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
      message: `Registered ${results.registered.length} students, ${results.skipped.length} skipped, ${results.errors.length} errors`,
    });
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
});

// DELETE /api/registrations/:id
const deleteRegistration = asyncHandler(async (req, res) => {
  const [existing] = await pool.query(
    'SELECT * FROM exam_registrations WHERE registration_id = ?',
    [req.params.id]
  );

  if (existing.length === 0) {
    throw new ApiError(404, 'Registration not found');
  }

  await pool.query(
    'DELETE FROM exam_registrations WHERE registration_id = ?',
    [req.params.id]
  );

  res.json({
    success: true,
    data: null,
    message: 'Registration deleted successfully',
  });
});

module.exports = {
  getRegistrations,
  registerStudent,
  createRegistration: registerStudent,
  bulkRegister,
  deleteRegistration,
};
