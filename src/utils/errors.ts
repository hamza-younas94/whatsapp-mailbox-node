// src/utils/errors.ts
// Custom error classes following best practices

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string,
  ) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(400, message, 'VALIDATION_ERROR');
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(404, `${resource} not found`, 'NOT_FOUND');
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(401, message, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(403, message, 'FORBIDDEN');
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, message, 'CONFLICT');
  }
}

export class InternalServerError extends AppError {
  constructor(message = 'Internal Server Error') {
    super(500, message, 'INTERNAL_SERVER_ERROR');
  }
}

export class ExternalServiceError extends AppError {
  constructor(service: string, message: string) {
    super(502, `${service} service error: ${message}`, 'EXTERNAL_SERVICE_ERROR');
  }
}
