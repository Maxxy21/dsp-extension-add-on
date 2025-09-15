/**
 * Popup Script Entry Point
 * Main popup interface for the DSP Management Extension
 */

import { DSPManager } from './dsp-manager.js';
import { SummarySender } from './summary-sender.js';
import { MESSAGE_TYPES } from '../shared/constants.js';
import { validateMessage } from '../shared/utils/validation.js';
import { ErrorHandler, withErrorHandling } from '../shared/errors.js';

class PopupManager {
    constructor() {
        this.dspManager = null;
        this.summarySender = null;
        this.messageService = new MessageService();
        this.isLoading = false;

        this.elements = {};
        this.characterLimit = 2000;

        this.setupPolyfill();
        this.initialize();
    }

    /**
     * Set up browser polyfill for compatibility
     */
    setupPolyfill() {
        if (typeof browser === 'undefined' && typeof chrome !== 'undefined') {
            window.browser = chrome;
        }
    }

    /**
     * Initialize the popup
     */
    async initialize() {
        try {
            console.log('🎉 Initializing DSP Management popup...');

            // Wait for DOM to be ready
            if (document.readyState === 'loading') {
                await new Promise(resolve => {
                    document.addEventListener('DOMContentLoaded', resolve);
                });
            }

            // Cache DOM elements
            this.cacheElements();

            // Initialize managers
            this.initializeManagers();

            // Set up event listeners
            this.setupEventListeners();

            // Load initial data
            await this.loadInitialData();

            // Set up character counter
            this.setupCharacterCounter();

            console.log('✅ Popup initialized successfully');
        } catch (error) {
            ErrorHandler.logError(error, 'PopupManager.initialize');
            this.showError('Failed to initialize popup');
        }
    }

    /**
     * Cache DOM elements
     */
    cacheElements() {
        this.elements = {
            // DSP selection elements
            dspSelect: document.getElementById('dspSelect'),
            checkboxContainer: document.getElementById('dspCheckboxes'),
            totalDspCount: document.getElementById('totalDspCount'),
            individualGroup: document.getElementById('individualDspGroup'),
            multipleGroup: document.getElementById('multipleDspGroup'),
            allGroup: document.getElementById('allDspGroup'),

            // Message elements
            messageInput: document.getElementById('message'),
            charCount: document.getElementById('charCount'),
            sendButtonText: document.getElementById('sendButtonText'),

            // Action buttons
            checkNowButton: document.getElementById('checkNow'),
            sendSummaryButton: document.getElementById('sendSummary'),
            sendReattemptsButton: document.getElementById('sendReattempts'),
            sendMessageButton: document.getElementById('sendMessage'),
            openSettingsButton: document.getElementById('openSettings'),

            // Status elements
            connectionStatus: document.getElementById('connectionStatus'),
            toast: document.getElementById('status'),
        };

        // Validate required elements
        const requiredElements = ['dspSelect', 'messageInput', 'sendMessageButton'];
        const missing = requiredElements.filter(key => !this.elements[key]);

        if (missing.length > 0) {
            throw new Error(`Missing required elements: ${missing.join(', ')}`);
        }
    }

    /**
     * Initialize manager modules
     */
    initializeManagers() {
        this.dspManager = new DSPManager(this.messageService);
        this.summarySender = new SummarySender(this.messageService, this.dspManager);

        // Initialize DSP manager with DOM elements
        this.dspManager.initialize({
            dspSelect: this.elements.dspSelect,
            checkboxContainer: this.elements.checkboxContainer,
            totalDspCount: this.elements.totalDspCount,
            individualGroup: this.elements.individualGroup,
            multipleGroup: this.elements.multipleGroup,
            allGroup: this.elements.allGroup,
        });
    }

    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // Manual check button
        if (this.elements.checkNowButton) {
            this.elements.checkNowButton.addEventListener(
                'click',
                withErrorHandling(
                    this.handleManualCheck.bind(this),
                    'PopupManager.handleManualCheck'
                )
            );
        }

