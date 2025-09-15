/**
 * Webhook Manager - Handles webhook configuration and testing in options
 */

import { storageService } from '../shared/storage.js';
import { isValidWebhookUrl, isValidDSPCode } from '../shared/utils/validation.js';
import { parseCSV } from '../shared/utils/parser-utils.js';
import { ValidationError, withErrorHandling } from '../shared/errors.js';

export class WebhookManager {
    constructor() {
        this.webhooks = {};
        this.elements = {
            webhookEntries: null,
            addWebhookBtn: null,
            importBtn: null,
            exportBtn: null,
        };

        this.testResults = new Map();
        this.isTestingWebhooks = false;
    }

    /**
     * Initialize webhook manager with DOM elements
     * @param {object} elements - DOM elements
     */
    initialize(elements) {
        this.elements = { ...this.elements, ...elements };
        this.setupEventListeners();
        this.loadWebhooks();
    }

    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // Add webhook button
        if (this.elements.addWebhookBtn) {
            this.elements.addWebhookBtn.addEventListener(
                'click',
                withErrorHandling(this.addWebhookEntry.bind(this), 'WebhookManager.addWebhookEntry')
            );
        }

        // Import/Export buttons
        if (this.elements.importBtn) {
            this.elements.importBtn.addEventListener(
                'click',
                withErrorHandling(this.importWebhooks.bind(this), 'WebhookManager.importWebhooks')
            );
        }

        if (this.elements.exportBtn) {
            this.elements.exportBtn.addEventListener(
                'click',
                withErrorHandling(this.exportWebhooks.bind(this), 'WebhookManager.exportWebhooks')
            );
        }

