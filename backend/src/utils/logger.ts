/**
 * Winston Logger Configuration
 * Centralized logging with structured output
 */

import winston from 'winston';
import path from 'path';

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define level colors
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue',
};

winston.addColors(colors);

// Define the log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, ...metadata }) => {
    let msg = `${timestamp} [${level.toUpperCase()}]: ${message}`;
    if (Object.keys(metadata).length > 0 && metadata.stack === undefined) {
      msg += ` ${JSON.stringify(metadata)}`;
    }
    if (metadata.stack) {
      msg += `\n${metadata.stack}`;
    }
    return msg;
  })
);

// Console format with colors
const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...metadata }) => {
    let msg = `${timestamp} ${level}: ${message}`;
    if (Object.keys(metadata).length > 0 && metadata.stack === undefined) {
      msg += ` ${JSON.stringify(metadata)}`;
    }
    return msg;
  })
);

// Determine log level based on environment
const getLogLevel = (): string => {
  const env = process.env.NODE_ENV || 'development';
  const envLevel = process.env.LOG_LEVEL;

  if (envLevel) return envLevel;

  switch (env) {
    case 'production':
      return 'info';
    case 'test':
      return 'error';
    default:
      return 'debug';
  }
};

// Create transports array
const transports: winston.transport[] = [
  // Console transport (always active)
  new winston.transports.Console({
    format: consoleFormat,
  }),
];

// Add file transports in production
if (process.env.NODE_ENV === 'production') {
  const logsDir = process.env.LOGS_DIR || path.join(process.cwd(), 'logs');

  transports.push(
    // Error log file
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      format: logFormat,
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
    }),
    // Combined log file
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      format: logFormat,
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
    })
  );
}

// Create the logger instance
const logger = winston.createLogger({
  level: getLogLevel(),
  levels,
  transports,
  // Don't exit on uncaught exceptions
  exitOnError: false,
});

// Export helper methods for common logging patterns
export const logRequest = (
  method: string,
  path: string,
  statusCode?: number,
  duration?: number
) => {
  logger.http('Request', {
    method,
    path,
    statusCode,
    duration: duration ? `${duration}ms` : undefined,
  });
};

export const logError = (
  message: string,
  error: Error | unknown,
  context?: Record<string, unknown>
) => {
  if (error instanceof Error) {
    logger.error(message, { error: error.message, stack: error.stack, ...context });
  } else {
    logger.error(message, { error: String(error), ...context });
  }
};

export const logServiceStart = (serviceName: string) => {
  logger.info(`🚀 ${serviceName} started`);
};

export const logServiceStop = (serviceName: string) => {
  logger.info(`🛑 ${serviceName} stopped`);
};

export const logDatabaseQuery = (operation: string, table: string, duration?: number) => {
  logger.debug('Database query', {
    operation,
    table,
    duration: duration ? `${duration}ms` : undefined,
  });
};

export default logger;