        // Send message button
        this.elements.sendMessageButton.addEventListener(
            'click',
            withErrorHandling(this.handleSendMessage.bind(this), 'PopupManager.handleSendMessage')
        );

        // Send summary button
        if (this.elements.sendSummaryButton) {
            this.elements.sendSummaryButton.addEventListener(
                'click',
                withErrorHandling(
                    this.handleSendSummary.bind(this),
                    'PopupManager.handleSendSummary'
                )
            );
        }

        // Send reattempts button
        if (this.elements.sendReattemptsButton) {
            this.elements.sendReattemptsButton.addEventListener(
                'click',
                withErrorHandling(
                    this.handleSendReattempts.bind(this),
                    'PopupManager.handleSendReattempts'
                )
            );
        }

        // Open settings button
        if (this.elements.openSettingsButton) {
            this.elements.openSettingsButton.addEventListener(
                'click',
                withErrorHandling(
                    this.handleOpenSettings.bind(this),
                    'PopupManager.handleOpenSettings'
                )
            );
        }

        // Message input for character counting
        if (this.elements.messageInput) {
            this.elements.messageInput.addEventListener(
                'input',
                withErrorHandling(
                    this.handleMessageInput.bind(this),
                    'PopupManager.handleMessageInput'
                )
            );
        }

