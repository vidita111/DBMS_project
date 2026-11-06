const { ApiError } = require('../utils/helpers');

/**
 * Global error handling middleware.
 * Catches ApiError instances and generic errors, returning a consistent JSON response.
 * In development mode, includes the stack trace for debugging.
 */
const errorHandler = (err, req, res, next) => {
  // Log the error for server-side debugging
  console.error(`[ERROR] ${err.message}`);
  if (process.env.NODE_ENV !== 'production') {
    console.error(err.stack);
  }

  // Handle ApiError instances
  if (err instanceof ApiError) {
    const response = {
      success: false,
      message: err.message,
    };

    if (err.errors && err.errors.length > 0) {
      response.errors = err.errors;
    }

    if (process.env.NODE_ENV !== 'production') {
      response.stack = err.stack;
    }

    return res.status(err.statusCode).json(response);
  }

  // Handle MySQL duplicate entry errors
  if (err.code === 'ER_DUP_ENTRY') {
    const response = {
      success: false,
      message: 'Duplicate entry. This record already exists.',
    };

    if (process.env.NODE_ENV !== 'production') {
      response.detail = err.message;
      response.stack = err.stack;
    }

    return res.status(409).json(response);
  }

  // Handle MySQL foreign key constraint errors
  if (err.code === 'ER_NO_REFERENCED_ROW_2' || err.code === 'ER_NO_REFERENCED_ROW') {
    const response = {
      success: false,
      message: 'Referenced record does not exist. Please check the provided IDs.',
    };

    if (process.env.NODE_ENV !== 'production') {
      response.detail = err.message;
      response.stack = err.stack;
    }

    return res.status(400).json(response);
  }

  // Handle express-validator / JSON parse errors
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      success: false,
      message: 'Invalid JSON in request body.',
    });
  }

  // Handle all other / unknown errors
  const statusCode = err.statusCode || 500;
  const response = {
    success: false,
    message: statusCode === 500 ? 'Internal server error' : err.message,
  };

  if (process.env.NODE_ENV !== 'production') {
    response.message = err.message;
    response.stack = err.stack;
  }

  return res.status(statusCode).json(response);
};

module.exports = { errorHandler };
