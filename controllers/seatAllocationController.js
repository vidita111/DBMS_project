const { pool } = require('../config/db');
const { asyncHandler, ApiError } = require('../utils/helpers');

// GET /api/seat-allocations
const getAllocations = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;
  const { session_id, room_id } = req.query;

  let query = `
    SELECT sa.allocation_id, sa.session_id, sa.student_id, sa.room_id, sa.seat_number,
           s.roll_no, s.name AS student_name, s.department,
           r.room_number, r.capacity
    FROM seat_allocations sa
    JOIN students s ON sa.student_id = s.student_id
    JOIN rooms r ON sa.room_id = r.room_id`;
  let countQuery = 'SELECT COUNT(*) AS total FROM seat_allocations sa';

  const params = [];
  const countParams = [];
  const conditions = [];

  if (session_id) {
    conditions.push('sa.session_id = ?');
    params.push(session_id);
    countParams.push(session_id);
  }

  if (room_id) {
    conditions.push('sa.room_id = ?');
    params.push(room_id);
    countParams.push(room_id);
  }

  if (conditions.length > 0) {
    const whereClause = ' WHERE ' + conditions.join(' AND ');
    query += whereClause;
    countQuery += whereClause;
  }

  query += ' ORDER BY sa.room_id, sa.seat_number LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const [rows] = await pool.query(query, params);
  const [countRows] = await pool.query(countQuery, countParams);
  const total = countRows[0].total;

  res.json({
    success: true,
    data: rows,
    message: 'Seat allocations fetched successfully',
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

// POST /api/seat-allocations/auto-allocate
const autoAllocate = asyncHandler(async (req, res) => {
  const { session_id } = req.body;

  if (!session_id) {
    throw new ApiError(400, 'Session ID is required');
  }

  // Verify session exists
  const [session] = await pool.query(
    'SELECT * FROM exam_sessions WHERE session_id = ?',
    [session_id]
  );
  if (session.length === 0) {
    throw new ApiError(404, 'Session not found');
  }

  // Get rooms assigned to this session
  const [rooms] = await pool.query(
    `SELECT r.room_id, r.room_number, r.capacity
     FROM session_rooms sr
     JOIN rooms r ON sr.room_id = r.room_id
     WHERE sr.session_id = ?
     ORDER BY r.room_number`,
    [session_id]
  );

  if (rooms.length === 0) {
    throw new ApiError(400, 'No rooms assigned to this session. Assign rooms first.');
  }

  // Get registered students not yet allocated
  const [students] = await pool.query(
    `SELECT er.student_id
     FROM exam_registrations er
     WHERE er.session_id = ?
       AND er.student_id NOT IN (
         SELECT sa.student_id FROM seat_allocations sa WHERE sa.session_id = ?
       )
     ORDER BY er.student_id`,
    [session_id, session_id]
  );

  if (students.length === 0) {
    throw new ApiError(400, 'No unallocated registered students found for this session');
  }

  // Calculate total capacity
  const totalCapacity = rooms.reduce((sum, r) => sum + r.capacity, 0);
  if (students.length > totalCapacity) {
    throw new ApiError(
      400,
      `Not enough room capacity. Need ${students.length} seats but only ${totalCapacity} available.`
    );
  }

  // Allocate seats sequentially across rooms
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const allocations = [];
    let studentIndex = 0;

    for (const room of rooms) {
      // Check how many seats are already taken in this room for this session
      const [existingSeats] = await connection.query(
        'SELECT COUNT(*) AS count FROM seat_allocations WHERE session_id = ? AND room_id = ?',
        [session_id, room.room_id]
      );
      let seatNumber = existingSeats[0].count + 1;

      while (studentIndex < students.length && seatNumber <= room.capacity) {
        await connection.query(
          'INSERT INTO seat_allocations (session_id, student_id, room_id, seat_number) VALUES (?, ?, ?, ?)',
          [session_id, students[studentIndex].student_id, room.room_id, seatNumber]
        );

        allocations.push({
          session_id,
          student_id: students[studentIndex].student_id,
          room_id: room.room_id,
          room_number: room.room_number,
          seat_number: seatNumber,
        });

        studentIndex++;
        seatNumber++;
      }
    }

    await connection.commit();

    res.status(201).json({
      success: true,
      data: {
        total_allocated: allocations.length,
        allocations,
      },
      message: `Successfully allocated ${allocations.length} seats`,
    });
  } catch (err) {
    await connection.rollback();
    if (err.code === 'ER_DUP_ENTRY') {
      throw new ApiError(409, 'Duplicate seat allocation detected');
    }
    throw err;
  } finally {
    connection.release();
  }
});

// POST /api/seat-allocations
const manualAllocate = asyncHandler(async (req, res) => {
  const { session_id, student_id, room_id, seat_number } = req.body;

  if (!session_id || !student_id || !room_id || !seat_number) {
    throw new ApiError(400, 'Session ID, Student ID, Room ID, and seat number are required');
  }

  try {
    const [result] = await pool.query(
      'INSERT INTO seat_allocations (session_id, student_id, room_id, seat_number) VALUES (?, ?, ?, ?)',
      [session_id, student_id, room_id, seat_number]
    );

    const [allocation] = await pool.query(
      `SELECT sa.allocation_id, sa.session_id, sa.student_id, sa.room_id, sa.seat_number,
              s.roll_no, s.name AS student_name,
              r.room_number
       FROM seat_allocations sa
       JOIN students s ON sa.student_id = s.student_id
       JOIN rooms r ON sa.room_id = r.room_id
       WHERE sa.allocation_id = ?`,
      [result.insertId]
    );

    res.status(201).json({
      success: true,
      data: allocation[0],
      message: 'Seat allocated successfully',
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      throw new ApiError(409, 'This seat is already allocated or student already has a seat in this session');
    }
    if (err.code === 'ER_NO_REFERENCED_ROW_2') {
      throw new ApiError(400, 'Invalid session, student, or room reference');
    }
    throw err;
  }
});

// DELETE /api/seat-allocations/:id
const deleteAllocation = asyncHandler(async (req, res) => {
  const [existing] = await pool.query(
    'SELECT * FROM seat_allocations WHERE allocation_id = ?',
    [req.params.id]
  );

  if (existing.length === 0) {
    throw new ApiError(404, 'Seat allocation not found');
  }

  await pool.query(
    'DELETE FROM seat_allocations WHERE allocation_id = ?',
    [req.params.id]
  );

  res.json({
    success: true,
    data: null,
    message: 'Seat allocation deleted successfully',
  });
});

// DELETE /api/seat-allocations/session/:sessionId
const deleteSessionAllocations = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;

  const [session] = await pool.query(
    'SELECT * FROM exam_sessions WHERE session_id = ?',
    [sessionId]
  );
  if (session.length === 0) {
    throw new ApiError(404, 'Session not found');
  }

  const [result] = await pool.query(
    'DELETE FROM seat_allocations WHERE session_id = ?',
    [sessionId]
  );

  res.json({
    success: true,
    data: { deleted_count: result.affectedRows },
    message: `Deleted ${result.affectedRows} seat allocations for session ${sessionId}`,
  });
});

