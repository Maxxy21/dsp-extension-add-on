// content/content.js - Enhanced with multi-service type support

// Configuration constants
const CONFIG = {
    SELECTORS: {
        SERVICE_TYPE_EXPANDABLE: 'td span.expandable',
        SERVICE_TYPE_ROW: '.serviceTypeRow',
        PROVIDER_NAME: 'td.providerName',
        CONFIRMED_CELL: 'td span[data-bind*="text: confirmed"]',
        ROSTERED_CELL: 'td[data-bind*="text: totalRostered"]',
        TABLE: 'table',
        TABLE_ROWS: 'tr'
    },
    STYLES: {
        HIGHLIGHT_COLOR: '#ffebee'
    },
    SERVICE_TYPES: {
        STANDARD_PARCEL: 'Standard Parcel',
        MULTI_USE: 'Multi-Use',
        SAMEDAY_PARCEL: 'Sameday Parcel'
    }
};

// Utility functions
const Utils = {
    parseInteger(text) {
        if (!text) return 0;
        const cleaned = text.toString().replace(/[^\d-]/g, '');
        const parsed = parseInt(cleaned, 10);
        return isNaN(parsed) ? 0 : parsed;
    },
    
    applyStyles(element, styles) {
        if (element && element.style) {
            Object.assign(element.style, styles);
        }
    },
    
    waitForElement(selector, timeout = 10000) {
        return new Promise((resolve, reject) => {
            const element = document.querySelector(selector);
            if (element) {
                resolve(element);
                return;
            }
            
            const observer = new MutationObserver((mutations, obs) => {
                const element = document.querySelector(selector);
                if (element) {
                    obs.disconnect();
                    resolve(element);
                }
            });
            
            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
            
            setTimeout(() => {
                observer.disconnect();
                reject(new Error(`Element ${selector} not found within ${timeout}ms`));
            }, timeout);
        });
    }
};

// Enhanced DSP Data Parser with multi-service type support
class DSPDataParser {
    constructor() {
        this.dspTotals = {};
        this.currentServiceType = null;
        this.targetServiceType = null;
    }

    async parseTableData(serviceType = 'cycle1') {
        try {
            this.reset();
            this.targetServiceType = serviceType;
            
            console.log(`DSP Parser: Parsing data for service type: ${serviceType}`);
            
            // Wait for table to be present
            await Utils.waitForElement(CONFIG.SELECTORS.TABLE, 5000);
            
            const rows = document.querySelectorAll(CONFIG.SELECTORS.TABLE_ROWS);
            console.log(`DSP Parser: Found ${rows.length} table rows to process`);
            
            if (rows.length === 0) {
                console.warn('DSP Parser: No table rows found');
                return {};
            }
            
            rows.forEach((row, index) => {
                try {
                    this.processRow(row);
                } catch (error) {
                    console.warn(`DSP Parser: Error processing row ${index}:`, error);
                }
            });
            
            console.log(`DSP Parser: Parsed totals for ${serviceType}:`, this.dspTotals);
            return this.dspTotals;
        } catch (error) {
            console.error('DSP Parser: Error parsing table data:', error);
            return {};
        }
    }

    reset() {
        this.dspTotals = {};
        this.currentServiceType = null;
    }

    processRow(row) {
        if (this.isServiceTypeHeader(row)) {
            this.handleServiceTypeHeader(row);
            return;
        }

        // Only process data if we're in the target service type section
        if (!this.isInTargetServiceType()) return;

        if (this.isServiceTypeRow(row)) {
            this.currentServiceType = null;
            return;
        }

        this.extractDSPData(row);
    }

    isServiceTypeHeader(row) {
        try {
            const serviceTypeCell = row.querySelector(CONFIG.SELECTORS.SERVICE_TYPE_EXPANDABLE);
            if (!serviceTypeCell) return false;
            
            const text = serviceTypeCell.textContent.trim();
            
            // Check if this row contains any of our target service types
            const isHeader = Object.values(CONFIG.SERVICE_TYPES).includes(text);
            
            if (isHeader) {
                console.log(`DSP Parser: Found service type header: ${text}`);
            }
            
            return isHeader;
        } catch (error) {
            console.warn('DSP Parser: Error checking service type header:', error);
            return false;
        }
    }

