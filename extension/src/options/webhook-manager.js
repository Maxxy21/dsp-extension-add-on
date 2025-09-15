/**
 * Webhook Manager - Handles webhook configuration and testing in options
 */

import { storageService } from '../shared/storage.js';
import { isValidWebhookUrl, isValidDSPCode } from '../shared/utils/validation.js';
import { ValidationError, withErrorHandling } from '../shared/errors.js';

export class WebhookManager {
    constructor() {
        this.webhooks = {};
        this.elements = {
            webhookEntries: null,
            addWebhookBtn: null,
            batchDropZone: null,
            batchTextInput: null,
            showTextInputBtn: null,
            processBatchBtn: null,
            cancelBatchBtn: null,
        };

        this.testResults = new Map();
        this.isTestingWebhooks = false;
        this.autoSaveTimeout = null;
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

        if (this.elements.showTextInputBtn) {
            this.elements.showTextInputBtn.addEventListener(
                'click',
                withErrorHandling(
                    () => this.toggleBatchTextInput(true),
                    'WebhookManager.showBatchInput'
                )
            );
        }

        if (this.elements.cancelBatchBtn) {
            this.elements.cancelBatchBtn.addEventListener(
                'click',
                withErrorHandling(
                    () => this.toggleBatchTextInput(false),
                    'WebhookManager.cancelBatchInput'
                )
            );
        }

        if (this.elements.processBatchBtn) {
            this.elements.processBatchBtn.addEventListener(
                'click',
                withErrorHandling(
                    this.handleBatchTextSubmit.bind(this),
                    'WebhookManager.handleBatchTextSubmit'
                )
            );
        }

        if (this.elements.batchDropZone) {
            const dropZone = this.elements.batchDropZone;
            dropZone.addEventListener('dragover', event => {
                event.preventDefault();
                dropZone.classList.add('drag-over');
            });

            dropZone.addEventListener('dragleave', () => {
                dropZone.classList.remove('drag-over');
            });

            dropZone.addEventListener(
                'drop',
                withErrorHandling(this.handleBatchDrop.bind(this), 'WebhookManager.handleBatchDrop')
            );

            dropZone.addEventListener('click', () => {
                this.toggleBatchTextInput(true);
                this.elements.batchTextInput?.focus();
            });
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
    async saveWebhooks(options = {}) {
        const { silent = false } = options;
        try {
            await storageService.setWebhooks(this.webhooks);
            console.log('💾 Webhooks saved successfully');
            if (!silent) {
                this.showSuccess('Webhook configurations saved');
            }
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
        entryDiv.dataset.dspCode = dspCode;

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

        const dspInput = entry.querySelector('.dsp-code-input');
        const urlInput = entry.querySelector('.webhook-url-input');

        if (
            entry === this.elements.webhookEntries.lastElementChild &&
            dspInput?.value.trim() &&
            urlInput?.value.trim()
        ) {
            this.addWebhookEntry();
        }

        this.debounceAutoSave();
    }

    toggleBatchTextInput(show) {
        const textInput = this.elements.batchTextInput;
        const processBtn = this.elements.processBatchBtn;
        const cancelBtn = this.elements.cancelBatchBtn;
        const showBtn = this.elements.showTextInputBtn;

        if (!textInput || !processBtn || !cancelBtn || !showBtn) {
            return;
        }

        textInput.style.display = show ? 'block' : 'none';
        processBtn.style.display = show ? 'inline-flex' : 'none';
        cancelBtn.style.display = show ? 'inline-flex' : 'none';
        showBtn.style.display = show ? 'none' : 'inline-flex';

        if (!show) {
            textInput.value = '';
        }
    }

    async handleBatchTextSubmit() {
        const textInput = this.elements.batchTextInput;
        if (!textInput) {
            return;
        }

        const imported = await this.processBatchContent(textInput.value);
        if (imported > 0) {
            this.toggleBatchTextInput(false);
        }
    }

    async handleBatchDrop(event) {
        event.preventDefault();
        this.elements.batchDropZone?.classList.remove('drag-over');

        const { dataTransfer } = event;
        if (!dataTransfer) {
            return;
        }

        // Prefer file drop if available
        if (dataTransfer.files && dataTransfer.files.length > 0) {
            const file = dataTransfer.files[0];
            try {
                const text = await this.readFileAsText(file);
                await this.processBatchContent(text);
            } catch (error) {
                console.error('Batch drop failed:', error);
                this.showError('Failed to read dropped file');
            }
            return;
        }

        const text = dataTransfer.getData('text') || dataTransfer.getData('text/plain');
        if (text) {
            await this.processBatchContent(text);
            return;
        }

        this.showInfo('No text data detected in drop');
    }

    async processBatchContent(rawText) {
        if (!rawText || !rawText.trim()) {
            this.showError('No webhook data provided');
            return 0;
        }

        const { records, skipped } = this.parseBatchRecords(rawText);

        if (records.length === 0) {
            this.showError('No valid webhook entries found');
            return 0;
        }

        records.forEach(({ dspCode, webhookUrl }) => {
            this.webhooks[dspCode] = webhookUrl;
        });

        await this.saveWebhooks({ silent: true });
        this.renderWebhookEntries();

        if (this.elements.batchTextInput) {
            this.elements.batchTextInput.value = '';
        }

        const importedCount = records.length;
        const message =
            skipped > 0
                ? `Imported ${importedCount} webhooks. Skipped ${skipped} invalid entries.`
                : `Imported ${importedCount} webhooks.`;

        this.showSuccess(message);
        return importedCount;
    }

    parseBatchRecords(rawText) {
        const lines = rawText
            .split(/\r?\n/)
            .map(line => line.trim())
            .filter(Boolean);

        if (lines.length > 0 && /dsp/i.test(lines[0]) && /webhook/i.test(lines[0])) {
            lines.shift();
        }

        const records = [];
        let skipped = 0;

        lines.forEach(line => {
            let dspCode = '';
            let webhookUrl = '';

            const commaIndex = line.indexOf(',');
            const tabIndex = line.indexOf('\t');

            if (commaIndex !== -1 && (tabIndex === -1 || commaIndex < tabIndex)) {
                dspCode = line.slice(0, commaIndex).trim();
                webhookUrl = line.slice(commaIndex + 1).trim();
            } else if (tabIndex !== -1) {
                dspCode = line.slice(0, tabIndex).trim();
                webhookUrl = line.slice(tabIndex + 1).trim();
            } else {
                const parts = line.split(/\s+/);
                dspCode = parts.shift()?.trim() || '';
                webhookUrl = parts.join(' ').trim();
            }

            dspCode = dspCode.replace(/^"|"$/g, '');
            webhookUrl = webhookUrl.replace(/^"|"$/g, '');

            if (isValidDSPCode(dspCode) && isValidWebhookUrl(webhookUrl)) {
                records.push({ dspCode, webhookUrl });
            } else {
                skipped++;
            }
        });

        return { records, skipped };
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

        const previousCode = entry.dataset.dspCode;
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

        if (previousCode && previousCode !== dspCode && this.webhooks[previousCode]) {
            delete this.webhooks[previousCode];
        }

        if (!dspCode || !webhookUrl) {
            if (previousCode && !dspCode && this.webhooks[previousCode]) {
                delete this.webhooks[previousCode];
            }
            entry.dataset.dspCode = dspCode || '';
            return;
        }

        if (isValidDSPCode(dspCode) && isValidWebhookUrl(webhookUrl)) {
            this.webhooks[dspCode] = webhookUrl;
            entry.dataset.dspCode = dspCode;
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

        // No explicit counter indicator in UI, but this keeps saved data in sync
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
            this.saveWebhooks({ silent: true });
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
