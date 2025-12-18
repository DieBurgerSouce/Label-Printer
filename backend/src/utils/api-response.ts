/**
 * Unified API Response Utilities
 * Ensures consistent response format across all endpoints
 */

import { Response } from 'express';
import logger from './logger';

/**
 * Standard API response structure
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  code?: string;
  details?: unknown;
}

/**
 * HTTP Status codes used in API responses
 */
export const HttpStatus = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

/**
 * Error codes for categorizing errors
 */
export const ErrorCode = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  CONFLICT: 'CONFLICT',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  BAD_REQUEST: 'BAD_REQUEST',
} as const;

/**
 * Send a successful response
 */
export function sendSuccess<T>(
  res: Response,
  data?: T,
  message?: string,
  status: number = HttpStatus.OK
): Response {
  const response: ApiResponse<T> = {
    success: true,
    ...(data !== undefined && { data }),
    ...(message && { message }),
  };
  return res.status(status).json(response);
}

/**
 * Send a created response (201)
 */
export function sendCreated<T>(res: Response, data?: T, message?: string): Response {
  return sendSuccess(res, data, message, HttpStatus.CREATED);
}

/**
 * Send an error response
 */
export function sendError(
  res: Response,
  error: string,
  status: number = HttpStatus.INTERNAL_SERVER_ERROR,
  code?: string,
  details?: unknown
): Response {
  const response: ApiResponse = {
    success: false,
    error,
  };
  if (code) {
    response.code = code;
  }
  if (details !== undefined) {
    response.details = details;
  }
  return res.status(status).json(response);
}

/**
 * Send a 400 Bad Request error
 */
export function sendBadRequest(res: Response, error: string, details?: unknown): Response {
  return sendError(res, error, HttpStatus.BAD_REQUEST, ErrorCode.BAD_REQUEST, details);
}

/**
 * Send a 404 Not Found error
 */
export function sendNotFound(res: Response, resource: string = 'Resource'): Response {
  return sendError(res, `${resource} not found`, HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND);
}

/**
 * Send a 401 Unauthorized error
 */
export function sendUnauthorized(res: Response, error: string = 'Unauthorized'): Response {
  return sendError(res, error, HttpStatus.UNAUTHORIZED, ErrorCode.UNAUTHORIZED);
}

/**
 * Send a 403 Forbidden error
 */
export function sendForbidden(res: Response, error: string = 'Forbidden'): Response {
  return sendError(res, error, HttpStatus.FORBIDDEN, ErrorCode.FORBIDDEN);
}

/**
 * Send a 409 Conflict error
 */
export function sendConflict(res: Response, error: string): Response {
  return sendError(res, error, HttpStatus.CONFLICT, ErrorCode.CONFLICT);
}

/**
 * Send a 422 Validation error
 */
export function sendValidationError(res: Response, error: string, details?: unknown): Response {
  return sendError(
    res,
    error,
    HttpStatus.UNPROCESSABLE_ENTITY,
    ErrorCode.VALIDATION_ERROR,
    details
  );
}

/**
 * Send a 500 Internal Server Error
 */
export function sendInternalError(
  res: Response,
  error: string = 'Internal server error'
): Response {
  return sendError(res, error, HttpStatus.INTERNAL_SERVER_ERROR, ErrorCode.INTERNAL_ERROR);
}

/**
 * Handle caught errors uniformly
 * Extracts error message from various error types
 */
export function handleError(
  res: Response,
  error: unknown,
  defaultMessage: string = 'An error occurred'
): Response {
  let message = defaultMessage;

  if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === 'string') {
    message = error;
  }

  logger.error(`API Error: ${message}`, { error });
  return sendInternalError(res, message);
}
