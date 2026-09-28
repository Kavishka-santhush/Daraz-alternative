export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, message: string, code?: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code ?? defaultCode(status);
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(msg = 'Bad request', details?: unknown) {
    return new ApiError(400, msg, 'BAD_REQUEST', details);
  }
  static unauthorized(msg = 'Authentication required') {
    return new ApiError(401, msg, 'UNAUTHORIZED');
  }
  static forbidden(msg = 'You do not have permission to perform this action') {
    return new ApiError(403, msg, 'FORBIDDEN');
  }
  static notFound(msg = 'Resource not found') {
    return new ApiError(404, msg, 'NOT_FOUND');
  }
  static conflict(msg = 'Conflict', details?: unknown) {
    return new ApiError(409, msg, 'CONFLICT', details);
  }
  static unprocessable(msg = 'Unprocessable entity', details?: unknown) {
    return new ApiError(422, msg, 'UNPROCESSABLE', details);
  }
  static tooMany(msg = 'Too many requests') {
    return new ApiError(429, msg, 'RATE_LIMITED');
  }
  static internal(msg = 'Internal server error') {
    return new ApiError(500, msg, 'INTERNAL_ERROR');
  }
}

function defaultCode(status: number): string {
  const map: Record<number, string> = {
    400: 'BAD_REQUEST',
    401: 'UNAUTHORIZED',
    403: 'FORBIDDEN',
    404: 'NOT_FOUND',
    409: 'CONFLICT',
    422: 'UNPROCESSABLE',
    429: 'RATE_LIMITED',
    500: 'INTERNAL_ERROR',
  };
  return map[status] ?? 'ERROR';
}

export default ApiError;
