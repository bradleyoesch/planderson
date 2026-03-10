import fs from 'fs';
import path from 'path';

import { getPlandersonBaseDir } from '~/utils/io/paths';

/**
 * Get the logs directory path
 */
const getLogDir = (): string => {
    return path.join(getPlandersonBaseDir(), 'logs');
};

/**
 * Get the activity log file path
 */
const getLogFile = (): string => {
    return path.join(getLogDir(), 'activity.log');
};

/**
 * Get the error log file path
 */
const getErrorLogFile = (): string => {
    return path.join(getLogDir(), 'error.log');
};

/**
 * Ensure logs directory exists
 */
const ensureLogDir = (): void => {
    const dir = getLogDir();
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
};
// Call at module load time to ensure log directory exists
ensureLogDir();

// Type for the write function (used for testing)
type WriteFunction = (file: string, data: string) => void;

// Internal write function that can be overridden for testing
let writeFunction: WriteFunction = (file: string, data: string) => {
    fs.appendFileSync(file, data);
};

// Set write function for testing
export const setWriteFunction = (fn: WriteFunction): void => {
    writeFunction = fn;
};

// Reset to default write function
export const resetWriteFunction = (): void => {
    writeFunction = (file: string, data: string) => {
        fs.appendFileSync(file, data);
    };
};

// Helper to log events
export const logEvent = (filename: string, sessionId: string, event: string, metadata?: string): void => {
    const timestamp = new Date().toISOString();
    const level = 'INFO';
    const basename = path.basename(filename);
    const notesStr = metadata ? ` - ${metadata}` : '';
    const logEntry = `${timestamp} ${level.padEnd(5)} | ${sessionId} | ${event} | ${basename}${notesStr}\n`;

    try {
        writeFunction(getLogFile(), logEntry);
    } catch (err) {
        // Fallback to console if file write fails
        console.error('Failed to write to log file:', err);
    }
};

// Helper to log errors to both activity.log and error.log
export const logError = (filename: string, sessionId: string, event: string, err: Error, metadata?: string): void => {
    const timestamp = new Date().toISOString();
    const basename = path.basename(filename);
    const details = err.stack ?? err.message ?? '';
    const notesStr = metadata || details ? ` - ${details.split('\n')[0] ?? ''} ${metadata ?? ''}` : '';

    // Write to activity.log (same format as logEvent with ERROR level)
    const activityEntry = `${timestamp} ERROR | ${sessionId} | ${event} | ${basename}${notesStr}\n`;
    // Write to error.log (detailed with stacktrace)
    const errorEntry = `${timestamp} ERROR | ${sessionId} | ${event} | ${metadata ?? ''}\n${err.stack}\n`;

    try {
        writeFunction(getLogFile(), activityEntry);
    } catch (writeErr) {
        console.error('Failed to write to log file:', writeErr);
    }
    try {
        writeFunction(getErrorLogFile(), errorEntry);
    } catch (writeErr) {
        console.error('Failed to write to error log file:', writeErr);
    }
};

// Helper to log errors to error.log without session context (for low-level libraries)
export const logRawError = (message: string, err?: Error): void => {
    const timestamp = new Date().toISOString();
    const stackLine = err?.stack ? `\n${err.stack}` : '';
    const entry = `[${timestamp}] ${message}${stackLine}\n`;

    try {
        writeFunction(getErrorLogFile(), entry);
    } catch (writeErr) {
        console.error('Failed to write to error log file:', writeErr);
    }
};
