/**
 * Base HTTP Error
 */
export class HttpError extends Error {
  /**
   * @param {number} statusCode
   * @param {import('@radiology/contracts').ApiErrorCode} code
   * @param {string} message
   * @param {unknown} [details]
   */
  constructor(statusCode, code, message, details) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export class BadRequestError extends HttpError {
  constructor(message = 'Validation error', details = undefined) {
    super(400, 'VALIDATION_ERROR', message, details);
    this.name = 'BadRequestError';
  }
}

export class UnauthenticatedError extends HttpError {
  constructor(message = 'Authentication required') {
    super(401, 'UNAUTHENTICATED', message);
    this.name = 'UnauthenticatedError';
  }
}

export class ForbiddenError extends HttpError {
  constructor(message = 'Access forbidden') {
    super(403, 'FORBIDDEN', message);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends HttpError {
  constructor(message = 'Resource not found') {
    super(404, 'NOT_FOUND', message);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends HttpError {
  constructor(message = 'Conflict', code = 'EMAIL_TAKEN') {
    super(409, code, message);
    this.name = 'ConflictError';
  }
}

export class InvalidCredentialsError extends HttpError {
  constructor(message = 'Invalid email or password') {
    super(401, 'INVALID_CREDENTIALS', message);
    this.name = 'InvalidCredentialsError';
  }
}

export class UnsupportedMediaTypeError extends HttpError {
  constructor(message = 'Content-Type must be application/json') {
    super(415, 'UNSUPPORTED_MEDIA_TYPE', message);
    this.name = 'UnsupportedMediaTypeError';
  }
}

export class RateLimitError extends HttpError {
  constructor(message = 'Too many requests, please try again later') {
    super(429, 'RATE_LIMITED', message);
    this.name = 'RateLimitError';
  }
}

export class InternalError extends HttpError {
  constructor(message = 'Internal server error') {
    super(500, 'INTERNAL_ERROR', message);
    this.name = 'InternalError';
  }
}
