import winston from 'winston';
import path from 'path';
import { config } from '../config/index';

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const transports: winston.transport[] = [
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    ),
  }),
];

if (config.logging.file) {
  const logDir = path.dirname(config.logging.file);
  // Only add file transport if a valid directory is provided
  if (logDir && logDir !== '.' && logDir !== path.sep) {
    transports.push(
      new winston.transports.File({
        filename: config.logging.file,
        format: logFormat,
      })
    );
  }
}

export const logger = winston.createLogger({
  level: config.logging.level,
  format: logFormat,
  transports,
  defaultMeta: { service: 'octamarkets-api' },
});

// Create child logger for requests
export const requestLogger = logger.child({ component: 'request' });

// Create child logger for errors
export const errorLogger = logger.child({ component: 'error' });

// Create child logger for database operations
export const dbLogger = logger.child({ component: 'database' });

// Create child logger for cache operations
export const cacheLogger = logger.child({ component: 'cache' });
