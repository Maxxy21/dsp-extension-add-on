/**
 * Content Script Entry Point
 * Main content script for the DSP Management Extension
 */

import { ServiceTypeInferrer } from './service-inferrer.js';
import { DSPDataParser } from './data-parser.js';
import { MismatchHighlighter } from './highlighter.js';
import { ManifestExtractor } from './extractors/manifest-extractor.js';
import { BackbriefExtractor } from './extractors/backbrief-extractor.js';

import { MESSAGE_TYPES, URL_PATTERNS } from '../shared/constants.js';
import { ErrorHandler, withErrorHandling } from '../shared/errors.js';

class ContentScriptManager {
    constructor() {
        this.serviceInferrer = new ServiceTypeInferrer();
        this.dataParser = new DSPDataParser(this.serviceInferrer);
        this.highlighter = new MismatchHighlighter();
        this.manifestExtractor = new ManifestExtractor();
        this.backbriefExtractor = new BackbriefExtractor();

        this.isInitialized = false;
        this.currentData = new Map();
        this.isAmazonLogisticsPage = this.checkIfAmazonLogisticsPage();

        this.setupEventListeners();
        this.initialize();
    }

    /**
     * Check if current page is an Amazon logistics page
     * @returns {boolean} Whether this is an Amazon logistics page
     */
    checkIfAmazonLogisticsPage() {
        const url = window.location.href;

        return (
            URL_PATTERNS.AMAZON_LOGISTICS.test(url) ||
            URL_PATTERNS.ROUTE_PLANNING.test(url) ||
            URL_PATTERNS.C3_AMAZON.test(url)
        );
    }

    /**
     * Initialize the content script
     */
    async initialize() {
        try {
            if (!this.isAmazonLogisticsPage) {
                console.log('ℹ️ Not an Amazon logistics page, content script inactive');
                return;
            }

            console.log('🚀 Initializing DSP Management content script...');

            // Wait for page to be ready
            await this.waitForPageReady();

            // Initialize service type detection
            await this.serviceInferrer.initialize();

            // Initial data parsing
            await this.refreshData();

            this.isInitialized = true;

            console.log('✅ Content script initialized successfully');

            // Set up periodic refresh
            this.setupPeriodicRefresh();
        } catch (error) {
            ErrorHandler.logError(error, 'ContentScriptManager.initialize');
            console.error('❌ Content script initialization failed:', error);
        }
    }

    /**
     * Wait for page to be ready
     * @returns {Promise<void>}
     */
    waitForPageReady() {
        return new Promise(resolve => {
            if (document.readyState === 'complete') {
                resolve();
                return;
            }

            const onReady = () => {
                if (document.readyState === 'complete') {
                    document.removeEventListener('readystatechange', onReady);
                    resolve();
                }
            };

            document.addEventListener('readystatechange', onReady);

            // Fallback timeout
            setTimeout(resolve, 5000);
        });
    }

    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // Listen for messages from background script
        browser.runtime.onMessage.addListener(
            withErrorHandling(this.handleMessage.bind(this), 'ContentScriptManager.handleMessage')
        );

        // Listen for page navigation
        window.addEventListener(
            'popstate',
            withErrorHandling(
                this.handleNavigation.bind(this),
                'ContentScriptManager.handleNavigation'
            )
        );

