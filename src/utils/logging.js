/**
 * Color-coded logging utility with log levels
 * Supports both Node.js (backend) and browser (frontend) environments
 */

// ANSI color codes for terminal output (Node.js)
const colors = {
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
    gray: '\x1b[90m'
};

// Log levels with priority
const LogLevel = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3
};

// Browser console colors
const browserColors = {
    error: 'color: #ff4444; font-weight: bold',
    warn: 'color: #ffaa00; font-weight: bold',
    info: 'color: #0099ff',
    debug: 'color: #666666',
    success: 'color: #00cc44; font-weight: bold'
};

class Logger {
    constructor(module = 'App') {
        this.module = module;
        this.isNode = typeof process !== 'undefined' && process.versions && process.versions.node;
        this.isBrowser = typeof window !== 'undefined' && typeof window.document !== 'undefined';
        
        // Get log level from environment or default to DEBUG for development
        const envLogLevel = this.isNode ? process.env.LOG_LEVEL : (window.LOG_LEVEL || 'DEBUG');
        this.logLevel = LogLevel[envLogLevel?.toUpperCase()] ?? LogLevel.DEBUG;
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
     * Log to console based on environment
     */
    logToConsole(level, colorCode, ...args) {
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
    error(...args) {
        if (this.logLevel >= LogLevel.ERROR) {
            if (this.isNode) {
                const { prefix, args: messageArgs } = this.formatMessage('ERROR', ...args);
                console.error(`${colors.red}${colors.bright}${prefix}${colors.reset}`, ...messageArgs);
            } else if (this.isBrowser) {
                const { prefix, args: messageArgs } = this.formatMessage('ERROR', ...args);
                console.error(`%c${prefix}`, browserColors.error, ...messageArgs);
            } else {
                console.error(...args);
            }
        }
    }

    /**
     * Warning logging
     */
    warn(...args) {
        if (this.logLevel >= LogLevel.WARN) {
            this.logToConsole('WARN', 'yellow', ...args);
        }
    }

    /**
     * Info logging
     */
    info(...args) {
        if (this.logLevel >= LogLevel.INFO) {
            this.logToConsole('INFO', 'cyan', ...args);
        }
    }

    /**
     * Debug logging (detailed development information)
     */
    debug(...args) {
        if (this.logLevel >= LogLevel.DEBUG) {
            this.logToConsole('DEBUG', 'gray', ...args);
        }
    }

    /**
     * Success logging (special case for positive outcomes)
     */
    success(...args) {
        if (this.logLevel >= LogLevel.INFO) {
            if (this.isNode) {
                const { prefix, args: messageArgs } = this.formatMessage('SUCCESS', ...args);
                console.log(`${colors.green}${colors.bright}${prefix}${colors.reset}`, ...messageArgs);
            } else if (this.isBrowser) {
                const { prefix, args: messageArgs } = this.formatMessage('SUCCESS', ...args);
                console.log(`%c${prefix}`, browserColors.success, ...messageArgs);
            } else {
                console.log(...args);
            }
        }
    }

    /**
     * Create a child logger with a sub-module context
     */
    child(subModule) {
        return new Logger(`${this.module}:${subModule}`);
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

// Create and export a default logger instance
const defaultLogger = new Logger('App');

// ES Module exports for Node.js
export { Logger, LogLevel, defaultLogger as default };

// Browser global exports (when loaded via script tag)
if (typeof window !== 'undefined') {
    window.Logger = Logger;
    window.LogLevel = LogLevel;
    window.logger = defaultLogger;
}
