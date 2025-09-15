/**
 * URL utility functions for handling Amazon logistics URLs
 */

/**
 * Build scheduling URL based on settings and parameters
 * @param {object} settings - Settings object
 * @param {boolean} isCycle1 - Whether this is for cycle1 service
 * @param {string} dateStr - Date string in YYYY-MM-DD format
 * @returns {string} Complete scheduling URL
 */
export function buildSchedulingUrl(settings, isCycle1, dateStr) {
    const baseConfigured = settings.schedulingBaseUrl || '';
    const serviceAreaId = settings.serviceAreaId || '';
    const defaultBase = 'https://logistics.amazon.co.uk/internal/scheduling/dsps';

    let baseUrl =
        baseConfigured ||
        (serviceAreaId
            ? `${defaultBase}?serviceAreaId=${encodeURIComponent(serviceAreaId)}`
            : defaultBase);

    if (!baseUrl.includes('?')) {
        baseUrl += '?';
    } else if (!baseUrl.endsWith('&')) {
        baseUrl += '&';
    }

    const params = new URLSearchParams();

    if (isCycle1) {
        params.set('date', dateStr);
        params.set('serviceType', 'AmazonDelivered');
    } else {
        params.set('date', dateStr);
        params.set('serviceType', 'DSPDelivered');
    }

    return baseUrl + params.toString();
}

/**
 * Normalize Amazon logistics URL
 * @param {string} url - URL to normalize
 * @returns {string} Normalized URL
 */
export function normalizeLogisticsUrl(url) {
    if (!url) {
        return '';
    }

    try {
        const urlObj = new URL(url);

        // Ensure HTTPS
        urlObj.protocol = 'https:';

        // Normalize hostname for Amazon logistics
        if (urlObj.hostname.includes('amazon.co.uk')) {
            urlObj.hostname = 'logistics.amazon.co.uk';
        }

        return urlObj.toString();
    } catch {
        return url; // Return original if URL parsing fails
    }
}

/**
 * Extract service area ID from URL
 * @param {string} url - URL to extract from
 * @returns {string|null} Service area ID or null
 */
export function extractServiceAreaId(url) {
    if (!url) {
        return null;
    }

    try {
        const urlObj = new URL(url);
        return urlObj.searchParams.get('serviceAreaId');
    } catch {
        // Fallback: try regex extraction
        const match = url.match(/serviceAreaId=([^&]+)/);
        return match ? decodeURIComponent(match[1]) : null;
    }
}

/**
 * Check if URL is a valid Amazon logistics URL
 * @param {string} url - URL to validate
 * @returns {boolean} True if valid Amazon logistics URL
 */
export function isAmazonLogisticsUrl(url) {
    if (!url) {
        return false;
    }

    try {
        const urlObj = new URL(url);

        return (
            urlObj.protocol === 'https:' &&
            (urlObj.hostname.includes('logistics.amazon.co.uk') ||
                urlObj.hostname.includes('route.planning.last-mile.a2z.com') ||
                urlObj.hostname.includes('c3.amazon.com'))
        );
    } catch {
        return false;
    }
}

/**
 * Build route planning URL
 * @param {object} params - URL parameters
 * @returns {string} Route planning URL
 */
export function buildRoutePlanningUrl(params = {}) {
    const baseUrl = 'https://logistics.amazon.co.uk/route-planning/';
    const urlParams = new URLSearchParams();

    // Add common parameters
    if (params.date) {
        urlParams.set('date', params.date);
    }

    if (params.serviceAreaId) {
        urlParams.set('serviceAreaId', params.serviceAreaId);
    }

    if (params.dspCode) {
        urlParams.set('dsp', params.dspCode);
    }

    const paramString = urlParams.toString();
    return paramString ? `${baseUrl}?${paramString}` : baseUrl;
}
