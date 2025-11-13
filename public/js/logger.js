/**
 * Browser-compatible logger with color-coded output and log levels
 * This is a simplified version of the main logger for browser use
 */

(function () {
  'use strict';

  // Log levels with priority
  const LogLevel = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
  };

  // Browser console colors
  const browserColors = {
    error: 'color: #ff4444; font-weight: bold',
    warn: 'color: #ffaa00; font-weight: bold',
    info: 'color: #0099ff',
    debug: 'color: #666666',
    success: 'color: #00cc44; font-weight: bold',
  };

  class Logger {
    constructor(module = 'App') {
      this.module = module;

      // Get log level from window.LOG_LEVEL or default to DEBUG
      const envLogLevel = window.LOG_LEVEL || 'DEBUG';
      this.logLevel = LogLevel[envLogLevel.toUpperCase()] ?? LogLevel.DEBUG;
    }

    /**
     * Format timestamp
     */
    getTimestamp() {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      const ms = String(now.getMilliseconds()).padStart(3, '0');
      return `${hours}:${minutes}:${seconds}.${ms}`;
    }

    /**
     * Format log message with module context
     */
    formatMessage(level, ...args) {
      const timestamp = this.getTimestamp();
      const prefix = `[${timestamp}] [${level}] [${this.module}]`;
      return { prefix, args };
    }

    /**
     * Error logging (always shown)
     */
    error(...args) {
      if (this.logLevel >= LogLevel.ERROR) {
        const { prefix, args: messageArgs } = this.formatMessage(
          'ERROR',
          ...args
        );
        console.error(`%c${prefix}`, browserColors.error, ...messageArgs);
      }
    }

    /**
     * Warning logging
     */
    warn(...args) {
      if (this.logLevel >= LogLevel.WARN) {
        const { prefix, args: messageArgs } = this.formatMessage(
          'WARN',
          ...args
        );
        console.warn(`%c${prefix}`, browserColors.warn, ...messageArgs);
      }
    }

    /**
     * Info logging
     */
    info(...args) {
      if (this.logLevel >= LogLevel.INFO) {
        const { prefix, args: messageArgs } = this.formatMessage(
          'INFO',
          ...args
        );
        console.log(`%c${prefix}`, browserColors.info, ...messageArgs);
      }
    }

    /**
     * Debug logging (detailed development information)
     */
    debug(...args) {
      if (this.logLevel >= LogLevel.DEBUG) {
        const { prefix, args: messageArgs } = this.formatMessage(
          'DEBUG',
          ...args
        );
        console.log(`%c${prefix}`, browserColors.debug, ...messageArgs);
      }
    }

    /**
     * Success logging (special case for positive outcomes)
     */
    success(...args) {
      if (this.logLevel >= LogLevel.INFO) {
        const { prefix, args: messageArgs } = this.formatMessage(
          'SUCCESS',
          ...args
        );
        console.log(`%c${prefix}`, browserColors.success, ...messageArgs);
      }
    }

    /**
     * Set the log level dynamically
     */
    setLogLevel(level) {
      if (typeof level === 'string') {
        this.logLevel = LogLevel[level.toUpperCase()] ?? LogLevel.DEBUG;
      } else if (typeof level === 'number') {
        this.logLevel = level;
      }
    }

    /**
     * Get current log level as string
     */
    getLogLevel() {
      const entries = Object.entries(LogLevel);
      const entry = entries.find(([_, value]) => value === this.logLevel);
      return entry ? entry[0] : 'UNKNOWN';
    }
  }

  // Create default logger instance for the frontend
  const defaultLogger = new Logger('Frontend');

  // Export to window object
  window.Logger = Logger;
  window.LogLevel = LogLevel;
  window.logger = defaultLogger;

  // Allow setting log level via console for debugging
  window.setLogLevel = function (level) {
    defaultLogger.setLogLevel(level);
    defaultLogger.info(`Log level changed to: ${defaultLogger.getLogLevel()}`);
  };
})();