    handleServiceTypeHeader(row) {
        const serviceTypeCell = row.querySelector(CONFIG.SELECTORS.SERVICE_TYPE_EXPANDABLE);
        const serviceTypeName = serviceTypeCell.textContent.trim();
        
        // Map service type names to our internal identifiers
        const serviceTypeMapping = {
            [CONFIG.SERVICE_TYPES.STANDARD_PARCEL]: 'cycle1',
            [CONFIG.SERVICE_TYPES.MULTI_USE]: 'samedayB',
            [CONFIG.SERVICE_TYPES.SAMEDAY_PARCEL]: 'samedayC'
        };
        
        this.currentServiceType = serviceTypeMapping[serviceTypeName];
        console.log(`DSP Parser: Entering service type section: ${serviceTypeName} (${this.currentServiceType})`);
    }

    isInTargetServiceType() {
        return this.currentServiceType === this.targetServiceType;
    }

    isServiceTypeRow(row) {
        return row && row.classList && row.classList.contains('serviceTypeRow');
    }

    extractDSPData(row) {
        try {
            const dspNameCell = row.querySelector(CONFIG.SELECTORS.PROVIDER_NAME);
            const confirmedCell = row.querySelector(CONFIG.SELECTORS.CONFIRMED_CELL);
            const rosteredCell = row.querySelector(CONFIG.SELECTORS.ROSTERED_CELL);

            if (!dspNameCell || !confirmedCell || !rosteredCell) {
                return;
            }

            const dspName = dspNameCell.textContent.trim();
            if (!dspName) return;

            const confirmedValue = Utils.parseInteger(confirmedCell.textContent);
            const rosteredValue = Utils.parseInteger(rosteredCell.textContent);

            console.log(`DSP Parser: ${dspName} (${this.targetServiceType}) - Confirmed: ${confirmedValue}, Rostered: ${rosteredValue}`);
            this.updateDSPTotals(dspName, confirmedValue, rosteredValue);
        } catch (error) {
            console.warn('DSP Parser: Error extracting DSP data from row:', error);
        }
    }

    updateDSPTotals(dspName, confirmed, rostered) {
        if (!this.dspTotals[dspName]) {
            this.dspTotals[dspName] = {
                confirmed: 0,
                rostered: 0,
                serviceType: this.targetServiceType
            };
        }

        this.dspTotals[dspName].confirmed += confirmed;
        this.dspTotals[dspName].rostered += rostered;
    }

    async getFilteredMismatchedData(serviceType = 'cycle1') {
        const allData = await this.parseTableData(serviceType);
        console.log(`DSP Parser: All parsed data for ${serviceType}:`, allData);

        const mismatches = [];

        Object.entries(allData).forEach(([dspName, data]) => {
            if (data.confirmed !== data.rostered) {
                const mismatch = {
                    dspName: dspName,
                    confirmed: data.confirmed,
                    rostered: data.rostered,
                    serviceType: serviceType
                };
                mismatches.push(mismatch);
                console.log(`DSP Parser: Mismatch found - ${dspName} (${serviceType}): ${data.confirmed} vs ${data.rostered}`);
            }
        });

        console.log(`DSP Parser: Total mismatches found for ${serviceType}: ${mismatches.length}`);
        return mismatches;
    }
}

// Enhanced Mismatch Highlighter
class MismatchHighlighter {
    constructor() {
        this.currentServiceType = null;
    }

    highlightMismatches(serviceType = 'cycle1') {
        try {
            this.currentServiceType = serviceType;
            const rows = document.querySelectorAll(CONFIG.SELECTORS.TABLE_ROWS);
            console.log(`Highlighter: Processing ${rows.length} rows for highlighting (${serviceType})`);
            
            let highlightCount = 0;
            let inTargetSection = false;
            
            rows.forEach(row => {
                // Check if we're entering a service type section
                const serviceTypeCell = row.querySelector(CONFIG.SELECTORS.SERVICE_TYPE_EXPANDABLE);
                if (serviceTypeCell) {
                    const serviceTypeName = serviceTypeCell.textContent.trim();
                    const serviceTypeMapping = {
                        [CONFIG.SERVICE_TYPES.STANDARD_PARCEL]: 'cycle1',
                        [CONFIG.SERVICE_TYPES.MULTI_USE]: 'samedayB',
                        [CONFIG.SERVICE_TYPES.SAMEDAY_PARCEL]: 'samedayC'
                    };
                    
                    const currentType = serviceTypeMapping[serviceTypeName];
                    inTargetSection = currentType === serviceType;
                    return;
                }
                
                // Check if we're leaving a service type section
                if (row.classList && row.classList.contains('serviceTypeRow')) {
                    inTargetSection = false;
                    return;
                }
                
                // Only highlight if we're in the target service type section
                if (inTargetSection && this.processRow(row)) {
                    highlightCount++;
                }
            });
            
            console.log(`Highlighter: Highlighted ${highlightCount} mismatched rows for ${serviceType}`);
        } catch (error) {
            console.error('Highlighter: Error highlighting mismatches:', error);
        }
    }

