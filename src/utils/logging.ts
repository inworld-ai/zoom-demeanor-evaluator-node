/**
 * Color-coded logging utility with log levels
 * Supports both Node.js (backend) and browser (frontend) environments
 */

// ANSI color codes for terminal output (Node.js)
const colors: Record<string, string> = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
};

// Log levels with priority
export const LogLevel = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
} as const;

export type LogLevelValue = (typeof LogLevel)[keyof typeof LogLevel];

// Browser console colors
const browserColors: Record<string, string> = {
  error: 'color: #ff4444; font-weight: bold',
  warn: 'color: #ffaa00; font-weight: bold',
  info: 'color: #0099ff',
  debug: 'color: #666666',
  success: 'color: #00cc44; font-weight: bold',
};

interface FormatMessageResult {
  prefix: string;
  args: unknown[];
}

export class Logger {
  private module: string;
  private isNode: boolean;
  private isBrowser: boolean;
  private logLevel: LogLevelValue;

  constructor(module: string = 'App') {
    this.module = module;
    this.isNode =
      typeof process !== 'undefined' &&
      process.versions !== undefined &&
      process.versions.node !== undefined;
    this.isBrowser =
      typeof window !== 'undefined' && typeof window.document !== 'undefined';

    // Get log level from environment or default to DEBUG for development
    const envLogLevel = this.isNode
      ? process.env.LOG_LEVEL
      : (typeof window !== 'undefined' &&
          (window as { LOG_LEVEL?: string }).LOG_LEVEL) ||
        'DEBUG';
    this.logLevel =
      LogLevel[envLogLevel?.toUpperCase() as keyof typeof LogLevel] ??
      LogLevel.DEBUG;
  }

  /**
   * Format timestamp
   */
  private getTimestamp(): string {
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
  private formatMessage(
    level: string,
    ...args: unknown[]
  ): FormatMessageResult {
    const timestamp = this.getTimestamp();
    const prefix = `[${timestamp}] [${level}] [${this.module}]`;
    return { prefix, args };
  }

  /**
   * Log to console based on environment
   */
  private logToConsole(
    level: string,
    colorCode: string,
    ...args: unknown[]
  ): void {
    const { prefix, args: messageArgs } = this.formatMessage(level, ...args);

    if (this.isNode) {
      // Node.js environment - use ANSI colors
      const color = colors[colorCode] || colors.reset;
      console.log(`${color}${prefix}${colors.reset}`, ...messageArgs);
    } else if (this.isBrowser) {
      // Browser environment - use CSS styles
      const style = browserColors[level.toLowerCase()] || '';
      console.log(`%c${prefix}`, style, ...messageArgs);
    } else {
      // Fallback for unknown environments
      console.log(prefix, ...messageArgs);
    }
  }

  /**
   * Error logging (always shown)
   */
  error(...args: unknown[]): void {
    if (this.logLevel >= LogLevel.ERROR) {
      if (this.isNode) {
        const { prefix, args: messageArgs } = this.formatMessage(
          'ERROR',
          ...args
        );
        console.error(
          `${colors.red}${colors.bright}${prefix}${colors.reset}`,
          ...messageArgs
        );
      } else if (this.isBrowser) {
        const { prefix, args: messageArgs } = this.formatMessage(
          'ERROR',
          ...args
        );
        console.error(`%c${prefix}`, browserColors.error, ...messageArgs);
      } else {
        console.error(...args);
      }
    }
  }

  /**
   * Warning logging
   */
  warn(...args: unknown[]): void {
    if (this.logLevel >= LogLevel.WARN) {
      this.logToConsole('WARN', 'yellow', ...args);
    }
  }

  /**
   * Info logging
   */
  info(...args: unknown[]): void {
    if (this.logLevel >= LogLevel.INFO) {
      this.logToConsole('INFO', 'cyan', ...args);
    }
  }

  /**
   * Debug logging (detailed development information)
   */
  debug(...args: unknown[]): void {
    if (this.logLevel >= LogLevel.DEBUG) {
      this.logToConsole('DEBUG', 'gray', ...args);
    }
  }

  /**
   * Success logging (special case for positive outcomes)
   */
  success(...args: unknown[]): void {
    if (this.logLevel >= LogLevel.INFO) {
      if (this.isNode) {
        const { prefix, args: messageArgs } = this.formatMessage(
          'SUCCESS',
          ...args
        );
        console.log(
          `${colors.green}${colors.bright}${prefix}${colors.reset}`,
          ...messageArgs
        );
      } else if (this.isBrowser) {
        const { prefix, args: messageArgs } = this.formatMessage(
          'SUCCESS',
          ...args
        );
        console.log(`%c${prefix}`, browserColors.success, ...messageArgs);
      } else {
        console.log(...args);
      }
    }
  }

  /**
   * Create a child logger with a sub-module context
   */
  child(subModule: string): Logger {
    return new Logger(`${this.module}:${subModule}`);
  }

  /**
   * Set the log level dynamically
   */
  setLogLevel(level: string | number): void {
    if (typeof level === 'string') {
      this.logLevel =
        LogLevel[level.toUpperCase() as keyof typeof LogLevel] ??
        LogLevel.DEBUG;
    } else if (typeof level === 'number') {
      this.logLevel = level as LogLevelValue;
    }
  }

  /**
   * Get current log level as string
   */
  getLogLevel(): string {
    const entries = Object.entries(LogLevel);
    const entry = entries.find(([, value]) => value === this.logLevel);
    return entry ? entry[0] : 'UNKNOWN';
  }
}

// Create and export a default logger instance
const defaultLogger = new Logger('App');

// ES Module exports for Node.js
export { defaultLogger as default };

// Browser global exports (when loaded via script tag)
declare global {
  interface Window {
    Logger?: typeof Logger;
    LogLevel?: typeof LogLevel;
    logger?: Logger;
    LOG_LEVEL?: string;
  }
}

if (typeof window !== 'undefined') {
  window.Logger = Logger;
  window.LogLevel = LogLevel;
  window.logger = defaultLogger;
}
