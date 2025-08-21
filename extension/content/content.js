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
        STANDARD_PARCEL_MEDIUM_VAN: 'Standard Parcel Medium Van',
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

// Service Type Inference Module (similar to amzl-scripts wavegroup inference)
class ServiceTypeInferrer {
    constructor() {
        this.availableServiceTypes = new Set();
        this.currentPageServiceTypes = new Set();
        this.urlParams = null;
    }

    initialize() {
        // Extract URL parameters (similar to amzl-scripts approach)
        this.urlParams = new URLSearchParams(window.location.search);
        this.inferServiceTypesFromPage();
    }

    inferServiceTypesFromPage() {
        try {
            console.log('ServiceTypeInferrer: Analyzing page for available service types...');
            
            // Method 1: Check URL parameters for clues
            this.inferFromURLParams();
            
            // Method 2: Scan DOM for service type indicators (similar to amzl-scripts DOM traversal)
            this.inferFromDOM();
            
            // Method 3: Check table structure for service type rows
            this.inferFromTableStructure();
            
            console.log('ServiceTypeInferrer: Detected service types:', Array.from(this.currentPageServiceTypes));
            return Array.from(this.currentPageServiceTypes);
        } catch (error) {
            console.error('ServiceTypeInferrer: Error during inference:', error);
            return ['cycle1']; // Fallback to default
        }
    }

    inferFromURLParams() {
        // Similar to amzl-scripts line 155-157
        const serviceAreaId = this.urlParams.get('serviceAreaId');
        const date = this.urlParams.get('date');
        
        if (serviceAreaId || date) {
            console.log('ServiceTypeInferrer: Found URL parameters, likely a scheduling page');
            // Default assumption - all service types might be available
            this.availableServiceTypes.add('cycle1');
            this.availableServiceTypes.add('samedayB');
            this.availableServiceTypes.add('samedayC');
        }
    }

    inferFromDOM() {
        try {
            // Similar to amzl-scripts DOM traversal approach (lines 232-242)
            const serviceTypeElements = document.querySelectorAll(CONFIG.SELECTORS.SERVICE_TYPE_EXPANDABLE);
            
            serviceTypeElements.forEach(element => {
                const serviceTypeName = element.textContent.trim();
                console.log('ServiceTypeInferrer: Found service type element:', serviceTypeName);
                
                // Map display names to internal types (similar to amzl-scripts waveType mapping)
                if (serviceTypeName.includes('Standard Parcel') || serviceTypeName.includes('Cycle 1')) {
                    this.currentPageServiceTypes.add('cycle1');
                } else if (serviceTypeName.includes('Multi-Use') || serviceTypeName.includes('Sameday B')) {
                    this.currentPageServiceTypes.add('samedayB');
                } else if (serviceTypeName.includes('Sameday Parcel') || serviceTypeName.includes('Sameday C')) {
                    this.currentPageServiceTypes.add('samedayC');
                }
            });
        } catch (error) {
            console.warn('ServiceTypeInferrer: Error scanning DOM for service types:', error);
        }
    }

    inferFromTableStructure() {
        try {
            // Look for service type rows in the table (similar to amzl-scripts table parsing)
            const rows = document.querySelectorAll(CONFIG.SELECTORS.TABLE_ROWS);
            
            rows.forEach(row => {
                // Check if row contains service type information
                const serviceTypeCell = row.querySelector(CONFIG.SELECTORS.SERVICE_TYPE_EXPANDABLE);
                if (serviceTypeCell) {
                    const text = serviceTypeCell.textContent.trim();
                    
                    // Infer service type from text content
                    if (text.match(/(Standard.*Parcel|Cycle.*1)/i)) {
                        this.currentPageServiceTypes.add('cycle1');
                    } else if (text.match(/(Multi.?Use|Sameday.*B)/i)) {
                        this.currentPageServiceTypes.add('samedayB');
                    } else if (text.match(/(Sameday.*Parcel|Sameday.*C)/i)) {
                        this.currentPageServiceTypes.add('samedayC');
                    }
                }
            });
        } catch (error) {
            console.warn('ServiceTypeInferrer: Error analyzing table structure:', error);
        }
    }

    getDetectedServiceTypes() {
        return Array.from(this.currentPageServiceTypes);
    }

    hasServiceType(serviceType) {
        return this.currentPageServiceTypes.has(serviceType);
    }

