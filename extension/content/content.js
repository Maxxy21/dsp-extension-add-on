

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
        STANDARD_PARCEL: 'Standard Parcel'
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

// DSP Data Parser
class DSPDataParser {
    constructor() {
        this.dspTotals = {};
        this.isInStandardParcelSection = false;
    }

    async parseTableData() {
        try {
            this.reset();
            
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
            
            console.log('DSP Parser: Parsed totals:', this.dspTotals);
            return this.dspTotals;
        } catch (error) {
            console.error('DSP Parser: Error parsing table data:', error);
            return {};
        }
    }

    reset() {
        this.dspTotals = {};
        this.isInStandardParcelSection = false;
    }

    processRow(row) {
        if (this.isServiceTypeHeader(row)) {
            this.handleServiceTypeHeader(row);
            return;
        }

        if (!this.isInStandardParcelSection) return;

        if (this.isServiceTypeRow(row)) {
            this.isInStandardParcelSection = false;
            return;
        }

        this.extractDSPData(row);
    }

    isServiceTypeHeader(row) {
        try {
            const serviceTypeCell = row.querySelector(CONFIG.SELECTORS.SERVICE_TYPE_EXPANDABLE);
            if (!serviceTypeCell) return false;
            
            const text = serviceTypeCell.textContent.trim();
            const isHeader = text === CONFIG.SERVICE_TYPES.STANDARD_PARCEL;
            
            if (isHeader) {
                console.log('DSP Parser: Found Standard Parcel section header');
            }
            
            return isHeader;
        } catch (error) {
            console.warn('DSP Parser: Error checking service type header:', error);
            return false;
        }
    }

    handleServiceTypeHeader(row) {
        this.isInStandardParcelSection = true;
        console.log('DSP Parser: Entering Standard Parcel section');
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

            console.log(`DSP Parser: ${dspName} - Confirmed: ${confirmedValue}, Rostered: ${rosteredValue}`);
            this.updateDSPTotals(dspName, confirmedValue, rosteredValue);
        } catch (error) {
            console.warn('DSP Parser: Error extracting DSP data from row:', error);
        }
    }

    updateDSPTotals(dspName, confirmed, rostered) {
        if (!this.dspTotals[dspName]) {
            this.dspTotals[dspName] = {
                confirmed: 0,
                rostered: 0
            };
        }

        this.dspTotals[dspName].confirmed += confirmed;
        this.dspTotals[dspName].rostered += rostered;
    }

    async getFilteredMismatchedData() {
        const allData = await this.parseTableData();
        console.log('DSP Parser: All parsed data:', allData);

        const mismatches = [];

        Object.entries(allData).forEach(([dspName, data]) => {
            if (data.confirmed !== data.rostered) {
                const mismatch = {
                    dspName: dspName,
                    confirmed: data.confirmed,
                    rostered: data.rostered
                };
                mismatches.push(mismatch);
                console.log(`DSP Parser: Mismatch found - ${dspName}: ${data.confirmed} vs ${data.rostered}`);
            }
        });

        console.log(`DSP Parser: Total mismatches found: ${mismatches.length}`);
        return mismatches;
    }
}

// Mismatch Highlighter
class MismatchHighlighter {
    highlightMismatches() {
        try {
            const rows = document.querySelectorAll(CONFIG.SELECTORS.TABLE_ROWS);
            console.log(`Highlighter: Processing ${rows.length} rows for highlighting`);
            
            let highlightCount = 0;
            rows.forEach(row => {
                if (this.processRow(row)) {
                    highlightCount++;
                }
            });
            
            console.log(`Highlighter: Highlighted ${highlightCount} mismatched rows`);
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
            const tooltip = `Mismatch - Confirmed: ${confirmedValue}, Rostered: ${rosteredValue}`;

            // Highlight confirmed cell's parent
            if (confirmedCell.parentElement) {
                confirmedCell.parentElement.style.backgroundColor = CONFIG.STYLES.HIGHLIGHT_COLOR;
                confirmedCell.parentElement.title = tooltip;
            }
            
            // Highlight rostered cell
            rosteredCell.style.backgroundColor = CONFIG.STYLES.HIGHLIGHT_COLOR;
            rosteredCell.title = tooltip;
            
            console.log(`Highlighter: Applied highlighting for mismatch ${confirmedValue} vs ${rosteredValue}`);
        } catch (error) {
            console.warn('Highlighter: Error applying highlight styles:', error);
        }
    }
}

// Main Application Class
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

    setupHighlighting() {
        // Initial highlighting with progressive delays
        const delays = [2000, 5000, 8000];
        
        delays.forEach(delay => {
            setTimeout(() => {
                console.log(`DSP Tool: Running highlighting after ${delay}ms`);
                this.highlighter.highlightMismatches();
            }, delay);
        });
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
                    this.highlightTimeout = setTimeout(() => {
                        console.log('DSP Tool: Table changed, updating highlights');
                        this.highlighter.highlightMismatches();
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
console.log('DSP Management Tool: Content script loaded');
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
            
            // Give the page a moment to fully load
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            const mismatches = await app.dspParser.getFilteredMismatchedData();
            console.log('DSP Tool: Returning mismatches:', mismatches);
            
            return Promise.resolve({ mismatches });
        } catch (error) {
            console.error('DSP Tool: Error checking mismatches:', error);
            return Promise.resolve({ mismatches: [], error: error.message });
        }
    }
    
    return Promise.resolve({ success: true });
});