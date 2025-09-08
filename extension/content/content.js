// content/content.js - Enhanced with multi-service type support and DSP summary export for Route Planning

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
    },
    SUMMARY: {
        INCLUDED_SERVICE_TYPES: ['Standard Parcel', 'Standard Parcel Medium Van'],
        PAID_TIME_MINUTES: 525
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
        this._isRoutePlanning = /\.route\.planning\.last-mile\.a2z\.com/.test(location.hostname);
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
        
        // On Scheduling page, enable mismatch highlighting + inference
        if (!this._isRoutePlanning) {
            this.dspParser.serviceInferrer.initialize();
            await this.dspParser.serviceInferrer.updateStorageWithDetected();
            this.setupHighlighting();
            this.setupTableObserver();
        }
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
    
    // Export DSP summaries from Route Planning page (Standard Parcel only)
    if (request.action === 'getDSPSummary') {
        try {
            const dspList = Array.isArray(request.dsps) ? request.dsps : [];
            const { settings = {} } = await browser.storage.local.get('settings');
            const paidTime = Number.isFinite(request.overridePaidTime)
                ? request.overridePaidTime
                : (Number.isFinite(settings.paidTimeMinutes) ? settings.paidTimeMinutes : CONFIG.SUMMARY.PAID_TIME_MINUTES);
            const { items, text } = extractAndFormatDSPSummariesFromRoutePlanning(dspList, paidTime);
            return Promise.resolve({ success: true, text, items, paidTime });
        } catch (error) {
            console.error('DSP Tool: Error generating DSP summary:', error);
            return Promise.resolve({ success: false, error: error.message });
        }
    }

    // Extract Ongoing Risks from Mercury dashboard (c3.amazon.com)
    if (request.action === 'getOngoingRisks') {
        try {
            if (!/c3\.amazon\.com/.test(location.hostname)) {
                throw new Error('Not on Mercury dashboard');
            }
            const rows = extractOngoingRisksFromPage();
            return Promise.resolve({ success: true, rows, url: location.href });
        } catch (error) {
            console.error('Risk extraction failed:', error);
            return Promise.resolve({ success: false, error: error.message, rows: [] });
        }
    }

    // Extract Backbrief failed shipments from Mercury dashboard
    if (request.action === 'getBackbriefFailedShipments') {
        try {
            if (!/c3\.amazon\.com/.test(location.hostname)) {
                throw new Error('Not on Mercury dashboard');
            }
            const { includeReasons = [], mapUnableToAccess = true } = request;
            const rows = extractBackbriefFromPage(includeReasons, mapUnableToAccess);
            return Promise.resolve({ success: true, rows, url: location.href });
        } catch (error) {
            console.error('Backbrief extraction failed:', error);
            return Promise.resolve({ success: false, error: error.message, rows: [] });
        }
    }

    // Try to capture Backbrief CSV download link and return CSV text in-memory
    if (request.action === 'getBackbriefCsv') {
        try {
            if (!/c3\.amazon\.com/.test(location.hostname)) {
                throw new Error('Not on Mercury dashboard');
            }
            const csv = await tryCaptureBackbriefCsv();
            if (!csv) throw new Error('CSV link not found');
            return Promise.resolve({ success: true, csv });
        } catch (error) {
            console.warn('Backbrief CSV capture failed:', error);
            return Promise.resolve({ success: false, error: error.message });
        }
    }

    // Extract Manifest mapping (Tracking ID -> { address, timeWindow }) from Route Planning
    if (request.action === 'getManifestTrackingMap') {
        try {
            if (!/\.route\.planning\.last-mile\.a2z\.com/.test(location.hostname)) {
                throw new Error('Not on Route Planning page');
            }
            const map = extractManifestTrackingMapFromPage();
            return Promise.resolve({ success: true, map, url: location.href });
        } catch (error) {
            console.error('Manifest extraction failed:', error);
            return Promise.resolve({ success: false, error: error.message, map: {} });
        }
    }

    // Extract mapping from Route Sheets page as fallback (Tracking ID -> { address?, timeWindow })
    if (request.action === 'getSheetsTrackingMap') {
        try {
            if (!/\.dispatch\.planning\.last-mile\.a2z\.com/.test(location.hostname)) {
                throw new Error('Not on Route Sheets page');
            }
            const map = extractSheetsTrackingMapFromPage();
            return Promise.resolve({ success: true, map, url: location.href });
        } catch (error) {
            console.error('Sheets extraction failed:', error);
            return Promise.resolve({ success: false, error: error.message, map: {} });
        }
    }

    // Infer Paid Time from Route Constraints page (In Shift Length (mins))
    if (request.action === 'getPaidTimeFromConstraints') {
        try {
            if (!/\.dispatch\.planning\.last-mile\.a2z\.com/.test(location.hostname)) {
                throw new Error('Not on Route Constraints page');
            }
            const minutes = extractPaidTimeFromConstraints();
            if (Number.isFinite(minutes) && minutes > 0) {
                return Promise.resolve({ success: true, minutes });
            }
            return Promise.resolve({ success: false, error: 'Could not infer a consistent value' });
        } catch (error) {
            console.error('Paid time inference failed:', error);
            return Promise.resolve({ success: false, error: error.message });
        }
    }

    return Promise.resolve({ success: true });
});

