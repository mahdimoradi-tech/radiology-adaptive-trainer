import { HttpError } from '../lib/httpErrors.js';
import { logger } from '../lib/logger.js';

/**
 * Express 5 centralized error handling middleware
 */
export function errorHandler(err, req, res, _next) {
  const log = req.log || logger;

  let statusCode = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'Internal server error';
  let details;

  if (err instanceof HttpError) {
    statusCode = err.statusCode;
    code = err.code;
    message = err.message;
    details = err.details;
  } else if (err?.name === 'ZodError') {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = 'Validation error';
    details = err.issues;
  } else if (err?.type === 'entity.too.large') {
    statusCode = 413;
    code = 'VALIDATION_ERROR';
    message = 'Payload too large (max 100kb)';
  } else if (err instanceof SyntaxError && 'body' in err) {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = 'Malformed JSON in request body';
  } else {
    log.error({ err }, 'Unhandled server error');
  }

  const responseBody = {
    error: {
      code,
      message,
      ...(details !== undefined ? { details } : {}),
    },
  };

  res.status(statusCode).json(responseBody);
}
