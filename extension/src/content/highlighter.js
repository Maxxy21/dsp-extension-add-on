/**
 * Mismatch Highlighter - Highlights DSP roster mismatches in the UI
 */

import { SELECTORS } from '../shared/constants.js';
import { DOMError } from '../shared/errors.js';

export class MismatchHighlighter {
    constructor(config = {}) {
        this.config = {
            highlightColor: '#ffebee',
            highlightBorderColor: '#f44336',
            highlightTextColor: '#d32f2f',
            animationDuration: '0.3s',
            ...config,
        };

        this.highlightedElements = new Set();
        this.highlightedRows = new Map(); // Map row to highlight info
        this.styleElement = null;

        this.createStyles();
    }

    /**
     * Create CSS styles for highlighting
     */
    createStyles() {
        if (document.getElementById('dsp-highlighter-styles')) {
            return; // Styles already exist
        }

        this.styleElement = document.createElement('style');
        this.styleElement.id = 'dsp-highlighter-styles';
        this.styleElement.textContent = `
            .dsp-mismatch-highlight {
                background-color: ${this.config.highlightColor} !important;
                border: 2px solid ${this.config.highlightBorderColor} !important;
                border-radius: 4px !important;
                transition: all ${this.config.animationDuration} ease-in-out !important;
                position: relative !important;
            }

            .dsp-mismatch-highlight::before {
                content: '';
                position: absolute;
                top: -2px;
                left: -2px;
                right: -2px;
                bottom: -2px;
                background: linear-gradient(45deg, ${this.config.highlightBorderColor}, transparent);
                border-radius: 6px;
                z-index: -1;
                animation: dsp-pulse 2s infinite;
            }

            .dsp-mismatch-cell {
                background-color: ${this.config.highlightColor} !important;
                color: ${this.config.highlightTextColor} !important;
                font-weight: bold !important;
                padding: 2px 4px !important;
                border-radius: 3px !important;
            }

            .dsp-mismatch-badge {
                display: inline-block;
                background-color: ${this.config.highlightBorderColor};
                color: white;
                font-size: 0.8em;
                font-weight: bold;
                padding: 2px 6px;
                border-radius: 10px;
                margin-left: 8px;
                animation: dsp-bounce 1s ease-in-out;
            }

            .dsp-positive-mismatch {
                background-color: #e8f5e8 !important;
                border-color: #4caf50 !important;
            }

            .dsp-negative-mismatch {
                background-color: #ffebee !important;
                border-color: #f44336 !important;
            }

            @keyframes dsp-pulse {
                0%, 100% { opacity: 0.7; }
                50% { opacity: 0.3; }
            }

            @keyframes dsp-bounce {
                0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
                40% { transform: translateY(-3px); }
                60% { transform: translateY(-1px); }
            }

            .dsp-highlight-summary {
                position: fixed;
                top: 20px;
                right: 20px;
                background: white;
                border: 2px solid ${this.config.highlightBorderColor};
                border-radius: 8px;
                padding: 12px 16px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                z-index: 10000;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
                font-size: 14px;
                max-width: 300px;
            }

            .dsp-highlight-summary h3 {
                margin: 0 0 8px 0;
                color: ${this.config.highlightBorderColor};
                font-size: 16px;
            }

            .dsp-highlight-summary .close-btn {
                position: absolute;
                top: 8px;
                right: 12px;
                background: none;
                border: none;
                font-size: 18px;
                cursor: pointer;
                color: #999;
            }

            .dsp-highlight-summary .close-btn:hover {
                color: ${this.config.highlightBorderColor};
            }
        `;

        document.head.appendChild(this.styleElement);
    }

    /**
     * Highlight all mismatches on the current page
     * @param {Map} dspData - Map of service type to DSP data
     * @returns {object} Highlighting results
     */
    highlightAllMismatches(dspData) {
        try {
            console.log('🎨 Starting mismatch highlighting...');

            this.clearAllHighlights();

            const results = {
                totalHighlighted: 0,
                mismatches: [],
                serviceTypeCounts: {},
            };

            for (const [serviceType, dspMap] of dspData) {
                const serviceResults = this.highlightServiceTypeMismatches(serviceType, dspMap);

                results.totalHighlighted += serviceResults.highlighted;
                results.mismatches.push(...serviceResults.mismatches);
                results.serviceTypeCounts[serviceType] = serviceResults.highlighted;
            }

            this.showHighlightSummary(results);

            console.log(
                `✅ Highlighted ${results.totalHighlighted} mismatches across ${
                    Object.keys(results.serviceTypeCounts).length
                } service types`
            );

            return results;
        } catch (error) {
            console.error('Highlighting failed:', error);
            throw new DOMError('Failed to highlight mismatches', {
                originalError: error.message,
            });
        }
    }

