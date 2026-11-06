/**
 * Wraps an async route handler to automatically catch errors
 * and forward them to the Express error-handling middleware.
 * @param {Function} fn - Async route handler function
 * @returns {Function} Express middleware
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Custom API error class with HTTP status code.
 */
class ApiError extends Error {
  /**
   * @param {number} statusCode - HTTP status code
   * @param {string} message - Error message
   * @param {Array} [errors] - Optional array of detailed error objects
   */
  constructor(statusCode, message, errors = []) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
    this.name = 'ApiError';
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message = 'Bad request', errors = []) {
    return new ApiError(400, message, errors);
  }

  static notFound(message = 'Resource not found') {
    return new ApiError(404, message);
  }

  static unauthorized(message = 'Unauthorized') {
    return new ApiError(401, message);
  }

  static forbidden(message = 'Forbidden') {
    return new ApiError(403, message);
  }

  static conflict(message = 'Conflict') {
    return new ApiError(409, message);
  }

  static internal(message = 'Internal server error') {
    return new ApiError(500, message);
  }
}

/**
 * Formats a Date object or date string to YYYY-MM-DD.
 * @param {Date|string} date
 * @returns {string} Formatted date string
 */
const formatDate = (date) => {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Formats a time value to HH:MM:SS or HH:MM.
 * Accepts Date objects, "HH:MM:SS" strings, or "HH:MM" strings.
 * @param {Date|string} time
 * @param {boolean} [includeSeconds=true]
 * @returns {string|null} Formatted time string
 */
const formatTime = (time, includeSeconds = true) => {
  if (!time) return null;

  // If it's already a string like "09:30:00" or "09:30"
  if (typeof time === 'string') {
    const parts = time.split(':');
    if (parts.length >= 2) {
      const hh = parts[0].padStart(2, '0');
      const mm = parts[1].padStart(2, '0');
      const ss = parts[2] ? parts[2].padStart(2, '0') : '00';
      return includeSeconds ? `${hh}:${mm}:${ss}` : `${hh}:${mm}`;
    }
    return null;
  }

  // If it's a Date object
  if (time instanceof Date) {
    const hh = String(time.getHours()).padStart(2, '0');
    const mm = String(time.getMinutes()).padStart(2, '0');
    const ss = String(time.getSeconds()).padStart(2, '0');
    return includeSeconds ? `${hh}:${mm}:${ss}` : `${hh}:${mm}`;
  }

  return null;
};

/**
 * Auto-allocate seats for a given exam session.
 *
 * 1. Fetches all registered students for the session.
 * 2. Fetches all rooms assigned to the session (via session_rooms) with their capacities.
 * 3. Distributes students across rooms sequentially, assigning seat numbers 1..capacity.
 * 4. INSERTs allocations into seat_allocations table.
 *
 * @param {number} sessionId - The exam session ID
 * @param {object} pool - mysql2/promise pool
 * @returns {Promise<{totalAllocated: number, allocations: Array<{room_number: string, student_name: string, seat_number: number}>}>}
 */
const generateSeatAllocations = async (sessionId, pool) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Check if allocations already exist for this session
    const [existing] = await connection.query(
      'SELECT COUNT(*) AS count FROM seat_allocations WHERE session_id = ?',
      [sessionId]
    );
    if (existing[0].count > 0) {
      throw ApiError.conflict(
        `Seat allocations already exist for session ${sessionId}. Delete existing allocations first.`
      );
    }

    // Get all registered students for this session
    const [students] = await connection.query(
      `SELECT er.student_id, s.name AS student_name, s.roll_no
       FROM exam_registrations er
       JOIN students s ON er.student_id = s.student_id
       WHERE er.session_id = ?
       ORDER BY s.roll_no ASC`,
      [sessionId]
    );

    if (students.length === 0) {
      throw ApiError.badRequest(
        `No students registered for session ${sessionId}.`
      );
    }

    // Get all rooms assigned to this session with capacities
    const [rooms] = await connection.query(
      `SELECT sr.room_id, r.room_number, r.capacity
       FROM session_rooms sr
       JOIN rooms r ON sr.room_id = r.room_id
       WHERE sr.session_id = ?
       ORDER BY r.room_number ASC`,
      [sessionId]
    );

    if (rooms.length === 0) {
      throw ApiError.badRequest(
        `No rooms assigned to session ${sessionId}. Assign rooms first.`
      );
    }

    // Calculate total capacity
    const totalCapacity = rooms.reduce((sum, room) => sum + room.capacity, 0);
    if (students.length > totalCapacity) {
      throw ApiError.badRequest(
        `Not enough room capacity. Need ${students.length} seats but only ${totalCapacity} available.`
      );
    }

    // Distribute students across rooms sequentially
    const allocations = [];
    let studentIndex = 0;

    for (const room of rooms) {
      let seatNumber = 1;

      while (seatNumber <= room.capacity && studentIndex < students.length) {
        const student = students[studentIndex];

        allocations.push({
          session_id: sessionId,
          student_id: student.student_id,
          room_id: room.room_id,
          seat_number: seatNumber,
          room_number: room.room_number,
          student_name: student.student_name,
        });

        seatNumber++;
        studentIndex++;
      }

      if (studentIndex >= students.length) break;
    }

    // Bulk insert into seat_allocations
    if (allocations.length > 0) {
      const values = allocations.map((a) => [
        a.session_id,
        a.student_id,
        a.room_id,
        a.seat_number,
      ]);

      await connection.query(
        `INSERT INTO seat_allocations (session_id, student_id, room_id, seat_number)
         VALUES ?`,
        [values]
      );
    }

    await connection.commit();

    return {
      totalAllocated: allocations.length,
      allocations: allocations.map((a) => ({
        room_number: a.room_number,
        student_name: a.student_name,
        seat_number: a.seat_number,
      })),
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

module.exports = {
  asyncHandler,
  ApiError,
  formatDate,
  formatTime,
  generateSeatAllocations,
};
