/**
 * DSP Data Parser - Extracts DSP roster data from Amazon logistics pages
 */

import { SELECTORS } from '../shared/constants.js';
import { parseIntSafe } from '../shared/utils/parser-utils.js';
import { DOMError, ParsingError } from '../shared/errors.js';

export class DSPDataParser {
    constructor(serviceInferrer) {
        this.serviceInferrer = serviceInferrer;
        this.dspTotals = new Map();
        this.lastUpdateTime = null;
    }

    /**
     * Parse DSP data for all available service types
     * @returns {Promise<Map>} Map of service type to DSP data
     */
    async parseAllServiceTypes() {
        try {
            const serviceTypes = this.serviceInferrer.getCurrentPageServiceTypes();
            const results = new Map();

            for (const serviceType of serviceTypes) {
                try {
                    const dspData = await this.parseForServiceType(serviceType);
                    if (dspData && dspData.size > 0) {
                        results.set(serviceType, dspData);
                    }
                } catch (error) {
                    console.warn(`Failed to parse data for service type ${serviceType}:`, error);
                }
            }

            this.lastUpdateTime = new Date();
            return results;
        } catch (error) {
            throw new ParsingError('Failed to parse DSP data for all service types', {
                originalError: error.message,
            });
        }
    }

    /**
     * Parse DSP data for a specific service type
     * @param {string} serviceType - Service type to parse
     * @returns {Promise<Map>} Map of DSP name to data
     */
    async parseForServiceType(serviceType) {
        try {
            console.log(`📊 Parsing DSP data for service type: ${serviceType}`);

            const tableRows = await this.getTableRows();
            const serviceSection = this.findServiceSection(tableRows, serviceType);

            if (!serviceSection || serviceSection.length === 0) {
                console.warn(`No data found for service type: ${serviceType}`);
                return new Map();
            }

            return this.extractDSPData(serviceSection, serviceType);
        } catch (error) {
            throw new ParsingError(`Failed to parse service type: ${serviceType}`, {
                serviceType,
                originalError: error.message,
            });
        }
    }

    /**
     * Get all table rows from the page
     * @returns {Promise<Array>} Array of table row elements
     */
    async getTableRows() {
        try {
            const table = await this.waitForTable();
            const rows = Array.from(table.querySelectorAll(SELECTORS.TABLE_ROWS));

            if (rows.length === 0) {
                throw new DOMError('No table rows found', {
                    selector: SELECTORS.TABLE_ROWS,
                    context: 'DSP data table',
                });
            }

            return rows;
        } catch (error) {
            throw DOMError.fromElementNotFound(SELECTORS.TABLE, 'DSP data table');
        }
    }

    /**
     * Wait for the main data table to load
     * @returns {Promise<Element>} Table element
     */
    waitForTable() {
        return new Promise((resolve, reject) => {
            const table = document.querySelector(SELECTORS.TABLE);
            if (table) {
                resolve(table);
                return;
            }

            const observer = new MutationObserver(() => {
                const table = document.querySelector(SELECTORS.TABLE);
                if (table) {
                    observer.disconnect();
                    resolve(table);
                }
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true,
            });

            setTimeout(() => {
                observer.disconnect();
                reject(
                    new DOMError('Table load timeout', {
                        selector: SELECTORS.TABLE,
                        timeout: 10000,
                    })
                );
            }, 10000);
        });
    }

    /**
     * Find the section of rows for a specific service type
     * @param {Array} rows - All table rows
     * @param {string} serviceType - Target service type
     * @returns {Array} Rows belonging to the service type
     */
    findServiceSection(rows, serviceType) {
        const serviceSection = [];
        let isInTargetSection = false;
        let currentServiceType = null;

        for (const row of rows) {
            const serviceTypeCell = row.querySelector(SELECTORS.SERVICE_TYPE_EXPANDABLE);

            if (serviceTypeCell) {
                // This is a service type header row
                currentServiceType = serviceTypeCell.textContent?.trim();
                isInTargetSection = this.isMatchingServiceType(currentServiceType, serviceType);

                if (isInTargetSection) {
                    serviceSection.push(row);
                }
            } else if (isInTargetSection && this.isDSPDataRow(row)) {
                // This is a DSP data row in our target section
                serviceSection.push(row);
            }
        }

        return serviceSection;
    }