    /**
     * Highlight mismatches for a specific service type
     * @param {string} serviceType - Service type to highlight
     * @param {Map} dspMap - Map of DSP name to data
     * @returns {object} Highlighting results for service type
     */
    highlightServiceTypeMismatches(serviceType, dspMap) {
        const results = {
            highlighted: 0,
            mismatches: [],
        };

        for (const [dspName, data] of dspMap) {
            if (data.hasMismatch && data.rowElement) {
                try {
                    this.highlightRow(data.rowElement, data, serviceType);
                    results.highlighted++;
                    results.mismatches.push({
                        dspName,
                        serviceType,
                        mismatch: data.mismatch,
                        confirmed: data.confirmed,
                        rostered: data.rostered,
                    });
                } catch (error) {
                    console.warn(`Failed to highlight row for ${dspName}:`, error);
                }
            }
        }

        return results;
    }

    /**
     * Highlight a specific row
     * @param {Element} row - Row element to highlight
     * @param {object} data - DSP data
     * @param {string} serviceType - Service type
     */
    highlightRow(row, data, serviceType) {
        if (!row || this.highlightedRows.has(row)) {
            return; // Already highlighted or invalid row
        }

        // Add main highlight class
        const isPositiveMismatch = data.mismatch > 0;
        const highlightClass = isPositiveMismatch
            ? 'dsp-positive-mismatch'
            : 'dsp-negative-mismatch';

        row.classList.add('dsp-mismatch-highlight', highlightClass);

        // Highlight specific cells
        this.highlightMismatchCells(row, data);

        // Add mismatch badge
        this.addMismatchBadge(row, data);

        // Store highlight information
        this.highlightedRows.set(row, {
            data,
            serviceType,
            timestamp: Date.now(),
        });

        this.highlightedElements.add(row);

        console.log(`🎨 Highlighted ${data.name}: ${data.mismatch > 0 ? '+' : ''}${data.mismatch}`);
    }

    /**
     * Highlight specific cells within a row
     * @param {Element} row - Row element
     * @param {object} data - DSP data
     */
    highlightMismatchCells(row, _data) {
        const confirmedCell = row.querySelector(SELECTORS.CONFIRMED_CELL);
        const rosteredCell = row.querySelector(SELECTORS.ROSTERED_CELL);

        if (confirmedCell) {
            confirmedCell.classList.add('dsp-mismatch-cell');
            this.highlightedElements.add(confirmedCell);
        }

        if (rosteredCell) {
            rosteredCell.classList.add('dsp-mismatch-cell');
            this.highlightedElements.add(rosteredCell);
        }
    }

    /**
     * Add a mismatch badge to the row
     * @param {Element} row - Row element
     * @param {object} data - DSP data
     */
    addMismatchBadge(row, data) {
        const providerCell = row.querySelector(SELECTORS.PROVIDER_NAME);
        if (!providerCell) {
            return;
        }

        // Check if badge already exists
        if (providerCell.querySelector('.dsp-mismatch-badge')) {
            return;
        }

        const badge = document.createElement('span');
        badge.className = 'dsp-mismatch-badge';
        badge.textContent = `${data.mismatch > 0 ? '+' : ''}${data.mismatch}`;
        badge.title = `Mismatch: ${data.confirmed} confirmed vs ${data.rostered} rostered`;

        providerCell.appendChild(badge);
        this.highlightedElements.add(badge);
    }

    /**
     * Show a summary of highlighting results
     * @param {object} results - Highlighting results
     */
    showHighlightSummary(results) {
        // Remove existing summary
        const existingSummary = document.getElementById('dsp-highlight-summary');
        if (existingSummary) {
            existingSummary.remove();
        }

        if (results.totalHighlighted === 0) {
            return; // No mismatches to show
        }

        const summary = document.createElement('div');
        summary.id = 'dsp-highlight-summary';
        summary.className = 'dsp-highlight-summary';

        const closeBtn = document.createElement('button');
        closeBtn.className = 'close-btn';
        closeBtn.textContent = '×';
        closeBtn.onclick = () => summary.remove();

        const title = document.createElement('h3');
        title.textContent = `${results.totalHighlighted} Mismatches Found`;

        const content = document.createElement('div');

        // Service type breakdown
        const breakdown = document.createElement('div');
        breakdown.style.marginBottom = '8px';
        const strong = document.createElement('strong');
        strong.textContent = 'By Service Type:';
        breakdown.appendChild(strong);
        breakdown.appendChild(document.createElement('br'));

        Object.entries(results.serviceTypeCounts)
            .filter(([, count]) => count > 0)
            .forEach(([serviceType, count]) => {
                const line = document.createElement('div');
                line.textContent = `• ${serviceType}: ${count}`;
                breakdown.appendChild(line);
            });

        const tip = document.createElement('div');
        tip.style.fontSize = '12px';
        tip.style.color = '#666';
        tip.textContent = 'Click rows for details. Auto-hide in 10s.';

        content.appendChild(breakdown);
        content.appendChild(tip);

        summary.appendChild(closeBtn);
        summary.appendChild(title);
        summary.appendChild(content);

        document.body.appendChild(summary);

        // Auto-hide after 10 seconds
        setTimeout(() => {
            if (summary.parentNode) {
                summary.remove();
            }
        }, 10000);

        this.highlightedElements.add(summary);
    }

