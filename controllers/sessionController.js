const { pool } = require('../config/db');
const { asyncHandler, ApiError } = require('../utils/helpers');

// GET /api/sessions
const getAllSessions = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;
  const { exam_id } = req.query;

  let query = `
    SELECT es.session_id, es.exam_id, es.exam_date, es.start_time, es.end_time,
           e.subject_code, e.subject_name
    FROM exam_sessions es
    JOIN exams e ON es.exam_id = e.exam_id`;
  let countQuery = 'SELECT COUNT(*) AS total FROM exam_sessions es';
  const params = [];
  const countParams = [];

  if (exam_id) {
    const whereClause = ' WHERE es.exam_id = ?';
    query += whereClause;
    countQuery += whereClause;
    params.push(exam_id);
    countParams.push(exam_id);
  }

  query += ' ORDER BY es.exam_date DESC, es.start_time DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const [rows] = await pool.query(query, params);
  const [countRows] = await pool.query(countQuery, countParams);
  const total = countRows[0].total;

  res.json({
    success: true,
    data: rows,
    message: 'Sessions fetched successfully',
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

// GET /api/sessions/:id
const getSessionById = asyncHandler(async (req, res) => {
  const [sessionRows] = await pool.query(
    `SELECT es.session_id, es.exam_id, es.exam_date, es.start_time, es.end_time,
            e.subject_code, e.subject_name
     FROM exam_sessions es
     JOIN exams e ON es.exam_id = e.exam_id
     WHERE es.session_id = ?`,
    [req.params.id]
  );

  if (sessionRows.length === 0) {
    throw new ApiError(404, 'Session not found');
  }

  const [rooms] = await pool.query(
    `SELECT sr.session_room_id, r.room_id, r.room_number, r.capacity
     FROM session_rooms sr
     JOIN rooms r ON sr.room_id = r.room_id
     WHERE sr.session_id = ?`,
    [req.params.id]
  );

  const [regCount] = await pool.query(
    'SELECT COUNT(*) AS registered_students FROM exam_registrations WHERE session_id = ?',
    [req.params.id]
  );

  res.json({
    success: true,
    data: {
      ...sessionRows[0],
      rooms,
      registered_students: regCount[0].registered_students,
    },
    message: 'Session fetched successfully',
  });
});

// POST /api/sessions
const createSession = asyncHandler(async (req, res) => {
  const { exam_id, exam_date, start_time, end_time } = req.body;

  if (!exam_id || !exam_date || !start_time || !end_time) {
    throw new ApiError(400, 'Exam ID, exam date, start time, and end time are required');
  }

  // Verify exam exists
  const [exam] = await pool.query('SELECT * FROM exams WHERE exam_id = ?', [exam_id]);
  if (exam.length === 0) {
    throw new ApiError(400, 'Referenced exam does not exist');
  }

  try {
    const [result] = await pool.query(
      'INSERT INTO exam_sessions (exam_id, exam_date, start_time, end_time) VALUES (?, ?, ?, ?)',
      [exam_id, exam_date, start_time, end_time]
    );

    const [session] = await pool.query(
      `SELECT es.*, e.subject_code, e.subject_name
       FROM exam_sessions es
       JOIN exams e ON es.exam_id = e.exam_id
       WHERE es.session_id = ?`,
      [result.insertId]
    );

    res.status(201).json({
      success: true,
      data: session[0],
      message: 'Session created successfully',
    });
  } catch (err) {
    if (err.code === 'ER_NO_REFERENCED_ROW_2') {
      throw new ApiError(400, 'Referenced exam does not exist');
    }
    throw err;
  }
});

// PUT /api/sessions/:id
const updateSession = asyncHandler(async (req, res) => {
  const { exam_id, exam_date, start_time, end_time } = req.body;

  const [existing] = await pool.query(
    'SELECT * FROM exam_sessions WHERE session_id = ?',
    [req.params.id]
  );

  if (existing.length === 0) {
    throw new ApiError(404, 'Session not found');
  }

  try {
    await pool.query(
      'UPDATE exam_sessions SET exam_id = ?, exam_date = ?, start_time = ?, end_time = ? WHERE session_id = ?',
      [
        exam_id || existing[0].exam_id,
        exam_date || existing[0].exam_date,
        start_time || existing[0].start_time,
        end_time || existing[0].end_time,
        req.params.id,
      ]
    );

    const [updated] = await pool.query(
      `SELECT es.*, e.subject_code, e.subject_name
       FROM exam_sessions es
       JOIN exams e ON es.exam_id = e.exam_id
       WHERE es.session_id = ?`,
      [req.params.id]
    );

    res.json({
      success: true,
      data: updated[0],
      message: 'Session updated successfully',
    });
  } catch (err) {
    if (err.code === 'ER_NO_REFERENCED_ROW_2') {
      throw new ApiError(400, 'Referenced exam does not exist');
    }
    throw err;
  }
});

// DELETE /api/sessions/:id
const deleteSession = asyncHandler(async (req, res) => {
  const [existing] = await pool.query(
    'SELECT * FROM exam_sessions WHERE session_id = ?',
    [req.params.id]
  );

  if (existing.length === 0) {
    throw new ApiError(404, 'Session not found');
  }

  try {
    await pool.query('DELETE FROM exam_sessions WHERE session_id = ?', [req.params.id]);

    res.json({
      success: true,
      data: null,
      message: 'Session deleted successfully',
    });
  } catch (err) {
    if (err.code === 'ER_ROW_IS_REFERENCED_2') {
      throw new ApiError(400, 'Cannot delete session with existing registrations, allocations, or assignments');
    }
    throw err;
  }
});

// POST /api/sessions/:id/rooms
const assignRoom = asyncHandler(async (req, res) => {
  const { room_id } = req.body;
  const session_id = req.params.id;

  if (!room_id) {
    throw new ApiError(400, 'Room ID is required');
  }

  // Verify session exists
  const [session] = await pool.query(
    'SELECT * FROM exam_sessions WHERE session_id = ?',
    [session_id]
  );
  if (session.length === 0) {
    throw new ApiError(404, 'Session not found');
  }

  // Verify room exists
  const [room] = await pool.query(
    'SELECT * FROM rooms WHERE room_id = ?',
    [room_id]
  );
  if (room.length === 0) {
    throw new ApiError(400, 'Room does not exist');
  }

  try {
    const [result] = await pool.query(
      'INSERT INTO session_rooms (session_id, room_id) VALUES (?, ?)',
      [session_id, room_id]
    );

    res.status(201).json({
      success: true,
      data: {
        session_room_id: result.insertId,
        session_id: parseInt(session_id),
        room_id,
        room_number: room[0].room_number,
        capacity: room[0].capacity,
      },
      message: 'Room assigned to session successfully',
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      throw new ApiError(409, 'This room is already assigned to this session');
    }
    if (err.code === 'ER_NO_REFERENCED_ROW_2') {
      throw new ApiError(400, 'Invalid session or room reference');
    }
    throw err;
  }
});

// DELETE /api/sessions/:id/rooms/:roomId
const removeRoom = asyncHandler(async (req, res) => {
  const { id: session_id, roomId: room_id } = req.params;

  const [existing] = await pool.query(
    'SELECT * FROM session_rooms WHERE session_id = ? AND room_id = ?',
    [session_id, room_id]
  );

  if (existing.length === 0) {
    throw new ApiError(404, 'Room assignment not found for this session');
  }

  await pool.query(
    'DELETE FROM session_rooms WHERE session_id = ? AND room_id = ?',
    [session_id, room_id]
  );

  res.json({
    success: true,
    data: null,
    message: 'Room removed from session successfully',
  });
});

// GET /api/sessions/:id/rooms
const getSessionRooms = asyncHandler(async (req, res) => {
  const [session] = await pool.query(
    'SELECT * FROM exam_sessions WHERE session_id = ?',
    [req.params.id]
  );

  if (session.length === 0) {
    throw new ApiError(404, 'Session not found');
  }

  const [rows] = await pool.query(
    `SELECT sr.session_room_id, r.room_id, r.room_number, r.capacity
     FROM session_rooms sr
     JOIN rooms r ON sr.room_id = r.room_id
     WHERE sr.session_id = ?
     ORDER BY r.room_number`,
    [req.params.id]
  );

  res.json({
    success: true,
    data: rows,
    message: 'Session rooms fetched successfully',
  });
});

module.exports = {
  getAllSessions,
  getSessionById,
  createSession,
  updateSession,
  deleteSession,
  assignRoom,
  removeRoom,
  getSessionRooms,
};
