/**
 * Manifest Extractor - Extracts manifest tracking data from Amazon logistics pages
 */

import { parseIntSafe } from '../../shared/utils/parser-utils.js';
import { ParsingError } from '../../shared/errors.js';

export class ManifestExtractor {
    constructor() {
        this.expectedHeaders = {
            tracking: ['tracking', 'tracking id', 'tracking number', 'package id'],
            dsp: ['dsp', 'dsp code', 'delivery service partner', 'provider'],
            status: ['status', 'delivery status', 'package status'],
            route: ['route', 'route id', 'route number'],
            driver: ['driver', 'driver name', 'driver id'],
            reason: ['reason', 'failure reason', 'delivery reason'],
        };
    }

    /**
     * Extract manifest tracking map from the current page
     * @returns {object} Map of tracking ID to manifest data
     */
    extractManifestTrackingMapFromPage() {
        try {
            console.log('📦 Extracting manifest tracking data...');

            const tables = Array.from(document.querySelectorAll('table'));
            let bestTable = null;
            let bestScore = 0;

            // Find the table that looks most like manifest data
            for (const table of tables) {
                const score = this.scoreTableForManifestData(table);
                if (score > bestScore) {
                    bestScore = score;
                    bestTable = table;
                }
            }

            if (!bestTable || bestScore < 2) {
                console.warn('No suitable manifest table found');
                return {};
            }

            return this.extractDataFromTable(bestTable);
        } catch (error) {
            throw new ParsingError('Failed to extract manifest data', {
                originalError: error.message,
            });
        }
    }

    /**
     * Score a table for how likely it contains manifest data
     * @param {Element} table - Table element to score
     * @returns {number} Score (higher = more likely)
     */
    scoreTableForManifestData(table) {
        const headers = this.getTableHeaders(table);
        let score = 0;

        // Check for expected headers
        for (const [category, variations] of Object.entries(this.expectedHeaders)) {
            for (const header of headers) {
                for (const variation of variations) {
                    if (header.toLowerCase().includes(variation)) {
                        score += category === 'tracking' ? 3 : 1; // Tracking ID is most important
                        break;
                    }
                }
            }
        }

        // Bonus for having many rows (manifest data is usually large)
        const rowCount = table.querySelectorAll('tbody tr').length;
        if (rowCount > 10) {
            score += 1;
        }
        if (rowCount > 50) {
            score += 1;
        }
        if (rowCount > 100) {
            score += 1;
        }

        return score;
    }

    /**
     * Get table headers
     * @param {Element} table - Table element
     * @returns {Array<string>} Array of header texts
     */
    getTableHeaders(table) {
        const headerRow = table.querySelector('thead tr') || table.querySelector('tr');
        if (!headerRow) {
            return [];
        }

        return Array.from(headerRow.querySelectorAll('th, td'))
            .map(cell => cell.textContent?.trim() || '')
            .filter(text => text.length > 0);
    }

    /**
     * Extract data from a table
     * @param {Element} table - Table element
     * @returns {object} Extracted data map
     */
    extractDataFromTable(table) {
        const headers = this.getTableHeaders(table);
        const headerMap = this.createHeaderMap(headers);

        if (!headerMap.tracking) {
            throw new ParsingError('No tracking ID column found in manifest table');
        }

        const data = {};
        const rows = Array.from(
            table.querySelectorAll('tbody tr') || table.querySelectorAll('tr')
        ).slice(1);

        for (const [index, row] of rows.entries()) {
            try {
                const cells = Array.from(row.querySelectorAll('td, th'));
                const record = this.extractRowData(cells, headerMap, index);

                if (record && record.tracking) {
                    data[record.tracking] = record;
                }
            } catch (error) {
                console.warn(`Failed to parse manifest row ${index}:`, error);
            }
        }

        console.log(`📦 Extracted ${Object.keys(data).length} manifest records`);
        return data;
    }

    /**
     * Create a mapping of header categories to column indices
     * @param {Array<string>} headers - Table headers
     * @returns {object} Header mapping
     */
    createHeaderMap(headers) {
        const headerMap = {};

        for (const [category, variations] of Object.entries(this.expectedHeaders)) {
            for (const [index, header] of headers.entries()) {
                const headerLower = header.toLowerCase();

                for (const variation of variations) {
                    if (headerLower.includes(variation)) {
                        headerMap[category] = index;
                        break;
                    }
                }

                if (headerMap[category] !== undefined) {
                    break;
                }
            }
        }

        return headerMap;
    }

    /**
     * Extract data from a single row
     * @param {Array} cells - Table cells
     * @param {object} headerMap - Header mapping
     * @param {number} rowIndex - Row index for error reporting
     * @returns {object|null} Extracted record
     */
    extractRowData(cells, headerMap, rowIndex) {
        const getValue = category => {
            const index = headerMap[category];
            return index !== undefined && cells[index] ? cells[index].textContent?.trim() : '';
        };

        const tracking = getValue('tracking');
        if (!tracking) {
            return null;
        }

        return {
            tracking,
            dsp: getValue('dsp'),
            status: getValue('status'),
            route: getValue('route'),
            driver: getValue('driver'),
            reason: getValue('reason'),
            rowIndex,
            extractedAt: new Date().toISOString(),
        };
    }