// -------------------------------
// Route Planning Summary Export
// -------------------------------

function extractAndFormatDSPSummariesFromRoutePlanning(targetDSPs = [], paidTimeMinutes = CONFIG.SUMMARY.PAID_TIME_MINUTES) {
    // Guard: only proceed on Route Planning pages
    const isRoutePlanning = /\.route\.planning\.last-mile\.a2z\.com/.test(location.hostname);
    if (!isRoutePlanning) {
        throw new Error('Not on Route Planning page');
    }

    // Find the main data table(s). Route Planning uses generic <table> markup.
    const tables = Array.from(document.querySelectorAll('table'));
    if (!tables || tables.length === 0) {
        throw new Error('No tables found on page');
    }

    // Aggregate rows across all tables; use structure seen in raw.html
    const rows = [];
    tables.forEach(tbl => {
        const bodyRows = tbl.querySelectorAll('tbody > tr');
        bodyRows.forEach(tr => rows.push(tr));
    });

    // Parse rows -> records
    const records = [];
    for (const tr of rows) {
        const tds = tr.querySelectorAll('td');
        if (tds.length < 8) continue;

        const serviceType = (tds[0]?.innerText || '').trim();
        const dsp = (tds[1]?.innerText || '').trim();
        const shiftTime = Utils.parseInteger((tds[2]?.innerText || '').trim());
        const spr = Utils.parseInteger((tds[7]?.innerText || '').trim());

        // Filter: service type must be one of the included; skip empty DSPs
        if (!CONFIG.SUMMARY.INCLUDED_SERVICE_TYPES.includes(serviceType)) continue;
        if (!dsp) continue;
        if (!Number.isFinite(shiftTime) || !Number.isFinite(spr)) continue;

        records.push({ serviceType, dsp, shiftTime, spr });
    }

    // Group by DSP and compute averages
    const agg = new Map(); // dsp -> { totalShift, totalSpr, count }
    for (const r of records) {
        if (!agg.has(r.dsp)) agg.set(r.dsp, { totalShift: 0, totalSpr: 0, count: 0 });
        const a = agg.get(r.dsp);
        a.totalShift += r.shiftTime;
        a.totalSpr += r.spr;
        a.count += 1;
    }

    // If targetDSPs provided, restrict output
    const dspKeys = targetDSPs.length > 0
        ? targetDSPs.filter(d => agg.has(d))
        : Array.from(agg.keys());

    // Format summaries
    const items = {};
    const parts = [];
    // Compute today's date (DD.MM.YYYY) for header context
    const _now = new Date();
    const todayStr = `${String(_now.getDate()).padStart(2, '0')}.${String(_now.getMonth() + 1).padStart(2, '0')}.${_now.getFullYear()}`;
    for (const dsp of dspKeys.sort()) {
        const a = agg.get(dsp);
        if (!a || a.count === 0) continue;
        const avgShift = Math.round(a.totalShift / a.count);
        const avgSpr = Math.round(a.totalSpr / a.count);

        items[dsp] = { avgShift, avgSpr, paid: paidTimeMinutes };

        // Use concise emoji-based format, mirroring popup summary template
        const block = [
            '📋 Daily Route Planning Summary',
            '',
            `🚚 ${dsp} | ${todayStr}`,
            '',
            `📦 SPR: ${avgSpr}`,
            `⏱️ Shift Time: ${avgShift} min`,
            `💰 Paid Time: ${paidTimeMinutes} min`,
        ].join('\n');

        parts.push(block);
    }

    return { items, text: parts.join('\n\n') };
}

