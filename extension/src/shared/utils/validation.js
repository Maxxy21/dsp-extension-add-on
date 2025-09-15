/**
 * Validation utility functions
 */

/**
 * Validate DSP code format
 * @param {string} dspCode - DSP code to validate
 * @returns {boolean} True if valid DSP code
 */
export function isValidDSPCode(dspCode) {
    if (!dspCode || typeof dspCode !== 'string') {
        return false;
    }

    // DSP codes are typically alphanumeric, 3-6 characters
    const dspPattern = /^[A-Za-z0-9]{3,6}$/;
    return dspPattern.test(dspCode.trim());
}

/**
 * Validate webhook URL
 * @param {string} url - URL to validate
 * @returns {boolean} True if valid webhook URL
 */
export function isValidWebhookUrl(url) {
    if (!url || typeof url !== 'string') {
        return false;
    }

    try {
        const urlObj = new URL(url);
        // Only allow HTTPS URLs and specific domains
        return (
            urlObj.protocol === 'https:' &&
            (urlObj.hostname.includes('hooks.chime.aws') ||
                urlObj.hostname.includes('discord.com') ||
                urlObj.hostname.includes('slack.com'))
        );
    } catch {
        return false;
    }
}

/**
 * Validate message content
 * @param {string} message - Message to validate
 * @param {number} maxLength - Maximum length allowed
 * @returns {object} Validation result with isValid and errors
 */
export function validateMessage(message, maxLength = 2000) {
    const errors = [];

    if (!message || typeof message !== 'string') {
        errors.push('Message is required');
        return { isValid: false, errors };
    }

    const trimmed = message.trim();

    if (trimmed.length === 0) {
        errors.push('Message cannot be empty');
    }

    if (trimmed.length > maxLength) {
        errors.push(`Message cannot exceed ${maxLength} characters`);
    }

    // Check for potential malicious content
    const dangerousPatterns = [/<script/i, /javascript:/i, /on\w+\s*=/i];

    if (dangerousPatterns.some(pattern => pattern.test(trimmed))) {
        errors.push('Message contains potentially unsafe content');
    }

    return {
        isValid: errors.length === 0,
        errors,
        cleanMessage: trimmed,
    };
}

/**
 * Validate service type
 * @param {string} serviceType - Service type to validate
 * @returns {boolean} True if valid service type
 */
export function isValidServiceType(serviceType) {
    const validTypes = ['cycle1', 'samedayB', 'samedayC'];
    return validTypes.includes(serviceType);
}

/**
 * Validate file extension
 * @param {string} fileName - File name to validate
 * @param {Array<string>} allowedExtensions - Allowed extensions
 * @returns {boolean} True if valid extension
 */
export function isValidFileExtension(fileName, allowedExtensions = ['.csv', '.xlsx', '.xls']) {
    if (!fileName || typeof fileName !== 'string') {
        return false;
    }

    const extension = fileName.toLowerCase().substring(fileName.lastIndexOf('.'));
    return allowedExtensions.includes(extension);
}

/**
 * Sanitize text input
 * @param {string} input - Input to sanitize
 * @returns {string} Sanitized input
 */
export function sanitizeInput(input) {
    if (!input || typeof input !== 'string') {
        return '';
    }

    return input
        .trim()
        .replace(/[<>]/g, '') // Remove potential HTML tags
        .replace(/javascript:/gi, '') // Remove javascript: protocols
        .substring(0, 1000); // Limit length
}
