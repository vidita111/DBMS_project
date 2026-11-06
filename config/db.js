const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT, 10),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: {
    ca: fs.readFileSync(path.resolve(__dirname, '..', process.env.DB_SSL_CA || './ca.pem')),
    rejectUnauthorized: true,
  },
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
});

/**
 * Test the database connection and list tables.
 */
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('✅ Connected to MySQL database on Aiven');
    const [rows] = await connection.query('SHOW TABLES');
    console.log(`📋 Found ${rows.length} tables:`);
    rows.forEach((row) => {
      const tableName = Object.values(row)[0];
      console.log(`   - ${tableName}`);
    });
    connection.release();
    return rows;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    throw error;
  }
}

module.exports = { pool, testConnection };
