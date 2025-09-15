/**
 * Date utility functions shared across the extension
 */

/**
 * Compute the date parameter for a given service type
 * @param {string} serviceType - The service type (e.g., 'cycle1', 'samedayB', 'samedayC')
 * @returns {string} Date string in YYYY-MM-DD format
 */
export function computeDateParam(serviceType) {
    const now = new Date();
    const date = new Date(now);

    // For cycle1, use next day
    if (serviceType === 'cycle1') {
        date.setDate(date.getDate() + 1);
    }

    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');

    return `${yyyy}-${mm}-${dd}`;
}

/**
 * Get the current date in various formats
 * @param {string} format - Format type ('iso', 'display', 'timestamp')
 * @returns {string} Formatted date string
 */
export function getCurrentDate(format = 'iso') {
    const now = new Date();

    switch (format) {
        case 'iso':
            return now.toISOString().split('T')[0];
        case 'display':
            return now.toLocaleDateString('en-GB');
        case 'timestamp':
            return now.toISOString();
        default:
            return now.toISOString().split('T')[0];
    }
}

/**
 * Parse date string safely
 * @param {string} dateStr - Date string to parse
 * @returns {Date|null} Parsed date or null if invalid
 */
export function parseDate(dateStr) {
    if (!dateStr) {
        return null;
    }

    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? null : date;
}

/**
 * Format date for display
 * @param {Date|string} date - Date to format
 * @param {object} options - Formatting options
 * @returns {string} Formatted date string
 */
export function formatDate(date, options = {}) {
    const d = date instanceof Date ? date : parseDate(date);
    if (!d) {
        return 'Invalid Date';
    }

    const defaults = {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    };

    return d.toLocaleDateString('en-GB', { ...defaults, ...options });
}