    processRow(row) {
        try {
            const confirmedCell = row.querySelector(CONFIG.SELECTORS.CONFIRMED_CELL);
            const rosteredCell = row.querySelector(CONFIG.SELECTORS.ROSTERED_CELL);

            if (!confirmedCell || !rosteredCell) return false;

            const confirmedValue = Utils.parseInteger(confirmedCell.textContent);
            const rosteredValue = Utils.parseInteger(rosteredCell.textContent);
            
            if (confirmedValue !== rosteredValue && (confirmedValue > 0 || rosteredValue > 0)) {
                this.highlightCells(confirmedCell, rosteredCell, confirmedValue, rosteredValue);
                return true;
            }
            return false;
        } catch (error) {
            console.warn('Highlighter: Error processing row:', error);
            return false;
        }
    }

    highlightCells(confirmedCell, rosteredCell, confirmedValue, rosteredValue) {
        try {
            const serviceTypeText = this.getServiceTypeDisplayName(this.currentServiceType);
            const tooltip = `${serviceTypeText} Mismatch - Confirmed: ${confirmedValue}, Rostered: ${rosteredValue}`;

            // Highlight confirmed cell's parent
            if (confirmedCell.parentElement) {
                confirmedCell.parentElement.style.backgroundColor = CONFIG.STYLES.HIGHLIGHT_COLOR;
                confirmedCell.parentElement.title = tooltip;
            }
            
            // Highlight rostered cell
            rosteredCell.style.backgroundColor = CONFIG.STYLES.HIGHLIGHT_COLOR;
            rosteredCell.title = tooltip;
            
            console.log(`Highlighter: Applied highlighting for ${this.currentServiceType} mismatch ${confirmedValue} vs ${rosteredValue}`);
        } catch (error) {
            console.warn('Highlighter: Error applying highlight styles:', error);
        }
    }

    getServiceTypeDisplayName(serviceType) {
        const mapping = {
            'cycle1': 'Cycle 1',
            'samedayB': 'Sameday B',
            'samedayC': 'Sameday C'
        };
        return mapping[serviceType] || serviceType;
    }
}

// Enhanced Main Application Class
class DSPManagementTool {
    constructor() {
        this.dspParser = new DSPDataParser();
        this.highlighter = new MismatchHighlighter();
        this.initialized = false;
        this.highlightTimeout = null;
    }

    initialize() {
        if (this.initialized) {
            console.log('DSP Tool: Already initialized');
            return;
        }
        
        try {
            console.log('DSP Tool: Initializing...');
            
            // Wait for page to be loaded
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this.setupTool());
            } else {
                this.setupTool();
            }
            
