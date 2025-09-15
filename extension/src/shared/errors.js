/**
 * Custom error classes for the DSP Management Extension
 * Provides structured error handling with consistent error codes and context
 */

import { ERROR_CODES } from './constants.js';

/**
 * Base extension error class
 */
export class ExtensionError extends Error {
    constructor(message, code, details = {}) {
        super(message);
        this.name = this.constructor.name;
        this.code = code;
        this.details = details;
        this.timestamp = new Date().toISOString();

        // Maintains proper stack trace for where our error was thrown (only available on V8)
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }
    }

    /**
     * Convert error to serializable object
     * @returns {object} Serializable error object
     */
    toJSON() {
        return {
            name: this.name,
            message: this.message,
            code: this.code,
            details: this.details,
            timestamp: this.timestamp,
            stack: this.stack,
        };
    }

    /**
     * Create user-friendly error message
     * @returns {string} User-friendly error message
     */
    getUserMessage() {
        return this.details.userMessage || this.message;
    }
}

/**
 * Storage-related errors
 */
export class StorageError extends ExtensionError {
    constructor(message, details = {}) {
        super(message, ERROR_CODES.STORAGE_ERROR, details);
    }

    static fromStorageOperation(operation, key, originalError) {
        return new StorageError(`Storage ${operation} failed for key "${key}"`, {
            operation,
            key,
            originalError: originalError?.message,
            userMessage: 'Failed to save or retrieve extension settings. Please try again.',
        });
    }
}

/**
 * Network-related errors
 */
export class NetworkError extends ExtensionError {
    constructor(message, details = {}) {
        super(message, ERROR_CODES.NETWORK_ERROR, details);
    }

    static fromFetchError(url, originalError) {
        return new NetworkError(`Network request failed for URL: ${url}`, {
            url,
            originalError: originalError?.message,
            userMessage:
                'Network connection failed. Please check your internet connection and try again.',
        });
    }

    static fromWebhookError(webhookUrl, statusCode, originalError) {
        return new NetworkError(`Webhook request failed: ${statusCode}`, {
            webhookUrl,
            statusCode,
            originalError: originalError?.message,
            userMessage: 'Failed to send notification. Please check your webhook configuration.',
        });
    }
}

/**
 * Validation-related errors
 */
export class ValidationError extends ExtensionError {
    constructor(message, details = {}) {
        super(message, ERROR_CODES.VALIDATION_ERROR, details);
    }

    static fromFieldValidation(field, value, rule) {
        return new ValidationError(`Validation failed for field "${field}"`, {
            field,
            value,
            rule,
            userMessage: `Invalid ${field}. Please check the format and try again.`,
        });
    }

    static fromMultipleFields(errors) {
        const fieldNames = errors.map(e => e.field).join(', ');
        return new ValidationError(`Validation failed for fields: ${fieldNames}`, {
            fieldErrors: errors,
            userMessage: 'Please correct the highlighted fields and try again.',
        });
    }
}

/**
 * File parsing and processing errors
 */
export class ParsingError extends ExtensionError {
    constructor(message, details = {}) {
        super(message, ERROR_CODES.PARSING_ERROR, details);
    }

    static fromCSVError(fileName, lineNumber, originalError) {
        return new ParsingError(`CSV parsing failed at line ${lineNumber}`, {
            fileName,
            lineNumber,
            originalError: originalError?.message,
            userMessage: `Failed to parse file "${fileName}" at line ${lineNumber}. Please check the file format.`,
        });
    }

    static fromExcelError(fileName, originalError) {
        return new ParsingError(`Excel file parsing failed: ${fileName}`, {
            fileName,
            originalError: originalError?.message,
            userMessage: `Failed to parse Excel file "${fileName}". Please ensure it's a valid Excel file.`,
        });
    }
}

/**
 * Alarm and scheduling errors
 */
export class AlarmError extends ExtensionError {
    constructor(message, details = {}) {
        super(message, ERROR_CODES.ALARM_ERROR, details);
    }

