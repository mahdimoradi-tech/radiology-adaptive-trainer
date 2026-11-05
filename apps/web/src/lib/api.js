/**
 * Custom error class for API interaction errors
 */
export class ApiError extends Error {
  /**
   * @param {Object} params
   * @param {string} params.code
   * @param {number} params.status
   * @param {string} [params.message]
   * @param {unknown} [params.details]
   */
  constructor({ code, status, message, details }) {
    super(message || code);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

/**
 * Standard fetch wrapper configured for session cookies and JSON serialization
 *
 * @template T
 * @param {string} endpoint - API path (e.g. '/api/auth/login')
 * @param {Object} [options={}]
 * @param {string} [options.method='GET']
 * @param {unknown} [options.body]
 * @param {Record<string, string>} [options.headers={}]
 * @param {import('zod').ZodType<T>} [options.schema]
 * @returns {Promise<T>}
 */
export async function apiFetch(endpoint, options = {}) {
  const { method = 'GET', body, headers = {}, schema } = options;

  const reqHeaders = {
    Accept: 'application/json',
    ...headers,
  };

  let reqBody = body;
  if (body !== undefined && typeof body !== 'string' && !(body instanceof FormData)) {
    reqHeaders['Content-Type'] = 'application/json';
    reqBody = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(endpoint, {
      method,
      headers: reqHeaders,
      body: reqBody,
      credentials: 'include',
    });
  } catch (err) {
    throw new ApiError({
      code: 'NETWORK',
      status: 0,
      message: err instanceof Error ? err.message : 'Network error',
    });
  }

  if (res.status === 204) {
    return /** @type {T} */ (null);
  }

  let payload;
  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    try {
      payload = await res.json();
    } catch {
      payload = null;
    }
  } else {
    payload = await res.text();
  }

  if (!res.ok) {
    const errorData =
      payload && typeof payload === 'object' && 'error' in payload ? payload.error : null;
    throw new ApiError({
      code: errorData?.code || (res.status === 401 ? 'UNAUTHENTICATED' : 'INTERNAL_ERROR'),
      status: res.status,
      message: errorData?.message || res.statusText,
      details: errorData?.details,
    });
  }

  if (schema && payload !== null && payload !== undefined) {
    return schema.parse(payload);
  }

  return payload;
}

/**
 * Map an API error code to an i18n translation key
 * @param {string} code
 * @returns {string}
 */
export function getErrorI18nKey(code) {
  const recognizedCodes = [
    'VALIDATION_ERROR',
    'EMAIL_TAKEN',
    'INVALID_CREDENTIALS',
    'UNAUTHENTICATED',
    'FORBIDDEN',
    'NOT_FOUND',
    'RATE_LIMITED',
    'UNSUPPORTED_MEDIA_TYPE',
    'NETWORK',
    'INTERNAL_ERROR',
    'SESSION_IN_PROGRESS',
    'SESSION_NOT_IN_PROGRESS',
    'SESSION_NOT_FINISHED',
    'SESSION_ALREADY_FINISHED',
    'POOL_EXHAUSTED',
    'QUESTION_NOT_FOUND',
  ];
  return recognizedCodes.includes(code) ? `errors.${code}` : 'errors.INTERNAL_ERROR';
}