    /**
     * Clear all highlights
     */
    clearAllHighlights() {
        console.log('🧹 Clearing all mismatch highlights...');

        // Remove classes and elements
        for (const element of this.highlightedElements) {
            if (element && element.parentNode) {
                if (element.classList) {
                    element.classList.remove(
                        'dsp-mismatch-highlight',
                        'dsp-mismatch-cell',
                        'dsp-positive-mismatch',
                        'dsp-negative-mismatch'
                    );
                }

                // Remove badges
                if (element.classList && element.classList.contains('dsp-mismatch-badge')) {
                    element.remove();
                }

                // Remove summary
                if (element.id === 'dsp-highlight-summary') {
                    element.remove();
                }
            }
        }

        // Clear tracking
        this.highlightedElements.clear();
        this.highlightedRows.clear();

        console.log('✅ All highlights cleared');
    }

    /**
     * Highlight a specific DSP across all service types
     * @param {string} dspName - DSP name to highlight
     * @param {Map} allData - All DSP data
     * @returns {number} Number of rows highlighted
     */
    highlightSpecificDSP(dspName, allData) {
        let highlighted = 0;

        for (const [serviceType, dspMap] of allData) {
            if (dspMap.has(dspName)) {
                const data = dspMap.get(dspName);
                if (data.rowElement) {
                    this.highlightRow(data.rowElement, data, serviceType);
                    highlighted++;
                }
            }
        }

        console.log(`🎯 Highlighted ${highlighted} instances of DSP: ${dspName}`);
        return highlighted;
    }

    /**
     * Toggle highlighting for a specific service type
     * @param {string} serviceType - Service type to toggle
     * @param {Map} dspMap - DSP data for the service type
     * @returns {boolean} Whether highlighting is now active
     */
    toggleServiceTypeHighlighting(serviceType, dspMap) {
        // Check if any rows from this service type are highlighted
        const serviceRows = Array.from(this.highlightedRows.entries()).filter(
            ([, info]) => info.serviceType === serviceType
        );

        if (serviceRows.length > 0) {
            // Remove highlights for this service type
            for (const [row] of serviceRows) {
                this.removeRowHighlight(row);
            }
            return false;
        } else {
            // Add highlights for this service type
            this.highlightServiceTypeMismatches(serviceType, dspMap);
            return true;
        }
    }

    /**
     * Remove highlight from a specific row
     * @param {Element} row - Row to unhighlight
     */
    removeRowHighlight(row) {
        if (!this.highlightedRows.has(row)) {
            return;
        }

        row.classList.remove(
            'dsp-mismatch-highlight',
            'dsp-positive-mismatch',
            'dsp-negative-mismatch'
        );

        // Remove cell highlights
        const cells = row.querySelectorAll('.dsp-mismatch-cell');
        cells.forEach(cell => {
            cell.classList.remove('dsp-mismatch-cell');
            this.highlightedElements.delete(cell);
        });

        // Remove badges
        const badges = row.querySelectorAll('.dsp-mismatch-badge');
        badges.forEach(badge => {
            badge.remove();
            this.highlightedElements.delete(badge);
        });

        this.highlightedRows.delete(row);
        this.highlightedElements.delete(row);
    }

    /**
     * Get highlighting statistics
     * @returns {object} Statistics about current highlights
     */
    getStatistics() {
        const stats = {
            totalHighlighted: this.highlightedRows.size,
            byServiceType: {},
            oldestHighlight: null,
            newestHighlight: null,
        };

        let oldestTime = Infinity;
        let newestTime = 0;

        for (const [, info] of this.highlightedRows) {
            const { serviceType, timestamp } = info;

            if (!stats.byServiceType[serviceType]) {
                stats.byServiceType[serviceType] = 0;
            }
            stats.byServiceType[serviceType]++;

            if (timestamp < oldestTime) {
                oldestTime = timestamp;
                stats.oldestHighlight = new Date(timestamp);
            }

            if (timestamp > newestTime) {
                newestTime = timestamp;
                stats.newestHighlight = new Date(timestamp);
            }
        }

        return stats;
    }

    /**
     * Cleanup method to remove styles when highlighter is destroyed
     */
    cleanup() {
        this.clearAllHighlights();

        if (this.styleElement && this.styleElement.parentNode) {
            this.styleElement.remove();
        }

        console.log('🧹 MismatchHighlighter cleanup complete');
    }
}