    // Auto-update service type settings based on page detection
    async updateStorageWithDetected() {
        try {
            const detectedTypes = this.getDetectedServiceTypes();
            
            if (detectedTypes.length === 0) {
                console.log('ServiceTypeInferrer: No service types detected, keeping current settings');
                return;
            }

            // Get current settings
            const { serviceTypes = {} } = await browser.storage.local.get('serviceTypes');
            
            // Create updated settings based on detection
            const updatedServiceTypes = {
                cycle1: detectedTypes.includes('cycle1'),
                samedayB: detectedTypes.includes('samedayB'),
                samedayC: detectedTypes.includes('samedayC')
            };

            // Only update if different from current
            const hasChanges = Object.keys(updatedServiceTypes).some(
                key => updatedServiceTypes[key] !== serviceTypes[key]
            );

            if (hasChanges) {
                console.log('ServiceTypeInferrer: Auto-updating service type settings:', updatedServiceTypes);
                await browser.storage.local.set({ 
                    serviceTypes: updatedServiceTypes,
                    lastInferredTypes: detectedTypes,
                    inferenceTimestamp: Date.now()
                });

                // Notify background script of the change
                try {
                    browser.runtime.sendMessage({
                        action: 'serviceTypesInferred',
                        detectedTypes: detectedTypes,
                        updatedSettings: updatedServiceTypes
                    });
                } catch (e) {
                    console.warn('ServiceTypeInferrer: Could not notify background script:', e);
                }
            }
        } catch (error) {
            console.error('ServiceTypeInferrer: Error updating storage with detected types:', error);
        }
    }
}

// Enhanced DSP Data Parser with multi-service type support
class DSPDataParser {
    constructor() {
        this.dspTotals = {};
        this.currentServiceType = null;
        this.targetServiceType = null;
        this.serviceInferrer = new ServiceTypeInferrer();
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
            [CONFIG.SERVICE_TYPES.STANDARD_PARCEL_MEDIUM_VAN]: 'cycle1',
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

// Simplified Mismatch Highlighter (like Tampermonkey script)
class MismatchHighlighter {
    highlightMismatches() {
        try {
            console.log('Highlighter: Starting to highlight mismatched cells...');
            const rows = document.querySelectorAll('tr');
            let highlightCount = 0;

            rows.forEach(row => {
                // Get the confirmed (accepted) and rostered cells
                const confirmedCell = row.querySelector('td span[data-bind*="text: confirmed"]');
                const rosteredCell = row.querySelector('td[data-bind*="text: totalRostered"]');

                if (confirmedCell && rosteredCell) {
                    const confirmedValue = parseInt(confirmedCell.textContent, 10);
                    const rosteredValue = parseInt(rosteredCell.textContent, 10);

                    if (!isNaN(confirmedValue) && !isNaN(rosteredValue) && confirmedValue !== rosteredValue) {
                        // Highlight both cells
                        confirmedCell.parentElement.style.backgroundColor = CONFIG.STYLES.HIGHLIGHT_COLOR;
                        rosteredCell.style.backgroundColor = CONFIG.STYLES.HIGHLIGHT_COLOR;

                        // Add a tooltip showing the mismatch
                        const tooltip = `Mismatch - Confirmed: ${confirmedValue}, Rostered: ${rosteredValue}`;
                        confirmedCell.parentElement.title = tooltip;
                        rosteredCell.title = tooltip;
                        
                        highlightCount++;
                        console.log(`Highlighter: Highlighted mismatch - Confirmed: ${confirmedValue}, Rostered: ${rosteredValue}`);
                    }
                }
            });
            
            console.log(`Highlighter: Highlighted ${highlightCount} mismatched rows`);
        } catch (error) {
            console.error('Highlighter: Error highlighting mismatches:', error);
        }
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

    async setupTool() {
        console.log('DSP Tool: Setting up tool...');
        
        // Initialize service type inference (similar to amzl-scripts approach)
        this.dspParser.serviceInferrer.initialize();
        
        // Auto-update service types based on page detection
        await this.dspParser.serviceInferrer.updateStorageWithDetected();
        
        this.setupHighlighting();
        this.setupTableObserver();
    }

    async setupHighlighting() {
        try {
            console.log('DSP Tool: Setting up highlighting for all service types');
            
            // Run highlighting with progressive delays to catch dynamic content
            const delays = [2000, 5000, 8000];
            
            delays.forEach(delay => {
                setTimeout(() => {
                    console.log(`DSP Tool: Running highlighting after ${delay}ms for all service types`);
                    this.highlighter.highlightMismatches();
                }, delay);
            });
        } catch (error) {
            console.error('DSP Tool: Error setting up highlighting:', error);
            // Fallback to basic highlighting
            const delays = [2000, 5000, 8000];
            delays.forEach(delay => {
                setTimeout(() => {
                    this.highlighter.highlightMismatches();
                }, delay);
            });
        }
    }

    setupTableObserver() {
        try {
            // Try to find table immediately (like Tampermonkey script)
            let table = document.querySelector('table');
            
            if (!table) {
                console.log('DSP Tool: Table not found immediately, setting up observer to wait for it');
                
                // Set up observer to wait for table
                const observer = new MutationObserver((mutations) => {
                    table = document.querySelector('table');
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
                            console.log('DSP Tool: Updating highlights for all service types');
                            this.highlighter.highlightMismatches();
                        } catch (error) {
                            console.error('DSP Tool: Error updating highlights:', error);
                            this.highlighter.highlightMismatches();
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