// -------------------------------
// Mercury Risks Extraction (generic table parser)
// -------------------------------

function headerMatches(cellText, patterns) {
    const t = (cellText || '').trim().toLowerCase();
    return patterns.some(p => t.includes(p));
}

function extractOngoingRisksFromPage() {
    const tables = Array.from(document.querySelectorAll('table'));
    const expectedHeaders = {
        date: ['date'],
        cw: ['cw', 'calendar week'],
        dsp: ['dsp'],
        transporterId: ['transporter id', 'transporter'],
        routeId: ['route id', 'route'],
        bc: ['bc', 'business closed'],
        cna: ['cna', 'customer not available'],
        utl: ['utl', 'unable to locate'],
        uta: ['uta', 'unable to access'],
        missing: ['missing'],
        // Some dashboards split rejected and delayed columns; match both
        rejectedDelayed: ['rejected/delayed', 'rejected & delayed', 'rejected and delayed'],
        rejected: ['rejected'],
        delayedByDa: ['delayed by da', 'delayed'],
        unknownStop: ['unknown stop', 'unknown'],
        reason: ['reason'],
        dspAction: ['dsp action'],
        comment: ['comment'],
        addressType: ['address type']
    };

    const results = [];

    for (const table of tables) {
        const rows = Array.from(table.querySelectorAll('tr'));
        if (rows.length < 2) continue;
        // Find a header-like row
        let headerRow = null;
        for (const tr of rows.slice(0, 5)) {
            const cells = Array.from(tr.querySelectorAll('th,td')).map(c => (c.innerText || '').trim());
            if (cells.length < 5) continue;
            const hasDSP = cells.some(c => headerMatches(c, expectedHeaders.dsp));
            const hasRoute = cells.some(c => headerMatches(c, expectedHeaders.routeId));
            if (hasDSP && hasRoute) { headerRow = tr; break; }
        }
        if (!headerRow) continue;

        const headers = Array.from(headerRow.querySelectorAll('th,td')).map(c => (c.innerText || '').trim());
        const idx = {};
        headers.forEach((h, i) => {
            Object.entries(expectedHeaders).forEach(([key, pats]) => {
                if (idx[key] == null && headerMatches(h, pats)) idx[key] = i;
            });
        });

        // Parse data rows
        for (const tr of rows.slice(rows.indexOf(headerRow) + 1)) {
            const tds = Array.from(tr.querySelectorAll('td'));
            if (tds.length < 5) continue;
            const val = (k) => {
                const i = idx[k];
                return i != null && tds[i] ? (tds[i].innerText || '').trim() : '';
            };
            const record = {
                date: val('date'),
                cw: val('cw'),
                dsp: val('dsp'),
                transporterId: val('transporterId'),
                routeId: val('routeId'),
                bc: val('bc'),
                cna: val('cna'),
                utl: val('utl'),
                uta: val('uta'),
                missing: val('missing'),
                // Prefer combined column, else pass individual fields for background to sum
                rejectedDelayed: val('rejectedDelayed'),
                rejected: val('rejected'),
                delayedByDa: val('delayedByDa'),
                unknownStop: val('unknownStop'),
                reason: val('reason'),
                dspAction: val('dspAction'),
                comment: val('comment'),
                addressType: val('addressType'),
                pageUrl: location.href
            };

            // Skip empty rows
            if (!record.dsp && !record.routeId) continue;
            results.push(record);
        }
    }

    return results;
}

// -------------------------------
// Backbrief Extraction (Mercury)
// -------------------------------