// GET /api/seat-allocations/session/:sessionId/seat-map
const getSessionSeatMap = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;

  const [session] = await pool.query(
    'SELECT * FROM exam_sessions WHERE session_id = ?',
    [sessionId]
  );
  if (session.length === 0) {
    throw new ApiError(404, 'Session not found');
  }

  const [allocations] = await pool.query(
    `SELECT sa.allocation_id, sa.seat_number,
            s.student_id, s.roll_no, s.name AS student_name, s.department,
            r.room_id, r.room_number, r.capacity
     FROM seat_allocations sa
     JOIN students s ON sa.student_id = s.student_id
     JOIN rooms r ON sa.room_id = r.room_id
     WHERE sa.session_id = ?
     ORDER BY r.room_number, sa.seat_number`,
    [sessionId]
  );

  // Group by room
  const seatMap = {};
  for (const alloc of allocations) {
    const key = alloc.room_id;
    if (!seatMap[key]) {
      seatMap[key] = {
        room_id: alloc.room_id,
        room_number: alloc.room_number,
        capacity: alloc.capacity,
        seats: [],
      };
    }
    seatMap[key].seats.push({
      allocation_id: alloc.allocation_id,
      seat_number: alloc.seat_number,
      student_id: alloc.student_id,
      roll_no: alloc.roll_no,
      student_name: alloc.student_name,
      department: alloc.department,
    });
  }

  res.json({
    success: true,
    data: Object.values(seatMap),
    message: 'Seat map fetched successfully',
  });
});

module.exports = {
  getAllocations,
  autoAllocate,
  manualAllocate,
  deleteAllocation,
  deleteSessionAllocations,
  getSessionSeatMap,
};
