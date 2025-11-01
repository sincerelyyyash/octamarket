import { config } from '../config/index.js';

/**
 * Log levels
 */
enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

/**
 * Get numeric log level from string
 */
const getLogLevel = (level: string): LogLevel => {
  switch (level.toLowerCase()) {
    case 'debug': return LogLevel.DEBUG;
    case 'info': return LogLevel.INFO;
    case 'warn': return LogLevel.WARN;
    case 'error': return LogLevel.ERROR;
    default: return LogLevel.INFO;
  }
};

const currentLogLevel = getLogLevel(config.logLevel);

/**
 * Format log message with timestamp and metadata
 */
const formatLog = (level: string, message: string, meta?: any): string => {
  const timestamp = new Date().toISOString();
  const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
  return `[${timestamp}] [${level}] ${message}${metaStr}`;
};

/**
 * Structured logger utility
 */
export const logger = {
  debug: (message: string, meta?: any) => {
    if (currentLogLevel <= LogLevel.DEBUG) {
      console.log(formatLog('DEBUG', message, meta));
    }
  },

  info: (message: string, meta?: any) => {
    if (currentLogLevel <= LogLevel.INFO) {
      console.log(formatLog('INFO', message, meta));
    }
  },

  warn: (message: string, meta?: any) => {
    if (currentLogLevel <= LogLevel.WARN) {
      console.warn(formatLog('WARN', message, meta));
    }
  },

  error: (message: string, meta?: any) => {
    if (currentLogLevel <= LogLevel.ERROR) {
      console.error(formatLog('ERROR', message, meta));
    }
  },
};

