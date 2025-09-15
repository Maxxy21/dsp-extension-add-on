/**
 * Service Type Inferrer - Detects available service types on Amazon logistics pages
 */

import { SELECTORS, URL_PATTERNS } from '../shared/constants.js';

export class ServiceTypeInferrer {
    constructor() {
        this.availableServiceTypes = new Set();
        this.currentPageServiceTypes = new Set();
        this.urlParams = null;
        this.pageType = null;
    }

    /**
     * Initialize and detect service types
     * @returns {Promise<Set>} Set of detected service types
     */
    initialize() {
        try {
            console.log('🔍 ServiceTypeInferrer: Analyzing page for available service types...');

            this.urlParams = new URLSearchParams(window.location.search);
            this.pageType = this.detectPageType();

            // Clear previous results
            this.currentPageServiceTypes.clear();

            // Method 1: Check URL parameters for clues
            this.inferFromURLParams();

            // Method 2: Scan DOM for service type indicators
            this.inferFromDOM();

            // Method 3: Check table structure for service type rows
            this.inferFromTableStructure();

            console.log(
                '✅ ServiceTypeInferrer: Detected service types:',
                Array.from(this.currentPageServiceTypes)
            );

            return this.currentPageServiceTypes;
        } catch (error) {
            console.error('ServiceTypeInferrer initialization failed:', error);
            throw error;
        }
    }

    /**
     * Detect the type of Amazon logistics page
     * @returns {string} Page type identifier
     */
    detectPageType() {
        const url = window.location.href;

        if (URL_PATTERNS.AMAZON_LOGISTICS.test(url)) {
            if (url.includes('/scheduling/dsps')) {
                return 'scheduling';
            } else if (url.includes('/internal/')) {
                return 'internal';
            }
            return 'logistics';
        }

        if (URL_PATTERNS.ROUTE_PLANNING.test(url)) {
            return 'route_planning';
        }

        if (URL_PATTERNS.C3_AMAZON.test(url)) {
            return 'c3';
        }

        return 'unknown';
    }

    /**
     * Infer service types from URL parameters
     * @returns {Promise<void>}
     */
    inferFromURLParams() {
        try {
            const serviceType = this.urlParams.get('serviceType');

            if (serviceType) {
                console.log(`🔗 Found serviceType in URL: ${serviceType}`);

                // Map URL service type to our internal types
                const mappedType = this.mapURLServiceType(serviceType);
                if (mappedType) {
                    this.currentPageServiceTypes.add(mappedType);
                }
            }

            // Infer from other URL patterns
            if (this.pageType === 'route_planning') {
                // Route planning typically shows all service types
                this.currentPageServiceTypes.add('Standard Parcel');
                this.currentPageServiceTypes.add('Multi-Use');
                this.currentPageServiceTypes.add('Sameday Parcel');
            }

            console.log('🔗 URL-based inference complete');
        } catch (error) {
            console.warn('URL parameter inference failed:', error);
        }
    }

    /**
     * Map URL service type parameter to internal service type
     * @param {string} urlServiceType - Service type from URL
     * @returns {string|null} Mapped service type
     */
    mapURLServiceType(urlServiceType) {
        const mapping = {
            AmazonDelivered: 'Standard Parcel',
            DSPDelivered: 'Multi-Use',
            SameDayParcel: 'Sameday Parcel',
            StandardParcel: 'Standard Parcel',
            MultiUse: 'Multi-Use',
            SamedayParcel: 'Sameday Parcel',
        };

        return mapping[urlServiceType] || null;
    }

    /**
     * Infer service types from DOM structure
     * @returns {Promise<void>}
     */
    async inferFromDOM() {
        try {
            // Look for service type expandable elements
            const serviceTypeElements = document.querySelectorAll(
                SELECTORS.SERVICE_TYPE_EXPANDABLE
            );

            for (const element of serviceTypeElements) {
                const serviceTypeText = element.textContent?.trim();
                if (serviceTypeText) {
                    const normalized = this.normalizeServiceType(serviceTypeText);
                    if (normalized) {
                        this.currentPageServiceTypes.add(normalized);
                        console.log(`🏷️ Found service type in DOM: ${normalized}`);
                    }
                }
            }

            // Look for other service type indicators
            await this.scanForServiceTypeIndicators();

            console.log('🔍 DOM-based inference complete');
        } catch (error) {
            console.warn('DOM inference failed:', error);
        }
    }

    /**
     * Scan for additional service type indicators in the DOM
     * @returns {Promise<void>}
     */
    scanForServiceTypeIndicators() {
        const indicators = [
            { pattern: /standard\s*parcel/i, type: 'Standard Parcel' },
            { pattern: /cycle\s*1/i, type: 'Standard Parcel' },
            { pattern: /multi[-\s]*use/i, type: 'Multi-Use' },
            { pattern: /sameday\s*b/i, type: 'Multi-Use' },
            { pattern: /sameday\s*parcel/i, type: 'Sameday Parcel' },
            { pattern: /sameday\s*c/i, type: 'Sameday Parcel' },
            { pattern: /medium\s*van/i, type: 'Standard Parcel Medium Van' },
        ];

        const textContent = document.body.textContent || '';

        for (const { pattern, type } of indicators) {
            if (pattern.test(textContent)) {
                this.currentPageServiceTypes.add(type);
                console.log(`🔍 Found service type indicator: ${type}`);
            }
        }
    }

