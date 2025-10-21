import winston from 'winston';
import config from '../config';
import path from 'path';
import fs from 'fs-extra';

// Ensure logs directory exists
const logsDir = path.dirname(config.logging.file);
fs.ensureDirSync(logsDir);

/**
 * Custom log format
 */
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

/**
 * Console format for development
 */
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let metaStr = '';
    if (Object.keys(meta).length > 0) {
      metaStr = ` ${JSON.stringify(meta)}`;
    }
    return `${timestamp} ${level}: ${message}${metaStr}`;
  })
);

/**
 * Create logger instance
 */
export const logger = winston.createLogger({
  level: config.logging.level,
  format: logFormat,
  defaultMeta: { service: 'screenshot-scraper' },
  transports: [
    // File transport - all logs
    new winston.transports.File({
      filename: config.logging.file,
      maxsize: parseSize(config.logging.maxSize),
      maxFiles: parseInt(config.logging.maxFiles, 10),
    }),
    // File transport - errors only
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: parseSize(config.logging.maxSize),
      maxFiles: parseInt(config.logging.maxFiles, 10),
    }),
  ],
});

// Add console transport in development
if (config.app.isDevelopment) {
  logger.add(
    new winston.transports.Console({
      format: consoleFormat,
    })
  );
}

/**
 * Parse size string to bytes
 */
function parseSize(size: string): number {
  const units: Record<string, number> = {
    b: 1,
    k: 1024,
    m: 1024 * 1024,
    g: 1024 * 1024 * 1024,
  };

  const match = size.toLowerCase().match(/^(\d+)([bkmg])?$/);
  if (!match) return 10 * 1024 * 1024; // default 10MB

  const value = parseInt(match[1], 10);
  const unit = match[2] || 'b';
  return value * units[unit];
}

/**
 * Create child logger with additional context
 */
export function createLogger(context: string): winston.Logger {
  return logger.child({ context });
}

export default logger;
