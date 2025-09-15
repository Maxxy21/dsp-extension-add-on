/**
 * Summary Sender - Handles sending DSP summaries and reports
 */

import { computeDateParam } from '../shared/utils/date-utils.js';
import { MESSAGE_TYPES } from '../shared/constants.js';
import { NetworkError, ValidationError } from '../shared/errors.js';

export class SummarySender {
    constructor(messageService, dspManager) {
        this.messageService = messageService;
        this.dspManager = dspManager;
        this.isProcessing = false;
    }

    /**
     * Send DSP summary to selected DSPs
     * @param {object} options - Summary options
     * @returns {Promise<object>} Send result
     */
    async sendSummary(options = {}) {
        if (this.isProcessing) {
            throw new Error('Summary sending already in progress');
        }

        try {
            this.isProcessing = true;
            console.log('📊 Starting DSP summary send...');

            // Validate DSP selection
            const selectionInfo = this.dspManager.getSelectionInfo();
            if (!selectionInfo.isValid) {
                throw new ValidationError('No DSPs selected for summary');
            }

            // Get route planning data
            const summaryData = await this.collectSummaryData(selectionInfo.dsps, options);

            // Generate summary messages
            const messages = this.generateSummaryMessages(summaryData, options);

            // Send messages to DSPs
            const results = await this.sendSummaryMessages(messages, selectionInfo);

            console.log(`✅ Summary sent to ${results.successful.length} DSPs`);

            return {
                success: true,
                results,
                summaryData,
                timestamp: new Date().toISOString(),
            };
        } catch (error) {
            console.error('Summary sending failed:', error);
            throw error;
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * Collect summary data from route planning pages
     * @param {Array<string>} targetDSPs - DSPs to collect data for
     * @param {object} options - Collection options
     * @returns {Promise<object>} Summary data
     */
    async collectSummaryData(targetDSPs, options = {}) {
        try {
            console.log('📊 Collecting summary data...');

            // Try to find route planning tab
            const routePlanningTab = await this.findRoutePlanningTab();

            if (routePlanningTab) {
                // Extract data from existing tab
                return await this.extractFromExistingTab(routePlanningTab, targetDSPs, options);
            } else {
                // Open new tab and extract data
                return await this.extractFromNewTab(targetDSPs, options);
            }
        } catch (error) {
            throw new NetworkError('Failed to collect summary data', {
                originalError: error.message,
                targetDSPs,
            });
        }
    }

    /**
     * Find existing route planning tab
     * @returns {Promise<object|null>} Tab object or null
     */
    async findRoutePlanningTab() {
        try {
            const tabs = await browser.tabs.query({
                url: '*://*.route.planning.last-mile.a2z.com/route-planning/*',
            });

            return tabs.length > 0 ? tabs[0] : null;
        } catch (error) {
            console.warn('Failed to query tabs:', error);
            return null;
        }
    }

    /**
     * Extract data from existing route planning tab
     * @param {object} tab - Tab object
     * @param {Array<string>} targetDSPs - Target DSPs
     * @param {object} options - Options
     * @returns {Promise<object>} Extracted data
     */
    async extractFromExistingTab(tab, targetDSPs, options) {
        console.log('📊 Extracting from existing route planning tab...');

        // Get paid time from constraints if needed
        let paidTimeMinutes = options.paidTimeMinutes || 525;

        if (options.collectPaidTime) {
            try {
                paidTimeMinutes = await this.collectPaidTimeFromConstraints();
            } catch (error) {
                console.warn('Failed to collect paid time, using default:', error);
            }
        }

        // Extract summary data from tab
        const response = await browser.tabs.sendMessage(tab.id, {
            action: 'getSummaryData',
            targetDSPs,
            paidTimeMinutes,
        });

        if (!response || !response.success) {
            throw new Error(`Failed to extract data: ${response?.error || 'Unknown error'}`);
        }

        return {
            data: response.data,
            paidTimeMinutes,
            source: 'existing_tab',
            tabId: tab.id,
        };
    }

    /**
     * Extract data from new route planning tab
     * @param {Array<string>} targetDSPs - Target DSPs
     * @param {object} options - Options
     * @returns {Promise<object>} Extracted data
     */
    async extractFromNewTab(targetDSPs, options) {
        console.log('📊 Opening new route planning tab...');

        // Get settings for URL construction
        const settings = await this.getSettings();
        const baseUrl =
            settings.routePlanningBaseUrl ||
            'https://eu.route.planning.last-mile.a2z.com/route-planning';
        const today = computeDateParam('other');

        // Construct route planning URL
        const url = this.buildRoutePlanningURL(baseUrl, today, settings);

        // Open new tab
        const tab = await browser.tabs.create({ url, active: false });

        try {
            // Wait for tab to load
            await this.waitForTabLoad(tab.id);

            // Extract data
            return await this.extractFromExistingTab(tab, targetDSPs, options);
        } finally {
            // Close the tab
            try {
                await browser.tabs.remove(tab.id);
            } catch (error) {
                console.warn('Failed to close tab:', error);
            }
        }
    }

    /**
     * Build route planning URL
     * @param {string} baseUrl - Base URL
     * @param {string} date - Date string
     * @param {object} settings - Settings object
     * @returns {string} Complete URL
     */
    buildRoutePlanningURL(baseUrl, date, settings) {
        try {
            const url = new URL(baseUrl);
            url.searchParams.set('date', date);

            if (settings.serviceAreaId) {
                url.searchParams.set('serviceAreaId', settings.serviceAreaId);
            }

            return url.toString();
        } catch (error) {
            console.warn('Failed to build URL, using base:', error);
            return baseUrl;
        }
    }

    /**
     * Wait for tab to load
     * @param {number} tabId - Tab ID
     * @returns {Promise<void>}
     */
    waitForTabLoad(tabId) {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Tab load timeout'));
            }, 30000);

            const checkTab = async () => {
                try {
                    const tab = await browser.tabs.get(tabId);
                    if (tab.status === 'complete') {
                        clearTimeout(timeout);
                        resolve();
                    } else {
                        setTimeout(checkTab, 1000);
                    }
                } catch (error) {
                    clearTimeout(timeout);
                    reject(error);
                }
            };

            checkTab();
        });
    }

    /**
     * Collect paid time from constraints page
     * @returns {Promise<number>} Paid time in minutes
     */
    async collectPaidTimeFromConstraints() {
        try {
            console.log('⏱️ Collecting paid time from constraints...');

            const settings = await this.getSettings();
            const { constraintsUrl } = settings;

            if (!constraintsUrl) {
                throw new Error('No constraints URL configured');
            }

            // Try to find existing constraints tab
            const constraintsTabs = await browser.tabs.query({
                url: '*://eu.dispatch.planning.last-mile.a2z.com/route-constraints/*',
            });

            if (constraintsTabs.length > 0) {
                const response = await browser.tabs.sendMessage(constraintsTabs[0].id, {
                    action: 'getPaidTimeFromConstraints',
                });

                if (response && response.success && response.paidTime) {
                    return response.paidTime;
                }
            }

            throw new Error('Could not collect paid time from constraints');
        } catch (error) {
            console.warn('Failed to collect paid time:', error);
            return 525; // Default fallback
        }
    }

    /**
     * Generate summary messages for DSPs
     * @param {object} summaryData - Summary data
     * @param {object} options - Message options
     * @returns {Array} Array of message objects
     */
    generateSummaryMessages(summaryData, options = {}) {
        const messages = [];
        const data = summaryData.data || {};
        const paidTime = summaryData.paidTimeMinutes || 525;

        const todayStr = this.formatDateForDisplay(new Date());

        for (const [dsp, item] of Object.entries(data)) {
            if (!item) {
                continue;
            }

            const message = this.createSummaryMessage(dsp, item, paidTime, todayStr, options);

            messages.push({
                dsp,
                message,
                data: item,
            });
        }

        return messages;
    }

    /**
     * Create summary message for a single DSP
     * @param {string} dsp - DSP code
     * @param {object} data - DSP data
     * @param {number} paidTime - Paid time in minutes
     * @param {string} dateStr - Date string
     * @param {object} options - Message options
     * @returns {string} Formatted message
     */
    createSummaryMessage(dsp, data, paidTime, dateStr, _options = {}) {
        const { routeCount = 0, stopCount = 0, packageCount = 0, utilization = {} } = data;

        const message = [
            `📊 Daily Summary for ${dsp} - ${dateStr}`,
            '',
            `🚚 Routes: ${routeCount}`,
            `📍 Stops: ${stopCount}`,
            `📦 Packages: ${packageCount}`,
            `⏱️ Paid Time: ${Math.round((paidTime / 60) * 10) / 10}h`,
            '',
            `📈 Performance:`,
            `• Avg stops/route: ${utilization.avgStopsPerRoute || 0}`,
            `• Stops/hour: ${utilization.stopsPerHour || 0}`,
            `• Route utilization: ${utilization.routeUtilization || 0}%`,
            '',
            `Generated by DSP Management Extension`,
        ].join('\n');

        return message;
    }

    /**
     * Send summary messages to DSPs
     * @param {Array} messages - Array of message objects
     * @param {object} selectionInfo - Selection information
     * @returns {Promise<object>} Send results
     */
    async sendSummaryMessages(messages, _selectionInfo) {
        console.log(`📤 Sending ${messages.length} summary messages...`);

        const results = {
            successful: [],
            failed: [],
            totalSent: 0,
            totalFailed: 0,
        };

        for (const messageObj of messages) {
            try {
                const response = await browser.runtime.sendMessage({
                    action: MESSAGE_TYPES.SEND_MESSAGE,
                    dsp: messageObj.dsp,
                    message: messageObj.message,
                    targetType: 'individual',
                });

                if (response && response.success) {
                    results.successful.push(messageObj.dsp);
                    results.totalSent++;
                } else {
                    results.failed.push({
                        dsp: messageObj.dsp,
                        error: response?.error || 'Unknown error',
                    });
                    results.totalFailed++;
                }
            } catch (error) {
                results.failed.push({
                    dsp: messageObj.dsp,
                    error: error.message,
                });
                results.totalFailed++;
            }
        }

        return results;
    }

    /**
     * Send failed reattempts report
     * @param {object} options - Report options
     * @returns {Promise<object>} Send result
     */
    async sendFailedReattemptsReport(_options = {}) {
        try {
            console.log('📋 Sending failed reattempts report...');

            // Get preview first
            const preview = await browser.runtime.sendMessage({
                action: 'previewFailedReattemptStats',
            });

            if (!preview || !preview.success) {
                throw new Error('Failed to get reattempts preview');
            }

            // Run the actual report
            const result = await browser.runtime.sendMessage({
                action: 'runFailedReattemptReport',
            });

            if (!result || !result.success) {
                throw new Error(
                    `Failed to send reattempts report: ${result?.error || 'Unknown error'}`
                );
            }

            return {
                success: true,
                preview,
                result,
                timestamp: new Date().toISOString(),
            };
        } catch (error) {
            console.error('Failed reattempts report failed:', error);
            throw error;
        }
    }

    /**
     * Get settings from storage
     * @returns {Promise<object>} Settings object
     */
    async getSettings() {
        try {
            const response = await browser.runtime.sendMessage({
                action: MESSAGE_TYPES.GET_SETTINGS,
            });

            if (response && response.success) {
                return response.settings || {};
            }

            return {};
        } catch (error) {
            console.warn('Failed to get settings:', error);
            return {};
        }
    }

    /**
     * Format date for display
     * @param {Date} date - Date to format
     * @returns {string} Formatted date string
     */
    formatDateForDisplay(date) {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();

        return `${day}.${month}.${year}`;
    }

    /**
     * Check if summary sending is in progress
     * @returns {boolean} Whether processing
     */
    isProcessingSummary() {
        return this.isProcessing;
    }

    /**
     * Get summary sender statistics
     * @returns {object} Statistics
     */
    getStatistics() {
        return {
            isProcessing: this.isProcessing,
            lastSendTime: this.lastSendTime || null,
            hasRoutePlanningAccess: this.hasRoutePlanningAccess(),
        };
    }

    /**
     * Check if user has route planning access
     * @returns {boolean} Whether user has access
     */
    hasRoutePlanningAccess() {
        // This could be enhanced to actually check permissions
        return true;
    }
}