    static fromAlarmCreation(alarmName, originalError) {
        return new AlarmError(`Failed to create alarm: ${alarmName}`, {
            alarmName,
            originalError: originalError?.message,
            userMessage:
                'Failed to schedule automatic checks. Please try restarting the extension.',
        });
    }

    static fromAlarmTrigger(alarmName, serviceType, originalError) {
        return new AlarmError(`Alarm trigger failed: ${alarmName}`, {
            alarmName,
            serviceType,
            originalError: originalError?.message,
            userMessage: 'Automatic check failed. You can try running a manual check instead.',
        });
    }
}

/**
 * DOM manipulation and content script errors
 */
export class DOMError extends ExtensionError {
    constructor(message, details = {}) {
        super(message, ERROR_CODES.DOM_ERROR, details);
    }

    static fromElementNotFound(selector, context = 'page') {
        return new DOMError(`Element not found: ${selector}`, {
            selector,
            context,
            userMessage:
                'Page content not found. Please ensure you are on the correct Amazon logistics page.',
        });
    }

    static fromDataExtraction(operation, originalError) {
        return new DOMError(`Data extraction failed: ${operation}`, {
            operation,
            originalError: originalError?.message,
            userMessage: 'Failed to read data from the page. The page format may have changed.',
        });
    }
}

/**
 * File handling errors
 */
export class FileError extends ExtensionError {
    constructor(message, details = {}) {
        super(message, ERROR_CODES.FILE_ERROR, details);
    }

    static fromFileRead(fileName, originalError) {
        return new FileError(`File read failed: ${fileName}`, {
            fileName,
            originalError: originalError?.message,
            userMessage: `Failed to read file "${fileName}". Please ensure the file is not corrupted.`,
        });
    }

    static fromFileSize(fileName, size, maxSize) {
        return new FileError(`File too large: ${fileName}`, {
            fileName,
            size,
            maxSize,
            userMessage: `File "${fileName}" is too large. Maximum size is ${Math.round(
                maxSize / 1024 / 1024
            )}MB.`,
        });
    }

    static fromFileType(fileName, extension, allowedExtensions) {
        return new FileError(`Unsupported file type: ${extension}`, {
            fileName,
            extension,
            allowedExtensions,
            userMessage: `File type "${extension}" is not supported. Please use: ${allowedExtensions.join(
                ', '
            )}`,
        });
    }
}

/**
 * Error handling utilities
 */
export class ErrorHandler {
    static logError(error, context = '') {
        const errorInfo = {
            context,
            timestamp: new Date().toISOString(),
            error:
                error instanceof ExtensionError
                    ? error.toJSON()
                    : {
                          name: error.name,
                          message: error.message,
                          stack: error.stack,
                      },
        };

        console.error('Extension Error:', errorInfo);

        // In production, you might want to send this to a logging service
        if (typeof window !== 'undefined' && window.gtag) {
            window.gtag('event', 'exception', {
                description: error.message,
                fatal: false,
            });
        }
    }

    static notifyUser(error, fallbackMessage = 'An unexpected error occurred') {
        const message = error instanceof ExtensionError ? error.getUserMessage() : fallbackMessage;

        // Show browser notification if permissions allow
        if (browser?.notifications?.create) {
            browser.notifications
                .create({
                    type: 'basic',
                    iconUrl: 'icons/icon.svg',
                    title: 'DSP Extension Error',
                    message,
                })
                .catch(console.error);
        }

        // Log to console as fallback
        console.warn('User notification:', message);
    }

    static async handleAsyncError(promise, context = '') {
        try {
            return await promise;
        } catch (error) {
            this.logError(error, context);
            throw error;
        }
    }

    static createErrorBoundary(fn, context = '') {
        return async (...args) => {
            try {
                return await fn(...args);
            } catch (error) {
                this.logError(error, context);
                this.notifyUser(error);
                throw error;
            }
        };
    }
}

// Convenience function for wrapping async operations
export function withErrorHandling(fn, context = '') {
    return ErrorHandler.createErrorBoundary(fn, context);
}