    /**
     * Check if service type names match (with fuzzy matching)
     * @param {string} found - Service type found on page
     * @param {string} target - Target service type
     * @returns {boolean} Whether they match
     */
    isMatchingServiceType(found, target) {
        if (!found || !target) {
            return false;
        }

        const normalize = str => str.toLowerCase().replace(/\s+/g, ' ').trim();
        const normalizedFound = normalize(found);
        const normalizedTarget = normalize(target);

        // Exact match
        if (normalizedFound === normalizedTarget) {
            return true;
        }

        // Partial matches for common variations
        const variations = {
            'standard parcel': ['standard', 'parcel', 'cycle1', 'cycle 1'],
            'multi-use': ['multi', 'multiuse', 'multi use', 'sameday b', 'samedayb'],
            'sameday parcel': ['sameday', 'same day', 'sameday c', 'samedayc'],
        };

        for (const [key, aliases] of Object.entries(variations)) {
            if (
                normalizedTarget.includes(key) ||
                aliases.some(alias => normalizedTarget.includes(alias))
            ) {
                if (
                    normalizedFound.includes(key) ||
                    aliases.some(alias => normalizedFound.includes(alias))
                ) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Check if a row contains DSP data
     * @param {Element} row - Table row element
     * @returns {boolean} Whether row contains DSP data
     */
    isDSPDataRow(row) {
        const providerCell = row.querySelector(SELECTORS.PROVIDER_NAME);
        const confirmedCell = row.querySelector(SELECTORS.CONFIRMED_CELL);
        const rosteredCell = row.querySelector(SELECTORS.ROSTERED_CELL);

        return providerCell && (confirmedCell || rosteredCell);
    }

    /**
     * Extract DSP data from service section rows
     * @param {Array} rows - Rows for the service type
     * @param {string} serviceType - Service type name
     * @returns {Map} Map of DSP name to data
     */
    extractDSPData(rows, serviceType) {
        const dspData = new Map();

        for (const row of rows) {
            if (!this.isDSPDataRow(row)) {
                continue;
            }

            try {
                const rowData = this.parseRowData(row, serviceType);
                if (rowData) {
                    dspData.set(rowData.name, rowData);
                }
            } catch (error) {
                console.warn('Failed to parse row data:', error);
            }
        }

        console.log(`📊 Extracted data for ${dspData.size} DSPs in ${serviceType}`);
        return dspData;
    }

    /**
     * Parse data from a single DSP row
     * @param {Element} row - Table row element
     * @param {string} serviceType - Service type
     * @returns {object|null} Parsed DSP data
     */
    parseRowData(row, serviceType) {
        try {
            const providerCell = row.querySelector(SELECTORS.PROVIDER_NAME);
            const confirmedCell = row.querySelector(SELECTORS.CONFIRMED_CELL);
            const rosteredCell = row.querySelector(SELECTORS.ROSTERED_CELL);

            if (!providerCell) {
                return null;
            }

            const dspName = providerCell.textContent?.trim();
            if (!dspName) {
                return null;
            }

            const confirmed = confirmedCell ? parseIntSafe(confirmedCell.textContent, 0) : 0;
            const rostered = rosteredCell ? parseIntSafe(rosteredCell.textContent, 0) : 0;

            // Calculate mismatch
            const mismatch = confirmed - rostered;
            const hasMismatch = mismatch !== 0;

            return {
                name: dspName,
                serviceType,
                confirmed,
                rostered,
                mismatch,
                hasMismatch,
                timestamp: new Date().toISOString(),
                rowElement: row,
            };
        } catch (error) {
            throw new ParsingError('Failed to parse row data', {
                serviceType,
                originalError: error.message,
            });
        }
    }

    /**
     * Get DSP data by name across all service types
     * @param {string} dspName - DSP name to find
     * @returns {Array} Array of DSP data objects
     */
    getDSPByName(dspName) {
        const results = [];

        for (const [serviceType, dspMap] of this.dspTotals) {
            if (dspMap.has(dspName)) {
                results.push({
                    serviceType,
                    ...dspMap.get(dspName),
                });
            }
        }

        return results;
    }

    /**
     * Get all DSPs with mismatches
     * @returns {Array} Array of DSP data with mismatches
     */
    getMismatchedDSPs() {
        const mismatched = [];

        for (const [serviceType, dspMap] of this.dspTotals) {
            for (const [dspName, data] of dspMap) {
                if (data.hasMismatch) {
                    mismatched.push({
                        serviceType,
                        dspName,
                        ...data,
                    });
                }
            }
        }

        return mismatched.sort((a, b) => Math.abs(b.mismatch) - Math.abs(a.mismatch));
    }

    /**
     * Get summary statistics
     * @returns {object} Summary statistics
     */
    getSummaryStats() {
        let totalDSPs = 0;
        let totalMismatches = 0;
        let totalConfirmed = 0;
        let totalRostered = 0;

        for (const dspMap of this.dspTotals.values()) {
            for (const data of dspMap.values()) {
                totalDSPs++;
                totalConfirmed += data.confirmed;
                totalRostered += data.rostered;
                if (data.hasMismatch) {
                    totalMismatches++;
                }
            }
        }

        return {
            totalDSPs,
            totalMismatches,
            totalConfirmed,
            totalRostered,
            mismatchPercentage:
                totalDSPs > 0 ? ((totalMismatches / totalDSPs) * 100).toFixed(1) : 0,
            lastUpdateTime: this.lastUpdateTime,
        };
    }

    /**
     * Refresh all data
     * @returns {Promise<Map>} Updated DSP data
     */
    async refresh() {
        console.log('🔄 Refreshing DSP data...');
        this.dspTotals = await this.parseAllServiceTypes();
        return this.dspTotals;
    }

    /**
     * Get cached data
     * @returns {Map} Cached DSP data
     */
    getCachedData() {
        return this.dspTotals;
    }
}
