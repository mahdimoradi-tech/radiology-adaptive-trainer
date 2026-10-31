import pino from 'pino';
import { pinoHttp } from 'pino-http';
import { randomUUID } from 'node:crypto';

/**
 * Create base pino logger
 * @param {{ NODE_ENV?: string, LOG_LEVEL?: string }} [options]
 */
export function createLogger(options = {}) {
  const isTest = (options.NODE_ENV || process.env.NODE_ENV) === 'test';
  const level = options.LOG_LEVEL || (isTest ? 'silent' : 'info');

  return pino({
    level,
    redact: {
      paths: ['req.headers.cookie', 'req.headers.authorization'],
      censor: '[REDACTED]',
    },
  });
}

export const logger = createLogger();

/**
 * Create pino-http middleware
 * @param {import('pino').Logger} [logInstance]
 */
export function createHttpLogger(logInstance = logger) {
  return pinoHttp({
    logger: logInstance,
    genReqId: (req) => req.headers['x-request-id'] || randomUUID(),
    redact: {
      paths: ['req.headers.cookie', 'req.headers.authorization'],
      censor: '[REDACTED]',
    },
    customLogLevel: (req, res, err) => {
      if (res.statusCode >= 500 || err) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
  });
}
