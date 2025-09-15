/**
 * Backbrief Extractor - Extracts backbrief data from Amazon logistics pages
 */

import { parseIntSafe } from '../../shared/utils/parser-utils.js';
import { ParsingError } from '../../shared/errors.js';

export class BackbriefExtractor {
    constructor() {
        this.expectedHeaders = {
            tracking: ['tracking', 'tracking id', 'tracking number', 'package id'],
            dsp: ['dsp', 'dsp code', 'delivery service partner', 'provider'],
            reason: ['reason', 'failure reason', 'delivery reason', 'unable reason'],
            status: ['status', 'delivery status', 'package status'],
            attempt: ['attempt', 'attempt number', 'delivery attempt'],
            location: ['location', 'address', 'delivery location'],
            timestamp: ['time', 'timestamp', 'delivery time', 'attempt time'],
        };

        this.reasonMappings = {
            'customer not available': 'Customer Not Available',
            'customer refused': 'Customer Refused',
            'address issue': 'Address Issue',
            'access issue': 'Access Issue',
            'package damaged': 'Package Damaged',
            weather: 'Weather',
            'vehicle issue': 'Vehicle Issue',
            'unable to access': 'Unable to Access',
            'no safe location': 'No Safe Location',
            other: 'Other',
        };
    }

    /**
     * Extract backbrief data from the current page
     * @param {Array<string>} includeReasons - Specific reasons to include (empty = all)
     * @param {boolean} mapUnableToAccess - Whether to map "unable to access" reasons
     * @returns {Array} Array of backbrief records
     */
    extractBackbriefFromPage(includeReasons = [], mapUnableToAccess = true) {
        try {
            console.log('📋 Extracting backbrief data...');

            const tables = Array.from(document.querySelectorAll('table'));
            let bestTable = null;
            let bestScore = 0;

            // Find the table that looks most like backbrief data
            for (const table of tables) {
                const score = this.scoreTableForBackbriefData(table);
                if (score > bestScore) {
                    bestScore = score;
                    bestTable = table;
                }
            }

            if (!bestTable || bestScore < 2) {
                console.warn('No suitable backbrief table found');
                return [];
            }

            const records = this.extractDataFromTable(bestTable, includeReasons, mapUnableToAccess);

            console.log(`📋 Extracted ${records.length} backbrief records`);
            return records;
        } catch (error) {
            throw new ParsingError('Failed to extract backbrief data', {
                originalError: error.message,
            });
        }
    }

