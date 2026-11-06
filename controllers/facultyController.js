const { pool } = require('../config/db');
const { asyncHandler, ApiError } = require('../utils/helpers');

// GET /api/faculty
const getAllFaculty = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;
  const { search, department } = req.query;

  let query = 'SELECT * FROM faculty';
  let countQuery = 'SELECT COUNT(*) AS total FROM faculty';
  const params = [];
  const countParams = [];
  const conditions = [];

  if (search) {
    conditions.push('(name LIKE ? OR employee_id LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
    countParams.push(`%${search}%`, `%${search}%`);
  }

  if (department) {
    conditions.push('department = ?');
    params.push(department);
    countParams.push(department);
  }

  if (conditions.length > 0) {
    const whereClause = ' WHERE ' + conditions.join(' AND ');
    query += whereClause;
    countQuery += whereClause;
  }

  query += ' ORDER BY faculty_id DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const [rows] = await pool.query(query, params);
  const [countRows] = await pool.query(countQuery, countParams);
  const total = countRows[0].total;

  res.json({
    success: true,
    data: rows,
    message: 'Faculty fetched successfully',
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

// GET /api/faculty/:id
const getFacultyById = asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    'SELECT * FROM faculty WHERE faculty_id = ?',
    [req.params.id]
  );

  if (rows.length === 0) {
    throw new ApiError(404, 'Faculty not found');
  }

  res.json({
    success: true,
    data: rows[0],
    message: 'Faculty fetched successfully',
  });
});

// POST /api/faculty
const createFaculty = asyncHandler(async (req, res) => {
  const { employee_id, name, department } = req.body;

  if (!employee_id || !name) {
    throw new ApiError(400, 'Employee ID and name are required');
  }

  try {
    const [result] = await pool.query(
      'INSERT INTO faculty (employee_id, name, department) VALUES (?, ?, ?)',
      [employee_id, name, department || null]
    );

    const [faculty] = await pool.query(
      'SELECT * FROM faculty WHERE faculty_id = ?',
      [result.insertId]
    );

    res.status(201).json({
      success: true,
      data: faculty[0],
      message: 'Faculty created successfully',
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      throw new ApiError(409, 'A faculty member with this employee ID already exists');
    }
    throw err;
  }
});

// PUT /api/faculty/:id
const updateFaculty = asyncHandler(async (req, res) => {
  const { employee_id, name, department } = req.body;

  const [existing] = await pool.query(
    'SELECT * FROM faculty WHERE faculty_id = ?',
    [req.params.id]
  );

  if (existing.length === 0) {
    throw new ApiError(404, 'Faculty not found');
  }

  try {
    await pool.query(
      'UPDATE faculty SET employee_id = ?, name = ?, department = ? WHERE faculty_id = ?',
      [
        employee_id || existing[0].employee_id,
        name || existing[0].name,
        department !== undefined ? department : existing[0].department,
        req.params.id,
      ]
    );

    const [updated] = await pool.query(
      'SELECT * FROM faculty WHERE faculty_id = ?',
      [req.params.id]
    );

    res.json({
      success: true,
      data: updated[0],
      message: 'Faculty updated successfully',
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      throw new ApiError(409, 'A faculty member with this employee ID already exists');
    }
    throw err;
  }
});

// DELETE /api/faculty/:id
const deleteFaculty = asyncHandler(async (req, res) => {
  const [existing] = await pool.query(
    'SELECT * FROM faculty WHERE faculty_id = ?',
    [req.params.id]
  );

  if (existing.length === 0) {
    throw new ApiError(404, 'Faculty not found');
  }

  try {
    await pool.query('DELETE FROM faculty WHERE faculty_id = ?', [req.params.id]);

    res.json({
      success: true,
      data: null,
      message: 'Faculty deleted successfully',
    });
  } catch (err) {
    if (err.code === 'ER_ROW_IS_REFERENCED_2') {
      throw new ApiError(400, 'Cannot delete faculty with existing invigilation assignments');
    }
    throw err;
  }
});

// GET /api/faculty/:id/assignments
const getFacultyAssignments = asyncHandler(async (req, res) => {
  const [faculty] = await pool.query(
    'SELECT * FROM faculty WHERE faculty_id = ?',
    [req.params.id]
  );

  if (faculty.length === 0) {
    throw new ApiError(404, 'Faculty not found');
  }

  const [rows] = await pool.query(
    `SELECT ia.assignment_id,
            es.session_id, es.exam_date, es.start_time, es.end_time,
            e.subject_code, e.subject_name,
            r.room_id, r.room_number, r.capacity
     FROM invigilation_assignments ia
     JOIN exam_sessions es ON ia.session_id = es.session_id
     JOIN exams e ON es.exam_id = e.exam_id
     JOIN rooms r ON ia.room_id = r.room_id
     WHERE ia.faculty_id = ?
     ORDER BY es.exam_date DESC, es.start_time DESC`,
    [req.params.id]
  );

  res.json({
    success: true,
    data: rows,
    message: 'Faculty assignments fetched successfully',
  });
});

module.exports = {
  getAllFaculty,
  getFacultyById,
  createFaculty,
  updateFaculty,
  deleteFaculty,
  getFacultyAssignments,
};
