const { validationResult, param, body, query } = require('express-validator');

/**
 * Returns middleware that runs the given validation chains
 * and returns 400 with errors array if any validation fails.
 * @param {Array} validations - Array of express-validator validation chains
 */
const validate = (validations) => {
  return async (req, res, next) => {
    // Run all validations
    await Promise.all(validations.map((validation) => validation.run(req)));

    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }

    return res.status(400).json({
      success: false,
      message: 'Validation failed.',
      errors: errors.array().map((err) => ({
        field: err.path,
        message: err.msg,
        value: err.value,
      })),
    });
  };
};

/**
 * Common validation chains reusable across routes.
 */
const commonValidations = {
  // --- ID validators (params) ---
  paramId: (name) =>
    param(name)
      .isInt({ min: 1 })
      .withMessage(`${name} must be a positive integer`)
      .toInt(),

  // --- String body validators ---
  requiredString: (field, { min = 1, max = 100, label } = {}) =>
    body(field)
      .trim()
      .notEmpty()
      .withMessage(`${label || field} is required`)
      .isLength({ min, max })
      .withMessage(`${label || field} must be between ${min} and ${max} characters`),

  optionalString: (field, { min = 1, max = 100, label } = {}) =>
    body(field)
      .optional()
      .trim()
      .isLength({ min, max })
      .withMessage(`${label || field} must be between ${min} and ${max} characters`),

  // --- Integer body validators ---
  requiredInt: (field, { min = 1, label } = {}) =>
    body(field)
      .notEmpty()
      .withMessage(`${label || field} is required`)
      .isInt({ min })
      .withMessage(`${label || field} must be an integer >= ${min}`)
      .toInt(),

  optionalInt: (field, { min = 1, label } = {}) =>
    body(field)
      .optional()
      .isInt({ min })
      .withMessage(`${label || field} must be an integer >= ${min}`)
      .toInt(),

  // --- Date validators ---
  requiredDate: (field, { label } = {}) =>
    body(field)
      .notEmpty()
      .withMessage(`${label || field} is required`)
      .isISO8601()
      .withMessage(`${label || field} must be a valid date (YYYY-MM-DD)`),

  optionalDate: (field, { label } = {}) =>
    body(field)
      .optional()
      .isISO8601()
      .withMessage(`${label || field} must be a valid date (YYYY-MM-DD)`),

  // --- Time validators (HH:MM or HH:MM:SS) ---
  requiredTime: (field, { label } = {}) =>
    body(field)
      .notEmpty()
      .withMessage(`${label || field} is required`)
      .matches(/^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/)
      .withMessage(`${label || field} must be a valid time (HH:MM or HH:MM:SS)`),

  optionalTime: (field, { label } = {}) =>
    body(field)
      .optional()
      .matches(/^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/)
      .withMessage(`${label || field} must be a valid time (HH:MM or HH:MM:SS)`),

  // --- Email validator ---
  requiredEmail: (field = 'email', { label } = {}) =>
    body(field)
      .trim()
      .notEmpty()
      .withMessage(`${label || field} is required`)
      .isEmail()
      .withMessage(`${label || field} must be a valid email`)
      .normalizeEmail(),

  // --- Enum validator ---
  requiredEnum: (field, allowedValues, { label } = {}) =>
    body(field)
      .notEmpty()
      .withMessage(`${label || field} is required`)
      .isIn(allowedValues)
      .withMessage(`${label || field} must be one of: ${allowedValues.join(', ')}`),

  optionalEnum: (field, allowedValues, { label } = {}) =>
    body(field)
      .optional()
      .isIn(allowedValues)
      .withMessage(`${label || field} must be one of: ${allowedValues.join(', ')}`),

  // --- Query param validators ---
  queryInt: (field, { min = 1, label } = {}) =>
    query(field)
      .optional()
      .isInt({ min })
      .withMessage(`${label || field} must be an integer >= ${min}`)
      .toInt(),

  queryString: (field, { label } = {}) =>
    query(field)
      .optional()
      .trim()
      .notEmpty()
      .withMessage(`${label || field} must not be empty if provided`),
};

module.exports = { validate, commonValidations };