            this.initialized = true;
            console.log('DSP Tool: Initialized successfully');
        } catch (error) {
            console.error('DSP Tool: Error during initialization:', error);
        }
    }

    setupTool() {
        console.log('DSP Tool: Setting up tool...');
        this.setupHighlighting();
        this.setupTableObserver();
    }

    async setupHighlighting() {
        try {
            // Get enabled service types from storage
            const { serviceTypes = { cycle1: true, samedayB: false, samedayC: false } } = 
                await browser.storage.local.get('serviceTypes');
            
            // Highlight all enabled service types with progressive delays
            const delays = [2000, 5000, 8000];
            
            delays.forEach(delay => {
                setTimeout(() => {
                    console.log(`DSP Tool: Running highlighting after ${delay}ms`);
                    
                    // Highlight each enabled service type
                    Object.entries(serviceTypes).forEach(([serviceType, enabled]) => {
                        if (enabled) {
                            console.log(`DSP Tool: Highlighting ${serviceType}`);
                            this.highlighter.highlightMismatches(serviceType);
                        }
                    });
                }, delay);
            });
        } catch (error) {
            console.error('DSP Tool: Error setting up highlighting:', error);
            // Fallback to highlighting cycle1 only
            const delays = [2000, 5000, 8000];
            delays.forEach(delay => {
                setTimeout(() => {
                    this.highlighter.highlightMismatches('cycle1');
                }, delay);
            });
        }
    }

    setupTableObserver() {
        try {
            // Try to find table immediately
            let table = document.querySelector(CONFIG.SELECTORS.TABLE);
            
            if (!table) {
                console.log('DSP Tool: Table not found immediately, setting up observer to wait for it');
                
                // Set up observer to wait for table
                const observer = new MutationObserver((mutations) => {
                    table = document.querySelector(CONFIG.SELECTORS.TABLE);
                    if (table) {
                        console.log('DSP Tool: Table found, setting up table observer');
                        observer.disconnect();
                        this.observeTable(table);
                    }
                });
                
                observer.observe(document.body, {
                    childList: true,
                    subtree: true
                });
                
                // Stop looking after 30 seconds
                setTimeout(() => {
                    observer.disconnect();
                    console.log('DSP Tool: Stopped waiting for table after 30 seconds');
                }, 30000);
            } else {
                this.observeTable(table);
            }
        } catch (error) {
            console.error('DSP Tool: Error setting up table observer:', error);
        }
    }

    observeTable(table) {
        try {
            console.log('DSP Tool: Setting up mutation observer on table');
            
            const observer = new MutationObserver((mutations) => {
                if (this.shouldUpdateHighlights(mutations)) {
                    // Debounce the highlighting to avoid excessive calls
                    clearTimeout(this.highlightTimeout);
                    this.highlightTimeout = setTimeout(async () => {
                        console.log('DSP Tool: Table changed, updating highlights');
                        
                        try {
                            // Get enabled service types and highlight all of them
                            const { serviceTypes = { cycle1: true, samedayB: false, samedayC: false } } = 
                                await browser.storage.local.get('serviceTypes');
                            
                            Object.entries(serviceTypes).forEach(([serviceType, enabled]) => {
                                if (enabled) {
                                    this.highlighter.highlightMismatches(serviceType);
                                }
                            });
                        } catch (error) {
                            console.error('DSP Tool: Error updating highlights:', error);
                            // Fallback to cycle1
                            this.highlighter.highlightMismatches('cycle1');
                        }
                    }, 1000);
                }
            });

            observer.observe(table, {
                childList: true,
                subtree: true,
                characterData: true,
                attributes: true,
                attributeFilter: ['data-bind', 'class']
            });
            
            console.log('DSP Tool: Table observer set up successfully');
        } catch (error) {
            console.error('DSP Tool: Error setting up table mutation observer:', error);
        }
    }

    shouldUpdateHighlights(mutations) {
        return mutations.some(mutation => {
            // Check for content changes that might affect data
            return mutation.type === 'childList' || 
                   mutation.type === 'characterData' ||
                   (mutation.type === 'attributes' && 
                    ['data-bind', 'class'].includes(mutation.attributeName));
        });
    }
}

// Initialize the application
console.log('DSP Management Tool: Enhanced content script loaded');
const app = new DSPManagementTool();

// Wait a bit for the page to start loading, then initialize
setTimeout(() => {
    app.initialize();
}, 1000);

// Listen for messages from the background script
browser.runtime.onMessage.addListener(async (request, sender) => {
    console.log('DSP Tool: Content script received message:', request);
    
    if (request.action === "checkMismatches") {
        try {
            console.log('DSP Tool: Starting mismatch check...');
            
            // Get service type from request, default to cycle1
            const serviceType = request.serviceType || 'cycle1';
            console.log(`DSP Tool: Checking mismatches for service type: ${serviceType}`);
            
            // Give the page a moment to fully load
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            const mismatches = await app.dspParser.getFilteredMismatchedData(serviceType);
            console.log(`DSP Tool: Returning mismatches for ${serviceType}:`, mismatches);
            
            return Promise.resolve({ mismatches, serviceType });
        } catch (error) {
            console.error('DSP Tool: Error checking mismatches:', error);
            return Promise.resolve({ mismatches: [], error: error.message, serviceType: request.serviceType });
        }
    }
    
    return Promise.resolve({ success: true });
});