const { pool } = require('../config/db');
const { asyncHandler, ApiError } = require('../utils/helpers');

// GET /api/exams
const getAllExams = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;
  const { search } = req.query;

  let query = 'SELECT * FROM exams';
  let countQuery = 'SELECT COUNT(*) AS total FROM exams';
  const params = [];
  const countParams = [];

  if (search) {
    const whereClause = ' WHERE subject_code LIKE ? OR subject_name LIKE ?';
    query += whereClause;
    countQuery += whereClause;
    params.push(`%${search}%`, `%${search}%`);
    countParams.push(`%${search}%`, `%${search}%`);
  }

  query += ' ORDER BY exam_id DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const [rows] = await pool.query(query, params);
  const [countRows] = await pool.query(countQuery, countParams);
  const total = countRows[0].total;

  res.json({
    success: true,
    data: rows,
    message: 'Exams fetched successfully',
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

// GET /api/exams/:id
const getExamById = asyncHandler(async (req, res) => {
  const [examRows] = await pool.query(
    'SELECT * FROM exams WHERE exam_id = ?',
    [req.params.id]
  );

  if (examRows.length === 0) {
    throw new ApiError(404, 'Exam not found');
  }

  const [sessions] = await pool.query(
    `SELECT es.session_id, es.exam_date, es.start_time, es.end_time
     FROM exam_sessions es
     WHERE es.exam_id = ?
     ORDER BY es.exam_date, es.start_time`,
    [req.params.id]
  );

  res.json({
    success: true,
    data: { ...examRows[0], sessions },
    message: 'Exam fetched successfully',
  });
});

// POST /api/exams
const createExam = asyncHandler(async (req, res) => {
  const { subject_code, subject_name } = req.body;

  if (!subject_code || !subject_name) {
    throw new ApiError(400, 'Subject code and subject name are required');
  }

  try {
    const [result] = await pool.query(
      'INSERT INTO exams (subject_code, subject_name) VALUES (?, ?)',
      [subject_code, subject_name]
    );

    const [exam] = await pool.query(
      'SELECT * FROM exams WHERE exam_id = ?',
      [result.insertId]
    );

    res.status(201).json({
      success: true,
      data: exam[0],
      message: 'Exam created successfully',
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      throw new ApiError(409, 'An exam with this subject code already exists');
    }
    throw err;
  }
});

// PUT /api/exams/:id
const updateExam = asyncHandler(async (req, res) => {
  const { subject_code, subject_name } = req.body;

  const [existing] = await pool.query(
    'SELECT * FROM exams WHERE exam_id = ?',
    [req.params.id]
  );

  if (existing.length === 0) {
    throw new ApiError(404, 'Exam not found');
  }

  try {
    await pool.query(
      'UPDATE exams SET subject_code = ?, subject_name = ? WHERE exam_id = ?',
      [
        subject_code || existing[0].subject_code,
        subject_name || existing[0].subject_name,
        req.params.id,
      ]
    );

    const [updated] = await pool.query(
      'SELECT * FROM exams WHERE exam_id = ?',
      [req.params.id]
    );

    res.json({
      success: true,
      data: updated[0],
      message: 'Exam updated successfully',
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      throw new ApiError(409, 'An exam with this subject code already exists');
    }
    throw err;
  }
});

// DELETE /api/exams/:id
const deleteExam = asyncHandler(async (req, res) => {
  const [existing] = await pool.query(
    'SELECT * FROM exams WHERE exam_id = ?',
    [req.params.id]
  );

  if (existing.length === 0) {
    throw new ApiError(404, 'Exam not found');
  }

  try {
    await pool.query('DELETE FROM exams WHERE exam_id = ?', [req.params.id]);

    res.json({
      success: true,
      data: null,
      message: 'Exam deleted successfully',
    });
  } catch (err) {
    if (err.code === 'ER_ROW_IS_REFERENCED_2') {
      throw new ApiError(400, 'Cannot delete exam with existing sessions');
    }
    throw err;
  }
});

module.exports = {
  getAllExams,
  getExamById,
  createExam,
  updateExam,
  deleteExam,
};
