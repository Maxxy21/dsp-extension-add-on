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
