const { pool } = require('../config/db');
const { asyncHandler, ApiError } = require('../utils/helpers');

// GET /api/students
const getAllStudents = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;
  const { search, department } = req.query;

  let query = 'SELECT * FROM students';
  let countQuery = 'SELECT COUNT(*) AS total FROM students';
  const params = [];
  const countParams = [];
  const conditions = [];

  if (search) {
    conditions.push('(name LIKE ? OR roll_no LIKE ?)');
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

  query += ' ORDER BY student_id DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const [rows] = await pool.query(query, params);
  const [countRows] = await pool.query(countQuery, countParams);
  const total = countRows[0].total;

  res.json({
    success: true,
    data: rows,
    message: 'Students fetched successfully',
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

// GET /api/students/:id
const getStudentById = asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    'SELECT * FROM students WHERE student_id = ?',
    [req.params.id]
  );

  if (rows.length === 0) {
    throw new ApiError(404, 'Student not found');
  }

  res.json({
    success: true,
    data: rows[0],
    message: 'Student fetched successfully',
  });
});

// POST /api/students
const createStudent = asyncHandler(async (req, res) => {
  const { roll_no, name, department, semester } = req.body;

  if (!roll_no || !name) {
    throw new ApiError(400, 'Roll number and name are required');
  }

  try {
    const [result] = await pool.query(
      'INSERT INTO students (roll_no, name, department, semester) VALUES (?, ?, ?, ?)',
      [roll_no, name, department || null, semester || null]
    );

    const [student] = await pool.query(
      'SELECT * FROM students WHERE student_id = ?',
      [result.insertId]
    );

    res.status(201).json({
      success: true,
      data: student[0],
      message: 'Student created successfully',
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      throw new ApiError(409, 'A student with this roll number already exists');
    }
    throw err;
  }
});

// PUT /api/students/:id
const updateStudent = asyncHandler(async (req, res) => {
  const { roll_no, name, department, semester } = req.body;

  const [existing] = await pool.query(
    'SELECT * FROM students WHERE student_id = ?',
    [req.params.id]
  );

  if (existing.length === 0) {
    throw new ApiError(404, 'Student not found');
  }

  try {
    await pool.query(
      'UPDATE students SET roll_no = ?, name = ?, department = ?, semester = ? WHERE student_id = ?',
      [
        roll_no || existing[0].roll_no,
        name || existing[0].name,
        department !== undefined ? department : existing[0].department,
        semester !== undefined ? semester : existing[0].semester,
        req.params.id,
      ]
    );

    const [updated] = await pool.query(
      'SELECT * FROM students WHERE student_id = ?',
      [req.params.id]
    );

    res.json({
      success: true,
      data: updated[0],
      message: 'Student updated successfully',
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      throw new ApiError(409, 'A student with this roll number already exists');
    }
    throw err;
  }
});

// DELETE /api/students/:id
const deleteStudent = asyncHandler(async (req, res) => {
  const [existing] = await pool.query(
    'SELECT * FROM students WHERE student_id = ?',
    [req.params.id]
  );

  if (existing.length === 0) {
    throw new ApiError(404, 'Student not found');
  }

  try {
    await pool.query('DELETE FROM students WHERE student_id = ?', [req.params.id]);

    res.json({
      success: true,
      data: null,
      message: 'Student deleted successfully',
    });
  } catch (err) {
    if (err.code === 'ER_ROW_IS_REFERENCED_2') {
      throw new ApiError(400, 'Cannot delete student with existing registrations or allocations');
    }
    throw err;
  }
});

// GET /api/students/:id/exams
const getStudentExams = asyncHandler(async (req, res) => {
  const [student] = await pool.query(
    'SELECT * FROM students WHERE student_id = ?',
    [req.params.id]
  );

  if (student.length === 0) {
    throw new ApiError(404, 'Student not found');
  }

  const [rows] = await pool.query(
    `SELECT er.registration_id, er.registration_date,
            es.session_id, es.exam_date, es.start_time, es.end_time,
            e.exam_id, e.subject_code, e.subject_name,
            sa.seat_number, r.room_number
     FROM exam_registrations er
     JOIN exam_sessions es ON er.session_id = es.session_id
     JOIN exams e ON es.exam_id = e.exam_id
     LEFT JOIN seat_allocations sa ON sa.session_id = er.session_id AND sa.student_id = er.student_id
     LEFT JOIN rooms r ON sa.room_id = r.room_id
     WHERE er.student_id = ?
     ORDER BY es.exam_date DESC, es.start_time DESC`,
    [req.params.id]
  );

  res.json({
    success: true,
    data: rows,
    message: 'Student exams fetched successfully',
  });
});

module.exports = {
  getAllStudents,
  getStudentById,
  createStudent,
  updateStudent,
  deleteStudent,
  getStudentExams,
};