    /**
     * Score a table for how likely it contains backbrief data
     * @param {Element} table - Table element to score
     * @returns {number} Score (higher = more likely)
     */
    scoreTableForBackbriefData(table) {
        const headers = this.getTableHeaders(table);
        let score = 0;

        // Check for expected headers
        for (const [category, variations] of Object.entries(this.expectedHeaders)) {
            for (const header of headers) {
                for (const variation of variations) {
                    if (header.toLowerCase().includes(variation)) {
                        score += category === 'reason' ? 3 : 1; // Reason is most important for backbrief
                        break;
                    }
                }
            }
        }

        // Look for failure-related keywords in content
        const tableText = table.textContent?.toLowerCase() || '';
        const failureKeywords = ['failed', 'unable', 'refused', 'damaged', 'weather', 'access'];
        for (const keyword of failureKeywords) {
            if (tableText.includes(keyword)) {
                score += 1;
                break;
            }
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
     * @param {Array<string>} includeReasons - Reasons to include
     * @param {boolean} mapUnableToAccess - Whether to map unable to access
     * @returns {Array} Extracted records
     */
    extractDataFromTable(table, includeReasons, mapUnableToAccess) {
        const headers = this.getTableHeaders(table);
        const headerMap = this.createHeaderMap(headers);

        if (!headerMap.tracking && !headerMap.dsp) {
            throw new ParsingError('No tracking ID or DSP column found in backbrief table');
        }

        const records = [];
        const rows = Array.from(
            table.querySelectorAll('tbody tr') || table.querySelectorAll('tr')
        ).slice(1);

        for (const [index, row] of rows.entries()) {
            try {
                const cells = Array.from(row.querySelectorAll('td, th'));
                const record = this.extractRowData(cells, headerMap, index, mapUnableToAccess);

                if (record && this.shouldIncludeRecord(record, includeReasons)) {
                    records.push(record);
                }
            } catch (error) {
                console.warn(`Failed to parse backbrief row ${index}:`, error);
            }
        }

        return records;
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
     * @param {number} rowIndex - Row index
     * @param {boolean} mapUnableToAccess - Whether to map unable to access
     * @returns {object|null} Extracted record
     */
    extractRowData(cells, headerMap, rowIndex, mapUnableToAccess) {
        const getValue = category => {
            const index = headerMap[category];
            return index !== undefined && cells[index] ? cells[index].textContent?.trim() : '';
        };

        const tracking = getValue('tracking');
        const dsp = getValue('dsp');

        if (!tracking && !dsp) {
            return null;
        }

        let reason = getValue('reason');

        // Map "unable to access" reasons if requested
        if (mapUnableToAccess && reason) {
            reason = this.mapUnableToAccessReason(reason);
        }

        const record = {
            tracking: tracking || 'N/A',
            dsp: dsp || 'Unknown',
            reason: reason || 'Unknown',
            status: getValue('status'),
            attempt: parseIntSafe(getValue('attempt'), 1),
            location: getValue('location'),
            timestamp: getValue('timestamp'),
            rowIndex,
            extractedAt: new Date().toISOString(),
        };

        // Normalize reason
        record.normalizedReason = this.normalizeReason(record.reason);

        return record;
    }

    /**
     * Map "unable to access" reasons to more specific categories
     * @param {string} reason - Original reason
     * @returns {string} Mapped reason
     */
    mapUnableToAccessReason(reason) {
        const reasonLower = reason.toLowerCase();

        if (reasonLower.includes('unable to access') || reasonLower.includes('no access')) {
            if (reasonLower.includes('gate') || reasonLower.includes('locked')) {
                return 'Access Issue - Gate/Lock';
            } else if (reasonLower.includes('business closed')) {
                return 'Access Issue - Business Closed';
            } else if (reasonLower.includes('building') || reasonLower.includes('apartment')) {
                return 'Access Issue - Building';
            } else {
                return 'Access Issue - General';
            }
        }

        return reason;
    }

    /**
     * Normalize reason text
     * @param {string} reason - Raw reason
     * @returns {string} Normalized reason
     */
    normalizeReason(reason) {
        if (!reason) {
            return 'Unknown';
        }

        const reasonLower = reason.toLowerCase();

        // Check for known patterns
        for (const [pattern, normalized] of Object.entries(this.reasonMappings)) {
            if (reasonLower.includes(pattern)) {
                return normalized;
            }
        }

        // Clean up the reason text
        return reason
            .replace(/[^\w\s-]/g, '') // Remove special characters
            .replace(/\s+/g, ' ') // Normalize whitespace
            .trim()
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
    }

    /**
     * Check if a record should be included based on reason filters
     * @param {object} record - Backbrief record
     * @param {Array<string>} includeReasons - Reasons to include
     * @returns {boolean} Whether to include the record
     */
    shouldIncludeRecord(record, includeReasons) {
        if (includeReasons.length === 0) {
            return true; // Include all if no filter specified
        }

        const recordReason = record.normalizedReason.toLowerCase();

        return includeReasons.some(filterReason => {
            const filterLower = filterReason.toLowerCase();
            return recordReason.includes(filterLower) || filterLower.includes(recordReason);
        });
    }

    /**
     * Extract ongoing risks from the current page
     * @returns {Array} Array of risk records
     */
    extractOngoingRisksFromPage() {
        try {
            console.log('⚠️ Extracting ongoing risks...');

            const riskHeaders = {
                dsp: ['dsp', 'dsp code', 'provider'],
                riskType: ['risk type', 'risk', 'issue type', 'alert type'],
                severity: ['severity', 'level', 'priority'],
                description: ['description', 'details', 'issue', 'alert'],
                status: ['status', 'state'],
                lastUpdate: ['last update', 'updated', 'timestamp'],
            };

            const tables = Array.from(document.querySelectorAll('table'));
            const risks = [];

            for (const table of tables) {
                const tableRisks = this.extractRisksFromTable(table, riskHeaders);
                risks.push(...tableRisks);
            }

            console.log(`⚠️ Extracted ${risks.length} ongoing risks`);
            return risks;
        } catch (error) {
            throw new ParsingError('Failed to extract ongoing risks', {
                originalError: error.message,
            });
        }
    }

    /**
     * Extract risks from a specific table
     * @param {Element} table - Table element
     * @param {object} riskHeaders - Expected risk headers
     * @returns {Array} Array of risk records
     */
    extractRisksFromTable(table, riskHeaders) {
        const headers = this.getTableHeaders(table);
        const headerMap = {};

        // Map headers
        for (const [category, variations] of Object.entries(riskHeaders)) {
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

        // Must have at least DSP and risk type
        if (!headerMap.dsp && !headerMap.riskType) {
            return [];
        }

        const risks = [];
        const rows = Array.from(
            table.querySelectorAll('tbody tr') || table.querySelectorAll('tr')
        ).slice(1);

        for (const [index, row] of rows.entries()) {
            try {
                const cells = Array.from(row.querySelectorAll('td, th'));
                const risk = this.extractRiskFromRow(cells, headerMap, index);

                if (risk) {
                    risks.push(risk);
                }
            } catch (error) {
                console.warn(`Failed to parse risk row ${index}:`, error);
            }
        }

        return risks;
    }

    /**
     * Extract risk data from a single row
     * @param {Array} cells - Table cells
     * @param {object} headerMap - Header mapping
     * @param {number} rowIndex - Row index
     * @returns {object|null} Risk record
     */
    extractRiskFromRow(cells, headerMap, rowIndex) {
        const getValue = category => {
            const index = headerMap[category];
            return index !== undefined && cells[index] ? cells[index].textContent?.trim() : '';
        };

        const dsp = getValue('dsp');
        const riskType = getValue('riskType');

        if (!dsp && !riskType) {
            return null;
        }

        return {
            dsp: dsp || 'Unknown',
            riskType: riskType || 'Unknown',
            severity: getValue('severity') || 'Unknown',
            description: getValue('description'),
            status: getValue('status') || 'Active',
            lastUpdate: getValue('lastUpdate'),
            rowIndex,
            extractedAt: new Date().toISOString(),
        };
    }

    /**
     * Get extraction statistics
     * @returns {object} Statistics about extractions
     */
    getStatistics() {
        const tables = Array.from(document.querySelectorAll('table'));
        const totalRows = tables.reduce((sum, table) => {
            return sum + table.querySelectorAll('tr').length;
        }, 0);

        return {
            tableCount: tables.length,
            totalRows,
            hasReasonColumn: this.hasReasonColumn(),
            hasTrackingColumn: this.hasTrackingColumn(),
            lastExtraction: new Date().toISOString(),
        };
    }

    /**
     * Check if any table has a reason column
     * @returns {boolean} Whether reason column exists
     */
    hasReasonColumn() {
        const tables = Array.from(document.querySelectorAll('table'));

        for (const table of tables) {
            const headers = this.getTableHeaders(table);
            for (const header of headers) {
                if (
                    this.expectedHeaders.reason.some(variation =>
                        header.toLowerCase().includes(variation)
                    )
                ) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Check if any table has a tracking column
     * @returns {boolean} Whether tracking column exists
     */
    hasTrackingColumn() {
        const tables = Array.from(document.querySelectorAll('table'));

        for (const table of tables) {
            const headers = this.getTableHeaders(table);
            for (const header of headers) {
                if (
                    this.expectedHeaders.tracking.some(variation =>
                        header.toLowerCase().includes(variation)
                    )
                ) {
                    return true;
                }
            }
        }

        return false;
    }
}
