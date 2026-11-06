const { pool } = require('../config/db');
const { asyncHandler, ApiError } = require('../utils/helpers');

// GET /api/invigilation
const getAssignments = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;
  const { session_id, faculty_id } = req.query;

  let query = `
    SELECT ia.assignment_id, ia.session_id, ia.room_id, ia.faculty_id,
           f.employee_id, f.name AS faculty_name, f.department AS faculty_department,
           r.room_number, r.capacity,
           es.exam_date, es.start_time, es.end_time,
           e.subject_code, e.subject_name
    FROM invigilation_assignments ia
    JOIN faculty f ON ia.faculty_id = f.faculty_id
    JOIN rooms r ON ia.room_id = r.room_id
    JOIN exam_sessions es ON ia.session_id = es.session_id
    JOIN exams e ON es.exam_id = e.exam_id`;
  let countQuery = 'SELECT COUNT(*) AS total FROM invigilation_assignments ia';

  const params = [];
  const countParams = [];
  const conditions = [];

  if (session_id) {
    conditions.push('ia.session_id = ?');
    params.push(session_id);
    countParams.push(session_id);
  }

  if (faculty_id) {
    conditions.push('ia.faculty_id = ?');
    params.push(faculty_id);
    countParams.push(faculty_id);
  }

  if (conditions.length > 0) {
    const whereClause = ' WHERE ' + conditions.join(' AND ');
    query += whereClause;
    countQuery += whereClause;
  }

  query += ' ORDER BY ia.assignment_id DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const [rows] = await pool.query(query, params);
  const [countRows] = await pool.query(countQuery, countParams);
  const total = countRows[0].total;

  res.json({
    success: true,
    data: rows,
    message: 'Invigilation assignments fetched successfully',
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

// POST /api/invigilation
const assignInvigilator = asyncHandler(async (req, res) => {
  const { session_id, room_id, faculty_id } = req.body;

  if (!session_id || !room_id || !faculty_id) {
    throw new ApiError(400, 'Session ID, Room ID, and Faculty ID are required');
  }

  try {
    const [result] = await pool.query(
      'INSERT INTO invigilation_assignments (session_id, room_id, faculty_id) VALUES (?, ?, ?)',
      [session_id, room_id, faculty_id]
    );

    const [assignment] = await pool.query(
      `SELECT ia.assignment_id, ia.session_id, ia.room_id, ia.faculty_id,
              f.employee_id, f.name AS faculty_name,
              r.room_number
       FROM invigilation_assignments ia
       JOIN faculty f ON ia.faculty_id = f.faculty_id
       JOIN rooms r ON ia.room_id = r.room_id
       WHERE ia.assignment_id = ?`,
      [result.insertId]
    );

    res.status(201).json({
      success: true,
      data: assignment[0],
      message: 'Invigilator assigned successfully',
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      throw new ApiError(409, 'This invigilator is already assigned to this room for this session');
    }
    if (err.code === 'ER_NO_REFERENCED_ROW_2') {
      throw new ApiError(400, 'Invalid session, room, or faculty reference');
    }
    throw err;
  }
});

// POST /api/invigilation/bulk
const bulkAssign = asyncHandler(async (req, res) => {
  const { assignments } = req.body;

  if (!assignments || !Array.isArray(assignments) || assignments.length === 0) {
    throw new ApiError(400, 'A non-empty array of assignments is required');
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const results = { assigned: [], skipped: [], errors: [] };

    for (const assignment of assignments) {
      const { session_id, room_id, faculty_id } = assignment;

      if (!session_id || !room_id || !faculty_id) {
        results.errors.push({ ...assignment, reason: 'Missing required fields' });
        continue;
      }

      try {
        const [result] = await connection.query(
          'INSERT INTO invigilation_assignments (session_id, room_id, faculty_id) VALUES (?, ?, ?)',
          [session_id, room_id, faculty_id]
        );
        results.assigned.push({
          assignment_id: result.insertId,
          session_id,
          room_id,
          faculty_id,
        });
      } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
          results.skipped.push({ ...assignment, reason: 'Already assigned' });
        } else if (err.code === 'ER_NO_REFERENCED_ROW_2') {
          results.errors.push({ ...assignment, reason: 'Invalid reference' });
        } else {
          throw err;
        }
      }
    }

    await connection.commit();

    res.status(201).json({
      success: true,
      data: results,
      message: `Assigned ${results.assigned.length}, skipped ${results.skipped.length}, errors ${results.errors.length}`,
    });
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
});

// DELETE /api/invigilation/:id
const deleteAssignment = asyncHandler(async (req, res) => {
  const [existing] = await pool.query(
    'SELECT * FROM invigilation_assignments WHERE assignment_id = ?',
    [req.params.id]
  );

  if (existing.length === 0) {
    throw new ApiError(404, 'Invigilation assignment not found');
  }

  await pool.query(
    'DELETE FROM invigilation_assignments WHERE assignment_id = ?',
    [req.params.id]
  );

  res.json({
    success: true,
    data: null,
    message: 'Invigilation assignment deleted successfully',
  });
});

// GET /api/invigilation/session/:sessionId
const getSessionInvigilators = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;

  const [session] = await pool.query(
    'SELECT * FROM exam_sessions WHERE session_id = ?',
    [sessionId]
  );
  if (session.length === 0) {
    throw new ApiError(404, 'Session not found');
  }

  const [rows] = await pool.query(
    `SELECT ia.assignment_id, ia.session_id, ia.room_id, ia.faculty_id,
            f.employee_id, f.name AS faculty_name, f.department AS faculty_department,
            r.room_number, r.capacity
     FROM invigilation_assignments ia
     JOIN faculty f ON ia.faculty_id = f.faculty_id
     JOIN rooms r ON ia.room_id = r.room_id
     WHERE ia.session_id = ?
     ORDER BY r.room_number, f.name`,
    [sessionId]
  );

  res.json({
    success: true,
    data: rows,
    message: 'Session invigilators fetched successfully',
  });
});

module.exports = {
  getAssignments,
  assignInvigilator,
  createAssignment: assignInvigilator,
  bulkAssign,
  bulkCreateAssignments: bulkAssign,
  deleteAssignment,
  getSessionInvigilators,
  getSessionAssignments: getSessionInvigilators,
};