        // Container event delegation for dynamic elements
        if (this.elements.webhookEntries) {
            this.elements.webhookEntries.addEventListener(
                'click',
                withErrorHandling(
                    this.handleContainerClick.bind(this),
                    'WebhookManager.handleContainerClick'
                )
            );

            this.elements.webhookEntries.addEventListener(
                'input',
                withErrorHandling(
                    this.handleContainerInput.bind(this),
                    'WebhookManager.handleContainerInput'
                )
            );
        }
    }

    /**
     * Load webhooks from storage
     */
    async loadWebhooks() {
        try {
            console.log('📡 Loading webhook configurations...');

            this.webhooks = await storageService.getWebhooks();
            this.renderWebhookEntries();

            console.log(`✅ Loaded ${Object.keys(this.webhooks).length} webhook configurations`);
        } catch (error) {
            console.error('Failed to load webhooks:', error);
            this.showError('Failed to load webhook configurations');
        }
    }

    /**
     * Save webhooks to storage
     */
    async saveWebhooks() {
        try {
            await storageService.setWebhooks(this.webhooks);
            console.log('💾 Webhooks saved successfully');
            this.showSuccess('Webhook configurations saved');
        } catch (error) {
            console.error('Failed to save webhooks:', error);
            this.showError('Failed to save webhook configurations');
            throw error;
        }
    }

    /**
     * Render webhook entries in the UI
     */
    renderWebhookEntries() {
        if (!this.elements.webhookEntries) {
            return;
        }

        this.elements.webhookEntries.textContent = '';

        // Add existing webhooks
        Object.entries(this.webhooks).forEach(([dspCode, webhookUrl]) => {
            this.createWebhookEntry(dspCode, webhookUrl);
        });

        // Always have one empty entry at the end
        this.createWebhookEntry('', '');

        this.updateWebhookCount();
    }

    /**
     * Create a single webhook entry
     * @param {string} dspCode - DSP code
     * @param {string} webhookUrl - Webhook URL
     */
    createWebhookEntry(dspCode = '', webhookUrl = '') {
        const entryDiv = document.createElement('div');
        entryDiv.className = 'webhook-entry';

        const fields = document.createElement('div');
        fields.className = 'webhook-fields';

        const dspInput = document.createElement('input');
        dspInput.type = 'text';
        dspInput.className = 'dsp-code-input';
        dspInput.placeholder = 'DSP Code (e.g., DHH1)';
        dspInput.maxLength = 10;
        dspInput.value = dspCode;

        const urlInput = document.createElement('input');
        urlInput.type = 'url';
        urlInput.className = 'webhook-url-input';
        urlInput.placeholder = 'Webhook URL (https://hooks.chime.aws/...)';
        urlInput.value = webhookUrl;

        const actions = document.createElement('div');
        actions.className = 'webhook-actions';

        const testBtn = document.createElement('button');
        testBtn.type = 'button';
        testBtn.className = 'btn btn-small test-webhook';
        testBtn.title = 'Test Webhook';
        testBtn.textContent = '🧪 Test';

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'btn btn-small btn-danger remove-webhook';
        removeBtn.title = 'Remove';
        removeBtn.textContent = '🗑️';

        actions.appendChild(testBtn);
        actions.appendChild(removeBtn);

        fields.appendChild(dspInput);
        fields.appendChild(urlInput);
        fields.appendChild(actions);

        const statusDiv = document.createElement('div');
        statusDiv.className = 'webhook-status';

        entryDiv.appendChild(fields);
        entryDiv.appendChild(statusDiv);

        this.elements.webhookEntries.appendChild(entryDiv);

        // Update validation on load
        this.validateWebhookEntry(entryDiv);

        return entryDiv;
    }

    /**
     * Add a new empty webhook entry
     */
    addWebhookEntry() {
        this.createWebhookEntry('', '');
        this.updateWebhookCount();

        // Focus on the new DSP code input
        const newEntry = this.elements.webhookEntries.lastElementChild;
        const dspInput = newEntry?.querySelector('.dsp-code-input');
        if (dspInput) {
            dspInput.focus();
        }
    }

    /**
     * Handle clicks within the webhook container
     * @param {Event} event - Click event
     */
    handleContainerClick(event) {
        const { target } = event;

        if (target.classList.contains('remove-webhook')) {
            this.removeWebhookEntry(target.closest('.webhook-entry'));
        } else if (target.classList.contains('test-webhook')) {
            this.testWebhookEntry(target.closest('.webhook-entry'));
        }
    }

    /**
     * Handle input changes within the webhook container
     * @param {Event} event - Input event
     */
    handleContainerInput(event) {
        const { target } = event;
        const entry = target.closest('.webhook-entry');

        if (!entry) {
            return;
        }

        // Update validation
        this.validateWebhookEntry(entry);

        // Auto-save if both fields are filled
        const dspInput = entry.querySelector('.dsp-code-input');
        const urlInput = entry.querySelector('.webhook-url-input');

        if (dspInput?.value.trim() && urlInput?.value.trim()) {
            this.debounceAutoSave();
        }

        // Add new empty entry if this is the last entry and both fields are filled
        if (
            entry === this.elements.webhookEntries.lastElementChild &&
            dspInput?.value.trim() &&
            urlInput?.value.trim()
        ) {
            this.addWebhookEntry();
        }
    }

    /**
     * Remove a webhook entry
     * @param {Element} entry - Entry element to remove
     */
    removeWebhookEntry(entry) {
        if (!entry) {
            return;
        }

        const dspInput = entry.querySelector('.dsp-code-input');
        const dspCode = dspInput?.value.trim();

        // Remove from webhooks object
        if (dspCode && this.webhooks[dspCode]) {
            delete this.webhooks[dspCode];
        }

        // Remove from DOM
        entry.remove();

        // Save changes
        this.saveWebhooks();
        this.updateWebhookCount();

        console.log(`🗑️ Removed webhook for ${dspCode || 'empty entry'}`);
    }

    /**
     * Test a webhook entry
     * @param {Element} entry - Entry element to test
     */
    async testWebhookEntry(entry) {
        if (!entry || this.isTestingWebhooks) {
            return;
        }

        const dspInput = entry.querySelector('.dsp-code-input');
        const urlInput = entry.querySelector('.webhook-url-input');
        const statusDiv = entry.querySelector('.webhook-status');

        const dspCode = dspInput?.value.trim();
        const webhookUrl = urlInput?.value.trim();

        if (!dspCode || !webhookUrl) {
            this.showEntryStatus(
                statusDiv,
                'Please fill in both DSP code and webhook URL',
                'error'
            );
            return;
        }

        try {
            this.isTestingWebhooks = true;
            this.showEntryStatus(statusDiv, 'Testing webhook...', 'info');

            // Validate inputs
            if (!isValidDSPCode(dspCode)) {
                throw new ValidationError('Invalid DSP code format');
            }

            if (!isValidWebhookUrl(webhookUrl)) {
                throw new ValidationError('Invalid webhook URL');
            }

            // Send test message via background script
            const response = await browser.runtime.sendMessage({
                action: 'testWebhook',
                dspCode,
                webhookUrl,
            });

            if (response && response.success) {
                this.showEntryStatus(statusDiv, 'Test successful! ✅', 'success');
                this.testResults.set(dspCode, { success: true, timestamp: Date.now() });
            } else {
                throw new Error(response?.error || 'Test failed');
            }
        } catch (error) {
            console.error(`Webhook test failed for ${dspCode}:`, error);
            this.showEntryStatus(statusDiv, `Test failed: ${error.message}`, 'error');
            this.testResults.set(dspCode, {
                success: false,
                error: error.message,
                timestamp: Date.now(),
            });
        } finally {
            this.isTestingWebhooks = false;
        }
    }

    /**
     * Validate a webhook entry
     * @param {Element} entry - Entry element to validate
     */
    validateWebhookEntry(entry) {
        const dspInput = entry.querySelector('.dsp-code-input');
        const urlInput = entry.querySelector('.webhook-url-input');

        if (!dspInput || !urlInput) {
            return;
        }

        const dspCode = dspInput.value.trim();
        const webhookUrl = urlInput.value.trim();

        // Reset validation classes
        dspInput.classList.remove('valid', 'invalid');
        urlInput.classList.remove('valid', 'invalid');

        // Validate DSP code
        if (dspCode) {
            if (isValidDSPCode(dspCode)) {
                dspInput.classList.add('valid');
            } else {
                dspInput.classList.add('invalid');
                dspInput.title = 'DSP code should be 3-6 alphanumeric characters (e.g., DHH1)';
            }
        }

        // Validate webhook URL
        if (webhookUrl) {
            if (isValidWebhookUrl(webhookUrl)) {
                urlInput.classList.add('valid');
            } else {
                urlInput.classList.add('invalid');
                urlInput.title = 'Must be a valid HTTPS webhook URL';
            }
        }

        // Update webhooks object if both are valid
        if (dspCode && webhookUrl && isValidDSPCode(dspCode) && isValidWebhookUrl(webhookUrl)) {
            this.webhooks[dspCode] = webhookUrl;
        }
    }

    /**
     * Show status in an entry
     * @param {Element} statusDiv - Status div element
     * @param {string} message - Status message
     * @param {string} type - Status type (info, success, error)
     */
    showEntryStatus(statusDiv, message, type = 'info') {
        if (!statusDiv) {
            return;
        }

        statusDiv.textContent = message;
        statusDiv.className = `webhook-status ${type}`;

        // Auto-clear after 5 seconds
        setTimeout(() => {
            statusDiv.textContent = '';
            statusDiv.className = 'webhook-status';
        }, 5000);
    }

    /**
     * Update webhook count display
     */
    updateWebhookCount() {
        const count = Object.keys(this.webhooks).length;
        const countElement = document.getElementById('webhookCount');

        if (countElement) {
            countElement.textContent = count;
        }

        // Update export button state
        if (this.elements.exportBtn) {
            this.elements.exportBtn.disabled = count === 0;
        }
    }

    /**
     * Import webhooks from CSV
     */
    importWebhooks() {
        try {
            // Create file input
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = '.csv';

            fileInput.onchange = async event => {
                const file = event.target.files[0];
                if (!file) {
                    return;
                }

                try {
                    const text = await this.readFileAsText(file);
                    const parsed = parseCSV(text, { headers: true });

                    let imported = 0;

                    for (const row of parsed) {
                        const dspCode = row.dsp || row.DSP || row['DSP Code'] || '';
                        const webhookUrl = row.webhook || row.Webhook || row['Webhook URL'] || '';

                        if (
                            dspCode &&
                            webhookUrl &&
                            isValidDSPCode(dspCode) &&
                            isValidWebhookUrl(webhookUrl)
                        ) {
                            this.webhooks[dspCode] = webhookUrl;
                            imported++;
                        }
                    }

                    await this.saveWebhooks();
                    this.renderWebhookEntries();

                    this.showSuccess(`Imported ${imported} webhook configurations`);
                } catch (error) {
                    console.error('Import failed:', error);
                    this.showError('Failed to import webhooks');
                }
            };

            fileInput.click();
        } catch (error) {
            console.error('Import setup failed:', error);
            this.showError('Failed to set up import');
        }
    }

    /**
     * Export webhooks to CSV
     */
    exportWebhooks() {
        try {
            const webhookEntries = Object.entries(this.webhooks);

            if (webhookEntries.length === 0) {
                this.showError('No webhooks to export');
                return;
            }

            // Create CSV content
            const csvContent = [
                'DSP Code,Webhook URL',
                ...webhookEntries.map(([dsp, url]) => `${dsp},${url}`),
            ].join('\n');

            // Create and download file
            const blob = new Blob([csvContent], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);

            const link = document.createElement('a');
            link.href = url;
            link.download = `dsp-webhooks-${new Date().toISOString().slice(0, 10)}.csv`;
            link.click();

            URL.revokeObjectURL(url);

            this.showSuccess(`Exported ${webhookEntries.length} webhook configurations`);
        } catch (error) {
            console.error('Export failed:', error);
            this.showError('Failed to export webhooks');
        }
    }

    /**
     * Read file as text
     * @param {File} file - File to read
     * @returns {Promise<string>} File content
     */
    readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error);
            reader.readAsText(file);
        });
    }

    /**
     * Debounced auto-save function
     */
    debounceAutoSave() {
        clearTimeout(this.autoSaveTimeout);
        this.autoSaveTimeout = setTimeout(() => {
            this.saveWebhooks();
        }, 1000);
    }

    /**
     * Test all webhooks
     */
    async testAllWebhooks() {
        if (this.isTestingWebhooks) {
            return;
        }

        const webhookEntries = Object.keys(this.webhooks);

        if (webhookEntries.length === 0) {
            this.showError('No webhooks to test');
            return;
        }

        try {
            this.isTestingWebhooks = true;
            this.showInfo(`Testing ${webhookEntries.length} webhooks...`);

            const entries = Array.from(this.elements.webhookEntries.children);
            const testPromises = entries
                .map(entry => {
                    const dspInput = entry.querySelector('.dsp-code-input');
                    const dspCode = dspInput?.value.trim();

                    if (dspCode && this.webhooks[dspCode]) {
                        return this.testWebhookEntry(entry);
                    }
                })
                .filter(Boolean);

            await Promise.allSettled(testPromises);

            const successful = Array.from(this.testResults.values()).filter(
                result => result.success
            ).length;

            this.showSuccess(
                `Webhook testing complete: ${successful}/${webhookEntries.length} successful`
            );
        } catch (error) {
            console.error('Bulk webhook testing failed:', error);
            this.showError('Failed to test webhooks');
        } finally {
            this.isTestingWebhooks = false;
        }
    }

    /**
     * Get webhook statistics
     * @returns {object} Webhook statistics
     */
    getStatistics() {
        const testResults = Array.from(this.testResults.values());
        const successfulTests = testResults.filter(result => result.success).length;

        return {
            totalWebhooks: Object.keys(this.webhooks).length,
            testedWebhooks: testResults.length,
            successfulTests,
            isTestingInProgress: this.isTestingWebhooks,
            lastTestTime:
                testResults.length > 0 ? Math.max(...testResults.map(r => r.timestamp)) : null,
        };
    }

    /**
     * Show success message
     * @param {string} message - Success message
     */
    showSuccess(message) {
        this.showToast(message, 'success');
    }

    /**
     * Show error message
     * @param {string} message - Error message
     */
    showError(message) {
        this.showToast(message, 'error');
    }

    /**
     * Show info message
     * @param {string} message - Info message
     */
    showInfo(message) {
        this.showToast(message, 'info');
    }

    /**
     * Show toast notification
     * @param {string} message - Message to show
     * @param {string} type - Toast type
     */
    showToast(message, type = 'info') {
        // This would integrate with the options page toast system
        console.log(`Webhook Manager Toast (${type}): ${message}`);

        // Try to find and use the options page toast
        const toast = document.getElementById('toast');
        if (toast) {
            toast.textContent = message;
            toast.className = `toast ${type} show`;
            setTimeout(() => {
                toast.className = 'toast';
            }, 3000);
        }
    }
}