        // Listen for dynamic content changes
        this.setupMutationObserver();
    }

    /**
     * Set up mutation observer for dynamic content
     */
    setupMutationObserver() {
        const observer = new MutationObserver(
            withErrorHandling(
                this.handleDOMChanges.bind(this),
                'ContentScriptManager.handleDOMChanges'
            )
        );

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: false,
        });
    }

    /**
     * Handle DOM changes
     * @param {Array} mutations - DOM mutations
     */
    handleDOMChanges(mutations) {
        // Debounce DOM changes
        clearTimeout(this.domChangeTimeout);
        this.domChangeTimeout = setTimeout(async () => {
            try {
                // Check if significant changes occurred
                const hasTableChanges = mutations.some(mutation =>
                    Array.from(mutation.addedNodes).some(
                        node =>
                            node.nodeType === Node.ELEMENT_NODE &&
                            (node.tagName === 'TABLE' || node.querySelector('table'))
                    )
                );

                if (hasTableChanges) {
                    console.log('📊 Table changes detected, refreshing data...');
                    await this.refreshData();
                }
            } catch (error) {
                console.warn('DOM change handling failed:', error);
            }
        }, 1000);
    }

    /**
     * Handle navigation events
     */
    async handleNavigation() {
        console.log('🔄 Navigation detected, reinitializing...');

        this.isInitialized = false;
        this.currentData.clear();
        this.highlighter.clearAllHighlights();

        // Re-check if page is Amazon logistics
        this.isAmazonLogisticsPage = this.checkIfAmazonLogisticsPage();

        if (this.isAmazonLogisticsPage) {
            await this.initialize();
        }
    }

    /**
     * Set up periodic data refresh
     */
    setupPeriodicRefresh() {
        // Refresh every 5 minutes
        setInterval(async () => {
            if (this.isInitialized && document.visibilityState === 'visible') {
                try {
                    console.log('🔄 Periodic data refresh...');
                    await this.refreshData();
                } catch (error) {
                    console.warn('Periodic refresh failed:', error);
                }
            }
        }, 5 * 60 * 1000);
    }

    /**
     * Refresh all data
     * @returns {Promise<void>}
     */
    async refreshData() {
        try {
            console.log('🔄 Refreshing DSP data...');

            // Re-detect service types in case page changed
            await this.serviceInferrer.initialize();

            // Parse DSP data
            this.currentData = await this.dataParser.parseAllServiceTypes();

            // Auto-highlight mismatches if any found
            if (this.currentData.size > 0) {
                const mismatches = this.dataParser.getMismatchedDSPs();
                if (mismatches.length > 0) {
                    console.log(`🎨 Auto-highlighting ${mismatches.length} mismatches`);
                    this.highlighter.highlightAllMismatches(this.currentData);
                }
            }

            console.log('✅ Data refresh complete');
        } catch (error) {
            console.error('Data refresh failed:', error);
            throw error;
        }
    }

    /**
     * Handle messages from background script
     * @param {object} message - Message object
     * @param {object} sender - Sender information
     * @returns {Promise<object>} Response object
     */
    async handleMessage(message, _sender) {
        console.log('📨 Content script received message:', message.action);

        try {
            switch (message.action) {
                case MESSAGE_TYPES.MANUAL_CHECK:
                    return await this.handleManualCheck(message);

                case MESSAGE_TYPES.SCAN_RISKS:
                    return await this.handleScanRisks(message);

                case 'refreshData':
                    await this.refreshData();
                    return { success: true };

                case 'highlightMismatches':
                    return await this.handleHighlightMismatches(message);

                case 'extractManifest':
                    return this.handleExtractManifest();

                case 'extractBackbrief':
                    return this.handleExtractBackbrief(message);

                case 'getSummaryData':
                    return this.handleGetSummaryData(message);

                case 'getPageInfo':
                    return this.handleGetPageInfo();

                default:
                    console.warn('Unknown message action:', message.action);
                    return { success: false, error: 'Unknown action' };
            }
        } catch (error) {
            ErrorHandler.logError(error, `ContentScriptManager.handleMessage.${message.action}`);
            return { success: false, error: error.message };
        }
    }

    /**
     * Handle manual check request
     * @param {object} message - Message data
     * @returns {Promise<object>} Check results
     */
    async handleManualCheck(_message) {
        console.log('🔍 Performing manual check...');

        await this.refreshData();

        const summary = this.dataParser.getSummaryStats();
        const mismatches = this.dataParser.getMismatchedDSPs();

        return {
            success: true,
            summary,
            mismatches,
            serviceTypes: Array.from(this.serviceInferrer.getCurrentPageServiceTypes()),
            timestamp: new Date().toISOString(),
        };
    }

    /**
     * Handle risk scanning request
     * @param {object} message - Message data
     * @returns {Promise<object>} Risk scan results
     */
    handleScanRisks(_message) {
        console.log('⚠️ Scanning for risks...');

        try {
            const risks = this.backbriefExtractor.extractOngoingRisksFromPage();

            return {
                success: true,
                risks,
                riskCount: risks.length,
                timestamp: new Date().toISOString(),
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                risks: [],
            };
        }
    }

    /**
     * Handle highlight mismatches request
     * @param {object} message - Message data
     * @returns {Promise<object>} Highlighting results
     */
    handleHighlightMismatches(message) {
        const { serviceType, clear = false } = message;

        if (clear) {
            this.highlighter.clearAllHighlights();
            return { success: true, action: 'cleared' };
        }

        if (serviceType) {
            // Highlight specific service type
            const dspMap = this.currentData.get(serviceType);
            if (dspMap) {
                const active = this.highlighter.toggleServiceTypeHighlighting(serviceType, dspMap);
                return { success: true, serviceType, active };
            } else {
                return { success: false, error: `No data for service type: ${serviceType}` };
            }
        } else {
            // Highlight all mismatches
            const results = this.highlighter.highlightAllMismatches(this.currentData);
            return { success: true, results };
        }
    }

    /**
     * Handle manifest extraction request
     * @param {object} message - Message data
     * @returns {Promise<object>} Extraction results
     */
    handleExtractManifest() {
        console.log('📦 Extracting manifest data...');

        try {
            const manifestData = this.manifestExtractor.extractManifestTrackingMapFromPage();

            return {
                success: true,
                data: manifestData,
                count: Object.keys(manifestData).length,
                timestamp: new Date().toISOString(),
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                data: {},
            };
        }
    }

    /**
     * Handle backbrief extraction request
     * @param {object} message - Message data
     * @returns {Promise<object>} Extraction results
     */
    handleExtractBackbrief(message) {
        console.log('📋 Extracting backbrief data...');

        const { includeReasons = [], mapUnableToAccess = true } = message;

        try {
            const backbriefData = this.backbriefExtractor.extractBackbriefFromPage(
                includeReasons,
                mapUnableToAccess
            );

            return {
                success: true,
                data: backbriefData,
                count: backbriefData.length,
                timestamp: new Date().toISOString(),
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                data: [],
            };
        }
    }

    /**
     * Handle get summary data request
     * @param {object} message - Message data
     * @returns {Promise<object>} Summary data
     */
    handleGetSummaryData(message) {
        const { targetDSPs = [], paidTimeMinutes = 525 } = message;

        try {
            const summaryData = this.manifestExtractor.extractDSPSummariesFromRoutePlanning(
                targetDSPs,
                paidTimeMinutes
            );

            return {
                success: true,
                data: summaryData,
                count: Object.keys(summaryData).length,
                timestamp: new Date().toISOString(),
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                data: {},
            };
        }
    }

    /**
     * Handle get page info request
     * @returns {object} Page information
     */
    handleGetPageInfo() {
        return {
            success: true,
            pageInfo: {
                url: window.location.href,
                title: document.title,
                isAmazonLogistics: this.isAmazonLogisticsPage,
                pageType: this.serviceInferrer.getPageType(),
                serviceTypes: Array.from(this.serviceInferrer.getCurrentPageServiceTypes()),
                isInitialized: this.isInitialized,
                dataCount: this.currentData.size,
                tableCount: document.querySelectorAll('table').length,
            },
        };
    }

    /**
     * Get current status for debugging
     * @returns {object} Current status
     */
    getStatus() {
        return {
            initialized: this.isInitialized,
            isAmazonPage: this.isAmazonLogisticsPage,
            serviceTypes: Array.from(this.serviceInferrer.getCurrentPageServiceTypes()),
            dataCount: this.currentData.size,
            highlightStats: this.highlighter.getStatistics(),
            lastRefresh: this.dataParser.lastUpdateTime,
        };
    }
}

// Initialize content script manager
const contentManager = new ContentScriptManager();

// Make it available globally for debugging
window.dspContentManager = contentManager;

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ContentScriptManager };
}