        // Keyboard shortcuts
        document.addEventListener(
            'keydown',
            withErrorHandling(
                this.handleKeyboardShortcuts.bind(this),
                'PopupManager.handleKeyboardShortcuts'
            )
        );
    }

    /**
     * Load initial data
     */
    async loadInitialData() {
        try {
            // Check connection status
            await this.checkConnectionStatus();

            // The DSP manager will load DSPs automatically
            // No additional data loading needed here
        } catch (error) {
            console.warn('Failed to load initial data:', error);
            this.showError('Failed to load extension data');
        }
    }

    /**
     * Set up character counter for message input
     */
    setupCharacterCounter() {
        if (!this.elements.messageInput || !this.elements.charCount) {
            return;
        }

        const updateCounter = () => {
            const currentLength = this.elements.messageInput.value.length;
            const remaining = this.characterLimit - currentLength;

            this.elements.charCount.textContent = `${currentLength}/${this.characterLimit}`;

            // Update styling based on limit
            if (remaining < 0) {
                this.elements.charCount.className = 'char-count over-limit';
            } else if (remaining < 100) {
                this.elements.charCount.className = 'char-count near-limit';
            } else {
                this.elements.charCount.className = 'char-count';
            }
        };

        // Initial update
        updateCounter();

        // Update on input
        this.elements.messageInput.addEventListener('input', updateCounter);
    }

    /**
     * Handle manual check request
     */
    async handleManualCheck() {
        if (this.isLoading) {
            return;
        }

        try {
            this.setLoading(true);
            this.showToast('Running manual check...', 'info');

            const response = await browser.runtime.sendMessage({
                action: MESSAGE_TYPES.MANUAL_CHECK,
            });

            if (response && response.success) {
                const { summary, mismatches } = response;

                if (mismatches && mismatches.length > 0) {
                    this.showToast(`Found ${mismatches.length} mismatches`, 'warning');
                } else {
                    this.showToast('No mismatches found', 'success');
                }

                console.log('Manual check results:', summary);
            } else {
                throw new Error(response?.error || 'Manual check failed');
            }
        } catch (error) {
            ErrorHandler.logError(error, 'PopupManager.handleManualCheck');
            this.showToast('Manual check failed', 'error');
        } finally {
            this.setLoading(false);
        }
    }

    /**
     * Handle send message request
     */
    async handleSendMessage() {
        if (this.isLoading) {
            return;
        }

        try {
            this.setLoading(true);

            // Validate message
            const message = this.elements.messageInput.value;
            const validation = validateMessage(message, this.characterLimit);

            if (!validation.isValid) {
                this.showToast(validation.errors[0], 'error');
                return;
            }

            // Validate DSP selection
            const selectionInfo = this.dspManager.getSelectionInfo();
            if (!selectionInfo.isValid) {
                this.showToast('Please select at least one DSP', 'error');
                return;
            }

            this.showToast(`Sending message to ${selectionInfo.count} DSP(s)...`, 'info');

            // Send message
            const response = await browser.runtime.sendMessage({
                action: MESSAGE_TYPES.SEND_MESSAGE,
                dsp: selectionInfo.dsps,
                message: validation.cleanMessage,
                targetType: selectionInfo.mode,
            });

            if (response && response.success) {
                const { result } = response;

                if (typeof result === 'object' && result.totalSent !== undefined) {
                    // Bulk send result
                    this.showToast(`Message sent to ${result.totalSent} DSPs`, 'success');

                    if (result.totalFailed > 0) {
                        console.warn(`${result.totalFailed} messages failed to send`);
                    }
                } else {
                    // Single send result
                    this.showToast('Message sent successfully', 'success');
                }

                // Clear message input
                this.elements.messageInput.value = '';
                this.setupCharacterCounter(); // Update counter
            } else {
                throw new Error(response?.error || 'Failed to send message');
            }
        } catch (error) {
            ErrorHandler.logError(error, 'PopupManager.handleSendMessage');
            this.showToast('Failed to send message', 'error');
        } finally {
            this.setLoading(false);
        }
    }

    /**
     * Handle send summary request
     */
    async handleSendSummary() {
        if (this.isLoading || this.summarySender.isProcessingSummary()) {
            return;
        }

        try {
            this.setLoading(true);
            this.showToast('Collecting and sending summaries...', 'info');

            const result = await this.summarySender.sendSummary({
                collectPaidTime: true,
                includeUtilization: true,
            });

            if (result.success) {
                const { results } = result;
                this.showToast(`Summaries sent to ${results.successful.length} DSPs`, 'success');

                if (results.totalFailed > 0) {
                    console.warn(`${results.totalFailed} summaries failed to send`);
                }
            } else {
                throw new Error('Summary sending failed');
            }
        } catch (error) {
            ErrorHandler.logError(error, 'PopupManager.handleSendSummary');
            this.showToast('Failed to send summaries', 'error');
        } finally {
            this.setLoading(false);
        }
    }

    /**
     * Handle send reattempts request
     */
    async handleSendReattempts() {
        if (this.isLoading) {
            return;
        }

        try {
            this.setLoading(true);
            this.showToast('Sending failed reattempts report...', 'info');

            const result = await this.summarySender.sendFailedReattemptsReport();

            if (result.success) {
                this.showToast('Reattempts report sent successfully', 'success');
            } else {
                throw new Error('Reattempts report failed');
            }
        } catch (error) {
            ErrorHandler.logError(error, 'PopupManager.handleSendReattempts');
            this.showToast('Failed to send reattempts report', 'error');
        } finally {
            this.setLoading(false);
        }
    }

    /**
     * Handle open settings request
     */
    async handleOpenSettings() {
        try {
            if (browser.runtime.openOptionsPage) {
                await browser.runtime.openOptionsPage();
                return;
            }

            await this.openOptionsFallback();
        } catch (error) {
            try {
                await this.openOptionsFallback();
            } catch (fallbackError) {
                ErrorHandler.logError(fallbackError, 'PopupManager.handleOpenSettings');
                this.showToast('Failed to open settings', 'error');
            }
        }
    }

    async openOptionsFallback() {
        await browser.tabs.create({
            url: browser.runtime.getURL('options/options.html'),
        });
    }

    /**
     * Handle message input changes
     */
    handleMessageInput() {
        // Character counter is updated automatically
        // Could add additional validation here
    }

    /**
     * Handle keyboard shortcuts
     * @param {KeyboardEvent} event - Keyboard event
     */
    handleKeyboardShortcuts(event) {
        // Ctrl/Cmd + Enter to send message
        if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
            event.preventDefault();
            this.handleSendMessage();
            return;
        }

        // Escape to close popup
        if (event.key === 'Escape') {
            window.close();
            return;
        }
    }

    /**
     * Check connection status
     */
    async checkConnectionStatus() {
        try {
            const response = await browser.runtime.sendMessage({
                action: MESSAGE_TYPES.GET_SETTINGS,
            });

            const webhooks = response?.settings?.webhooks || {};
            const hasWebhooks = Object.keys(webhooks).length > 0;
            const isConnected = Boolean(response?.success && hasWebhooks);
            this.updateConnectionStatus(isConnected);

            return isConnected;
        } catch (error) {
            this.updateConnectionStatus(false);
            return false;
        }
    }

    /**
     * Update connection status indicator
     * @param {boolean} connected - Whether connected
     */
    updateConnectionStatus(connected) {
        if (!this.elements.connectionStatus) {
            return;
        }

        this.elements.connectionStatus.className = `connection-status ${
            connected ? 'connected' : 'disconnected'
        }`;
        this.elements.connectionStatus.title = connected
            ? 'Extension ready to send notifications'
            : 'Configure webhooks in options to enable notifications';

        const statusText = this.elements.connectionStatus.querySelector('span');
        if (statusText) {
            statusText.textContent = connected ? 'Ready' : 'Setup Required';
        }
    }

    /**
     * Set loading state
     * @param {boolean} loading - Whether loading
     */
    setLoading(loading) {
        this.isLoading = loading;

        // Disable/enable buttons
        const buttons = [
            this.elements.checkNowButton,
            this.elements.sendMessageButton,
            this.elements.sendSummaryButton,
            this.elements.sendReattemptsButton,
        ].filter(Boolean);

        buttons.forEach(button => {
            button.disabled = loading;
        });

        // Update cursor
        document.body.style.cursor = loading ? 'wait' : '';
    }

    /**
     * Show toast notification
     * @param {string} message - Message to show
     * @param {string} type - Toast type (info, success, warning, error)
     */
    showToast(message, type = 'info') {
        if (!this.elements.toast) {
            console.log(`Toast (${type}): ${message}`);
            return;
        }

        this.elements.toast.textContent = message;
        this.elements.toast.className = `toast ${type} show`;

        // Auto-hide after 3 seconds for success/info, 5 seconds for warning/error
        const duration = type === 'error' || type === 'warning' ? 5000 : 3000;

        setTimeout(() => {
            this.elements.toast.className = 'toast';
        }, duration);
    }

    /**
     * Show error message
     * @param {string} message - Error message
     */
    showError(message) {
        this.showToast(message, 'error');
    }

    /**
     * Get popup statistics
     * @returns {object} Statistics
     */
    getStatistics() {
        return {
            isLoading: this.isLoading,
            dspStats: this.dspManager?.getStatistics(),
            summaryStats: this.summarySender?.getStatistics(),
            messageLength: this.elements.messageInput?.value?.length || 0,
        };
    }
}

/**
 * Message Service - Simple wrapper for browser messaging
 */
class MessageService {
    /**
     * Send message to background script
     * @param {object} message - Message to send
     * @returns {Promise<object>} Response
     */
    async sendMessage(message) {
        try {
            return await browser.runtime.sendMessage(message);
        } catch (error) {
            console.error('Message sending failed:', error);
            throw error;
        }
    }

    /**
     * Send message to content script
     * @param {number} tabId - Tab ID
     * @param {object} message - Message to send
     * @returns {Promise<object>} Response
     */
    async sendToContent(tabId, message) {
        try {
            return await browser.tabs.sendMessage(tabId, message);
        } catch (error) {
            console.error('Content message sending failed:', error);
            throw error;
        }
    }
}

// Initialize popup manager
const popupManager = new PopupManager();

// Make available globally for debugging
window.dspPopupManager = popupManager;

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PopupManager, MessageService };
}
