const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');
const { asyncHandler, ApiError } = require('../utils/helpers');

// POST /api/auth/register
const register = asyncHandler(async (req, res) => {
  const { username, password, name } = req.body;

  if (!username || !password || !name) {
    throw new ApiError(400, 'Username, password, and name are required');
  }

  const salt = await bcrypt.genSalt(10);
  const password_hash = await bcrypt.hash(password, salt);

  try {
    const [result] = await pool.query(
      'INSERT INTO admins (username, password_hash, name) VALUES (?, ?, ?)',
      [username, password_hash, name]
    );

    const token = jwt.sign(
      { admin_id: result.insertId, username },
      process.env.JWT_SECRET || 'exam_mgmt_jwt_secret_key_2026',
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    res.status(201).json({
      success: true,
      data: { admin_id: result.insertId, username, name, token },
      message: 'Admin registered successfully',
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      throw new ApiError(409, 'Username already exists');
    }
    throw err;
  }
});

// POST /api/auth/login
const login = asyncHandler(async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    throw new ApiError(400, 'Username and password are required');
  }

  const [rows] = await pool.query(
    'SELECT * FROM admins WHERE username = ?',
    [username]
  );

  if (rows.length === 0) {
    throw new ApiError(401, 'Invalid credentials');
  }

  const admin = rows[0];
  const isMatch = await bcrypt.compare(password, admin.password_hash);

  if (!isMatch) {
    throw new ApiError(401, 'Invalid credentials');
  }

  const token = jwt.sign(
    { admin_id: admin.admin_id, username: admin.username },
    process.env.JWT_SECRET || 'exam_mgmt_jwt_secret_key_2026',
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );

  res.json({
    success: true,
    data: {
      admin_id: admin.admin_id,
      username: admin.username,
      name: admin.name,
      token,
    },
    message: 'Login successful',
  });
});

// GET /api/auth/profile
const getProfile = asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    'SELECT admin_id, username, name, created_at FROM admins WHERE admin_id = ?',
    [req.user.admin_id]
  );

  if (rows.length === 0) {
    throw new ApiError(404, 'Admin not found');
  }

  res.json({
    success: true,
    data: rows[0],
    message: 'Profile fetched successfully',
  });
});

module.exports = { register, login, getProfile };