    /**
     * Infer service types from table structure
     * @returns {Promise<void>}
     */
    inferFromTableStructure() {
        try {
            const tables = Array.from(document.querySelectorAll(SELECTORS.TABLE));

            for (const table of tables) {
                this.analyzeTableForServiceTypes(table);
            }

            console.log('📊 Table structure inference complete');
        } catch (error) {
            console.warn('Table structure inference failed:', error);
        }
    }

    /**
     * Analyze a specific table for service type information
     * @param {Element} table - Table element to analyze
     * @returns {Promise<void>}
     */
    analyzeTableForServiceTypes(table) {
        try {
            const rows = Array.from(table.querySelectorAll(SELECTORS.TABLE_ROWS));

            for (const row of rows) {
                // Look for service type headers
                const serviceTypeCell = row.querySelector(SELECTORS.SERVICE_TYPE_EXPANDABLE);
                if (serviceTypeCell) {
                    const serviceTypeText = serviceTypeCell.textContent?.trim();
                    if (serviceTypeText) {
                        const normalized = this.normalizeServiceType(serviceTypeText);
                        if (normalized) {
                            this.currentPageServiceTypes.add(normalized);
                        }
                    }
                }

                // Look for other service type indicators in row text
                const rowText = row.textContent || '';
                this.scanTextForServiceTypes(rowText);
            }
        } catch (error) {
            console.warn('Table analysis failed:', error);
        }
    }

    /**
     * Scan text content for service type mentions
     * @param {string} text - Text to scan
     */
    scanTextForServiceTypes(text) {
        const patterns = [
            { regex: /standard\s+parcel(?!\s+medium\s+van)/i, type: 'Standard Parcel' },
            { regex: /standard\s+parcel\s+medium\s+van/i, type: 'Standard Parcel Medium Van' },
            { regex: /multi[-\s]*use/i, type: 'Multi-Use' },
            { regex: /sameday\s+parcel/i, type: 'Sameday Parcel' },
            { regex: /cycle\s*1/i, type: 'Standard Parcel' },
            { regex: /sameday\s*b/i, type: 'Multi-Use' },
            { regex: /sameday\s*c/i, type: 'Sameday Parcel' },
        ];

        for (const { regex, type } of patterns) {
            if (regex.test(text)) {
                this.currentPageServiceTypes.add(type);
            }
        }
    }

    /**
     * Normalize service type text to standard format
     * @param {string} text - Raw service type text
     * @returns {string|null} Normalized service type
     */
    normalizeServiceType(text) {
        if (!text) {
            return null;
        }

        const normalized = text.trim().toLowerCase();

        // Direct mappings
        const mappings = {
            'standard parcel': 'Standard Parcel',
            'standard parcel medium van': 'Standard Parcel Medium Van',
            'multi-use': 'Multi-Use',
            'multi use': 'Multi-Use',
            multiuse: 'Multi-Use',
            'sameday parcel': 'Sameday Parcel',
            'same day parcel': 'Sameday Parcel',
            'sameday b': 'Multi-Use',
            samedayb: 'Multi-Use',
            'sameday c': 'Sameday Parcel',
            samedayc: 'Sameday Parcel',
            'cycle 1': 'Standard Parcel',
            cycle1: 'Standard Parcel',
        };

        if (mappings[normalized]) {
            return mappings[normalized];
        }

        // Fuzzy matching
        if (normalized.includes('standard') && normalized.includes('parcel')) {
            if (normalized.includes('medium') || normalized.includes('van')) {
                return 'Standard Parcel Medium Van';
            }
            return 'Standard Parcel';
        }

        if (
            normalized.includes('multi') ||
            (normalized.includes('same') && normalized.includes('b'))
        ) {
            return 'Multi-Use';
        }

        if (
            normalized.includes('sameday') &&
            (normalized.includes('parcel') || normalized.includes('c'))
        ) {
            return 'Sameday Parcel';
        }

        return null;
    }

    /**
     * Get current page service types
     * @returns {Set} Set of service types
     */
    getCurrentPageServiceTypes() {
        return this.currentPageServiceTypes;
    }

    /**
     * Get all available service types
     * @returns {Set} Set of all available service types
     */
    getAvailableServiceTypes() {
        return this.availableServiceTypes;
    }

    /**
     * Check if a specific service type is available
     * @param {string} serviceType - Service type to check
     * @returns {boolean} Whether service type is available
     */
    hasServiceType(serviceType) {
        return this.currentPageServiceTypes.has(serviceType);
    }

    /**
     * Get page type
     * @returns {string} Page type
     */
    getPageType() {
        return this.pageType;
    }

    /**
     * Force add a service type (for testing or manual override)
     * @param {string} serviceType - Service type to add
     */
    addServiceType(serviceType) {
        this.currentPageServiceTypes.add(serviceType);
        console.log(`➕ Manually added service type: ${serviceType}`);
    }

    /**
     * Remove a service type
     * @param {string} serviceType - Service type to remove
     */
    removeServiceType(serviceType) {
        this.currentPageServiceTypes.delete(serviceType);
        console.log(`➖ Removed service type: ${serviceType}`);
    }

    /**
     * Clear all detected service types
     */
    clear() {
        this.currentPageServiceTypes.clear();
        console.log('🧹 Cleared all detected service types');
    }

    /**
     * Get service type statistics
     * @returns {object} Statistics about detected service types
     */
    getStatistics() {
        return {
            detectedCount: this.currentPageServiceTypes.size,
            detectedTypes: Array.from(this.currentPageServiceTypes),
            pageType: this.pageType,
            hasURL: !!this.urlParams,
            urlServiceType: this.urlParams?.get('serviceType') || null,
        };
    }
}
