/**
 * Parsing utility functions shared across the extension
 */

/**
 * Safely parse integer values
 * @param {string|number} value - Value to parse
 * @param {number} fallback - Fallback value if parsing fails
 * @returns {number} Parsed integer or fallback
 */
export function parseIntSafe(value, fallback = 0) {
    if (value === null || value === undefined || value === '') {
        return fallback;
    }

    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? fallback : parsed;
}

/**
 * Safely parse float values
 * @param {string|number} value - Value to parse
 * @param {number} fallback - Fallback value if parsing fails
 * @returns {number} Parsed float or fallback
 */
export function parseFloatSafe(value, fallback = 0) {
    if (value === null || value === undefined || value === '') {
        return fallback;
    }

    const parsed = parseFloat(value);
    return isNaN(parsed) ? fallback : parsed;
}

/**
 * Parse CSV text into array of objects
 * @param {string} csvText - CSV text to parse
 * @param {object} options - Parsing options
 * @returns {Array} Array of parsed objects
 */
export function parseCSV(csvText, options = {}) {
    const { delimiter = ',', headers = true, skipEmptyLines = true } = options;

    if (!csvText || typeof csvText !== 'string') {
        return [];
    }

    const lines = csvText.trim().split('\n');
    if (lines.length === 0) {
        return [];
    }

    let headerRow = null;
    let dataRows = lines;

    if (headers) {
        headerRow = lines[0].split(delimiter).map(h => h.trim());
        dataRows = lines.slice(1);
    }

    return dataRows
        .filter(line => (skipEmptyLines ? line.trim() : true))
        .map((line, _index) => {
            const values = line.split(delimiter).map(v => v.trim());

            if (headers && headerRow) {
                const obj = {};
                headerRow.forEach((header, i) => {
                    obj[header] = values[i] || '';
                });
                return obj;
            }

            return values;
        })
        .filter(row => row && (Array.isArray(row) ? row.length > 0 : Object.keys(row).length > 0));
}

/**
 * Parse batch text (newline-separated values)
 * @param {string} text - Text to parse
 * @returns {Array<string>} Array of trimmed, non-empty lines
 */
export function parseBatchText(text) {
    if (!text || typeof text !== 'string') {
        return [];
    }

    return text
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);
}

/**
 * Extract numeric value from text
 * @param {string} text - Text containing numeric value
 * @returns {number|null} Extracted number or null
 */
export function extractNumber(text) {
    if (!text) {
        return null;
    }

    const match = text.toString().match(/(\d+)/);
    return match ? parseInt(match[1], 10) : null;
}

/**
 * Clean and normalize text
 * @param {string} text - Text to clean
 * @returns {string} Cleaned text
 */
export function cleanText(text) {
    if (!text) {
        return '';
    }

    return text
        .toString()
        .trim()
        .replace(/\s+/g, ' ')
        .replace(/[^\w\s-]/g, '');
}