function extractBackbriefFromPage(includeReasons = [], mapUnableToAccess = true) {
    const tables = Array.from(document.querySelectorAll('table'));
    const expectedHeaders = {
        trackingId: ['tracking id', 'tid', 'id'],
        deliveryStation: ['delivery station', 'ds'],
        route: ['route'],
        dspName: ['dsp name', 'dsp'],
        reason: ['reason'],
        attemptReason: ['attempt reason'],
        latestAttempt: ['latest attempt', 'attempt time', 'time'],
        addressType: ['address type']
    };

    const results = [];

    for (const table of tables) {
        const rows = Array.from(table.querySelectorAll('tr'));
        if (rows.length < 2) continue;
        // Find a header-like row containing Tracking ID and DSP columns
        let headerRow = null;
        for (const tr of rows.slice(0, 5)) {
            const cells = Array.from(tr.querySelectorAll('th,td')).map(c => (c.innerText || '').trim());
            if (cells.length < 5) continue;
            const hasTid = cells.some(c => headerMatches(c, expectedHeaders.trackingId));
            const hasDsp = cells.some(c => headerMatches(c, expectedHeaders.dspName));
            if (hasTid && hasDsp) { headerRow = tr; break; }
        }
        if (!headerRow) continue;

        const headers = Array.from(headerRow.querySelectorAll('th,td')).map(c => (c.innerText || '').trim());
        const idx = {};
        headers.forEach((h, i) => {
            Object.entries(expectedHeaders).forEach(([key, pats]) => {
                if (idx[key] == null && headerMatches(h, pats)) idx[key] = i;
            });
        });

        // Parse data rows
        for (const tr of rows.slice(rows.indexOf(headerRow) + 1)) {
            const tds = Array.from(tr.querySelectorAll('td'));
            if (tds.length < 5) continue;
            const val = (k) => {
                const i = idx[k];
                return i != null && tds[i] ? (tds[i].innerText || '').trim() : '';
            };

            let reason = val('reason');
            const attemptReason = val('attemptReason');
            if (mapUnableToAccess && attemptReason === 'UNABLE_TO_ACCESS') {
                reason = 'UNABLE_TO_ACCESS';
            }

            if (Array.isArray(includeReasons) && includeReasons.length > 0) {
                if (!includeReasons.includes(reason)) continue;
            }

            const record = {
                trackingId: val('trackingId').toUpperCase(),
                deliveryStation: val('deliveryStation'),
                route: val('route'),
                dspName: val('dspName').toUpperCase(),
                reason,
                attemptReason,
                latestAttempt: val('latestAttempt'),
                addressType: val('addressType')
            };

            // Skip if no tracking id
            if (!record.trackingId) continue;
            results.push(record);
        }
    }

    return results;
}

function extractPaidTimeFromConstraints() {
    const tables = Array.from(document.querySelectorAll('table'));
    const headerMatch = (t) => /shift\s*length/i.test(t) || /in\s*shift/i.test(t);
    for (const table of tables) {
        const rows = Array.from(table.querySelectorAll('tr'));
        if (rows.length < 2) continue;
        // find header row
        let headerRow = null;
        for (const tr of rows.slice(0, 5)) {
            const cells = Array.from(tr.querySelectorAll('th,td')).map(c => (c.innerText || '').trim());
            if (cells.length < 3) continue;
            if (cells.some(headerMatch)) { headerRow = tr; break; }
        }
        if (!headerRow) continue;
        const headers = Array.from(headerRow.querySelectorAll('th,td')).map(c => (c.innerText || '').trim().toLowerCase());
        const colIndex = headers.findIndex(h => /shift\s*length/.test(h));
        const minutes = [];
        for (const tr of rows.slice(rows.indexOf(headerRow) + 1)) {
            const tds = Array.from(tr.querySelectorAll('td'));
            if (tds.length === 0) continue;
            let val = '';
            if (colIndex >= 0 && tds[colIndex]) val = (tds[colIndex].innerText || '').trim();
            else {
                // Try to guess column by finding a pure integer cell commonly used
                const candidate = Array.from(tds).map(td => (td.innerText || '').trim()).find(x => /^\d{2,4}$/.test(x));
                val = candidate || '';
            }
            const n = parseInt((val || '').replace(/[^\d-]/g, ''), 10);
            if (Number.isFinite(n)) minutes.push(n);
        }
        if (minutes.length > 0 && minutes.every(m => m === minutes[0])) {
            return minutes[0];
        }
    }
    return 0;
}

async function tryCaptureBackbriefCsv() {
    // Heuristic: look for anchors likely pointing to CSV (blob: or data:) anywhere in the document
    const anchors = Array.from(document.querySelectorAll('a'));
    let csvLink = anchors.find(a => {
        const href = a.getAttribute('href') || '';
        const dl = a.getAttribute('download') || '';
        const txt = (a.textContent || '').trim();
        const looksCsv = /csv/i.test(dl) || /download\.csv/i.test(txt) || /csv/i.test(txt);
        const looksHref = /^blob:/.test(href) || /^data:text\/csv/i.test(href);
        return looksCsv && looksHref;
    });
    if (!csvLink) return '';
    try {
        const href = csvLink.getAttribute('href');
        const resp = await fetch(href);
        const blob = await resp.blob();
        const text = await blob.text();
        return text;
    } catch (e) {
        console.warn('Failed to fetch CSV link:', e);
        return '';
    }
}

