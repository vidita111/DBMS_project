const { pool } = require('../config/db');
const { asyncHandler, ApiError } = require('../utils/helpers');

// GET /api/rooms
const getAllRooms = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;
  const { search } = req.query;

  let query = 'SELECT * FROM rooms';
  let countQuery = 'SELECT COUNT(*) AS total FROM rooms';
  const params = [];
  const countParams = [];

  if (search) {
    const whereClause = ' WHERE room_number LIKE ?';
    query += whereClause;
    countQuery += whereClause;
    params.push(`%${search}%`);
    countParams.push(`%${search}%`);
  }

  query += ' ORDER BY room_id DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const [rows] = await pool.query(query, params);
  const [countRows] = await pool.query(countQuery, countParams);
  const total = countRows[0].total;

  res.json({
    success: true,
    data: rows,
    message: 'Rooms fetched successfully',
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

// GET /api/rooms/:id
const getRoomById = asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    'SELECT * FROM rooms WHERE room_id = ?',
    [req.params.id]
  );

  if (rows.length === 0) {
    throw new ApiError(404, 'Room not found');
  }

  res.json({
    success: true,
    data: rows[0],
    message: 'Room fetched successfully',
  });
});

// POST /api/rooms
const createRoom = asyncHandler(async (req, res) => {
  const { room_number, capacity } = req.body;

  if (!room_number || !capacity) {
    throw new ApiError(400, 'Room number and capacity are required');
  }

  try {
    const [result] = await pool.query(
      'INSERT INTO rooms (room_number, capacity) VALUES (?, ?)',
      [room_number, capacity]
    );

    const [room] = await pool.query(
      'SELECT * FROM rooms WHERE room_id = ?',
      [result.insertId]
    );

    res.status(201).json({
      success: true,
      data: room[0],
      message: 'Room created successfully',
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      throw new ApiError(409, 'A room with this room number already exists');
    }
    throw err;
  }
});

// PUT /api/rooms/:id
const updateRoom = asyncHandler(async (req, res) => {
  const { room_number, capacity } = req.body;

  const [existing] = await pool.query(
    'SELECT * FROM rooms WHERE room_id = ?',
    [req.params.id]
  );

  if (existing.length === 0) {
    throw new ApiError(404, 'Room not found');
  }

  try {
    await pool.query(
      'UPDATE rooms SET room_number = ?, capacity = ? WHERE room_id = ?',
      [
        room_number || existing[0].room_number,
        capacity !== undefined ? capacity : existing[0].capacity,
        req.params.id,
      ]
    );

    const [updated] = await pool.query(
      'SELECT * FROM rooms WHERE room_id = ?',
      [req.params.id]
    );

    res.json({
      success: true,
      data: updated[0],
      message: 'Room updated successfully',
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      throw new ApiError(409, 'A room with this room number already exists');
    }
    throw err;
  }
});

// DELETE /api/rooms/:id
const deleteRoom = asyncHandler(async (req, res) => {
  const [existing] = await pool.query(
    'SELECT * FROM rooms WHERE room_id = ?',
    [req.params.id]
  );

  if (existing.length === 0) {
    throw new ApiError(404, 'Room not found');
  }

  try {
    await pool.query('DELETE FROM rooms WHERE room_id = ?', [req.params.id]);

    res.json({
      success: true,
      data: null,
      message: 'Room deleted successfully',
    });
  } catch (err) {
    if (err.code === 'ER_ROW_IS_REFERENCED_2') {
      throw new ApiError(400, 'Cannot delete room with existing session or allocation assignments');
    }
    throw err;
  }
});

module.exports = {
  getAllRooms,
  getRoomById,
  createRoom,
  updateRoom,
  deleteRoom,
};
