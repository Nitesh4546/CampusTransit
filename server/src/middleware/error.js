import { logger } from '../utils/logger.js';

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  logger.error('Unhandled error:', err);

  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: err.message },
    });
  }

  if (err.name === 'CastError') {
    return res.status(400).json({
      error: { code: 'INVALID_ID', message: 'Invalid ID format' },
    });
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || 'field';
    return res.status(409).json({
      error: { code: 'DUPLICATE', message: `${field} already exists` },
    });
  }

  const status = err.status || err.statusCode || 500;
  return res.status(status).json({
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message: err.message || 'Internal server error',
    },
  });
}