    /**
     * Extract DSP summary data for route planning
     * @param {Array<string>} targetDSPs - DSPs to include (empty = all)
     * @param {number} paidTimeMinutes - Paid time in minutes
     * @returns {object} DSP summary data
     */
    extractDSPSummariesFromRoutePlanning(targetDSPs = [], paidTimeMinutes = 525) {
        try {
            console.log('📊 Extracting DSP summaries from route planning...');

            const tables = Array.from(document.querySelectorAll('table'));
            const summaries = {};

            for (const table of tables) {
                const tableSummaries = this.extractSummariesFromTable(
                    table,
                    targetDSPs,
                    paidTimeMinutes
                );
                Object.assign(summaries, tableSummaries);
            }

            console.log(`📊 Extracted summaries for ${Object.keys(summaries).length} DSPs`);
            return summaries;
        } catch (error) {
            throw new ParsingError('Failed to extract DSP summaries', {
                originalError: error.message,
            });
        }
    }

    /**
     * Extract summaries from a specific table
     * @param {Element} table - Table element
     * @param {Array<string>} targetDSPs - Target DSPs
     * @param {number} paidTimeMinutes - Paid time
     * @returns {object} Extracted summaries
     */
    extractSummariesFromTable(table, targetDSPs, paidTimeMinutes) {
        const summaries = {};
        const rows = Array.from(table.querySelectorAll('tbody tr, tr'));

        for (const row of rows) {
            try {
                const summary = this.extractSummaryFromRow(row, paidTimeMinutes);
                if (summary && summary.dsp) {
                    // Filter by target DSPs if specified
                    if (targetDSPs.length === 0 || targetDSPs.includes(summary.dsp)) {
                        summaries[summary.dsp] = summary;
                    }
                }
            } catch (error) {
                // Skip problematic rows
                continue;
            }
        }

        return summaries;
    }

    /**
     * Extract summary data from a single row
     * @param {Element} row - Table row
     * @param {number} paidTimeMinutes - Paid time
     * @returns {object|null} Summary data
     */
    extractSummaryFromRow(row, paidTimeMinutes) {
        const cells = Array.from(row.querySelectorAll('td, th'));
        if (cells.length < 3) {
            return null;
        }

        // Look for DSP code in first few cells
        let dsp = null;
        for (let i = 0; i < Math.min(3, cells.length); i++) {
            const text = cells[i].textContent?.trim();
            if (text && /^[A-Z]{2,4}\d{0,2}$/.test(text)) {
                dsp = text;
                break;
            }
        }

        if (!dsp) {
            return null;
        }

        // Extract numeric values from cells
        const values = cells
            .map(cell => {
                const text = cell.textContent?.trim() || '';
                return parseIntSafe(text, 0);
            })
            .filter(val => val > 0);

        if (values.length < 2) {
            return null;
        }

        // Try to identify route count, stop count, and package count
        const [routeCount = 0, stopCount = 0, packageCount = 0] = values;

        return {
            dsp,
            routeCount,
            stopCount,
            packageCount,
            paidTimeMinutes,
            utilization: this.calculateUtilization(routeCount, stopCount, paidTimeMinutes),
            extractedAt: new Date().toISOString(),
        };
    }

    /**
     * Calculate utilization metrics
     * @param {number} routeCount - Number of routes
     * @param {number} stopCount - Number of stops
     * @param {number} paidTimeMinutes - Paid time in minutes
     * @returns {object} Utilization metrics
     */
    calculateUtilization(routeCount, stopCount, paidTimeMinutes) {
        const paidTimeHours = paidTimeMinutes / 60;
        const avgStopsPerRoute = routeCount > 0 ? stopCount / routeCount : 0;
        const stopsPerHour = paidTimeHours > 0 ? stopCount / paidTimeHours : 0;

        return {
            avgStopsPerRoute: Math.round(avgStopsPerRoute * 10) / 10,
            stopsPerHour: Math.round(stopsPerHour * 10) / 10,
            routeUtilization: Math.min(100, Math.round((routeCount / 10) * 100)), // Assuming 10 routes = 100%
            timeUtilization: Math.round(((stopCount * 3) / paidTimeMinutes) * 100), // Assuming 3 min per stop
        };
    }

    /**
     * Get extraction statistics
     * @returns {object} Statistics about last extraction
     */
    getStatistics() {
        const tables = Array.from(document.querySelectorAll('table'));
        const totalRows = tables.reduce((sum, table) => {
            return sum + table.querySelectorAll('tr').length;
        }, 0);

        return {
            tableCount: tables.length,
            totalRows,
            lastExtraction: new Date().toISOString(),
        };
    }
}