// -------------------------------
// Route Planning Manifest Extraction
// -------------------------------

function extractManifestTrackingMapFromPage() {
    const tables = Array.from(document.querySelectorAll('table'));
    const expectedHeaders = {
        trackingId: ['tracking id', 'tid', 'id'],
        address: ['actual customer address', 'address'],
        timeWindow: ['time window', 'tw'],
        startTime: ['start time', 'start'],
        endTime: ['end time', 'end']
    };

    const out = {};
    for (const table of tables) {
        const rows = Array.from(table.querySelectorAll('tr'));
        if (rows.length < 2) continue;
        let headerRow = null;
        for (const tr of rows.slice(0, 5)) {
            const cells = Array.from(tr.querySelectorAll('th,td')).map(c => (c.innerText || '').trim());
            if (cells.length < 3) continue;
            const hasTid = cells.some(c => headerMatches(c, expectedHeaders.trackingId));
            const hasAddr = cells.some(c => headerMatches(c, expectedHeaders.address));
            if (hasTid && hasAddr) { headerRow = tr; break; }
        }
        if (!headerRow) continue;

        const headers = Array.from(headerRow.querySelectorAll('th,td')).map(c => (c.innerText || '').trim());
        const idx = {};
        headers.forEach((h, i) => {
            Object.entries(expectedHeaders).forEach(([key, pats]) => {
                if (idx[key] == null && headerMatches(h, pats)) idx[key] = i;
            });
        });
        const hasTimeWindow = idx.timeWindow != null || (idx.startTime != null && idx.endTime != null);

        for (const tr of rows.slice(rows.indexOf(headerRow) + 1)) {
            const tds = Array.from(tr.querySelectorAll('td'));
            if (tds.length < 3) continue;
            const val = (k) => {
                const i = idx[k];
                return i != null && tds[i] ? (tds[i].innerText || '').trim() : '';
            };
            const tid = (val('trackingId') || '').toUpperCase();
            if (!tid) continue;
            const address = val('address');
            let timeWindow = '';
            if (idx.timeWindow != null) {
                timeWindow = val('timeWindow');
            } else if (idx.startTime != null && idx.endTime != null) {
                const st = val('startTime');
                const et = val('endTime');
                if (st || et) timeWindow = `${st || ''} - ${et || ''}`.trim();
            }

            if (address) {
                out[tid] = {
                    address,
                    timeWindow: hasTimeWindow ? (timeWindow || 'No Time Window') : 'No Time Window'
                };
            }
        }
    }
    return out;
}

function extractSheetsTrackingMapFromPage() {
    const tables = Array.from(document.querySelectorAll('table'));
    const expectedHeaders = {
        trackingId: ['tracking id', 'tid', 'id'],
        address: ['address', 'customer address', 'actual customer address'],
        timeWindow: ['time window', 'tw']
    };
    const out = {};
    for (const table of tables) {
        const rows = Array.from(table.querySelectorAll('tr'));
        if (rows.length < 2) continue;
        let headerRow = null;
        for (const tr of rows.slice(0, 5)) {
            const cells = Array.from(tr.querySelectorAll('th,td')).map(c => (c.innerText || '').trim());
            if (cells.length < 3) continue;
            const hasTid = cells.some(c => headerMatches(c, expectedHeaders.trackingId));
            const hasTW = cells.some(c => headerMatches(c, expectedHeaders.timeWindow));
            if (hasTid && hasTW) { headerRow = tr; break; }
        }
        if (!headerRow) continue;

        const headers = Array.from(headerRow.querySelectorAll('th,td')).map(c => (c.innerText || '').trim());
        const idx = {};
        headers.forEach((h, i) => {
            Object.entries(expectedHeaders).forEach(([key, pats]) => {
                if (idx[key] == null && headerMatches(h, pats)) idx[key] = i;
            });
        });

        for (const tr of rows.slice(rows.indexOf(headerRow) + 1)) {
            const tds = Array.from(tr.querySelectorAll('td'));
            if (tds.length < 3) continue;
            const val = (k) => {
                const i = idx[k];
                return i != null && tds[i] ? (tds[i].innerText || '').trim() : '';
            };
            const tid = (val('trackingId') || '').toUpperCase();
            if (!tid) continue;
            const address = val('address');
            const timeWindow = val('timeWindow');
            if (timeWindow) {
                out[tid] = { address, timeWindow };
            }
        }
    }
    return out;
}
