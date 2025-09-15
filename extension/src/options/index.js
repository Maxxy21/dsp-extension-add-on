/**
 * Options Page Main Entry Point
 * Initializes and coordinates all options page functionality
 */

import { FileUploadManager } from './file-upload-manager.js';
import { SettingsManager } from './settings-manager.js';
import { WebhookManager } from './webhook-manager.js';
import { withErrorHandling, ErrorHandler } from '../shared/errors.js';

class OptionsManager {
    constructor() {
        this.fileUploadManager = null;
        this.settingsManager = null;
        this.webhookManager = null;
        this.isLoading = false;
        this.elements = {};

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
     * Initialize the options page
     */
    async initialize() {
        try {
            console.log('⚙️ Initializing DSP Management options...');

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

            // Set up global event listeners
            this.setupGlobalEventListeners();

            // Load initial data
            await this.loadInitialData();

            console.log('✅ Options page initialized successfully');
        } catch (error) {
            ErrorHandler.logError(error, 'OptionsManager.initialize');
            this.showError('Failed to initialize options page');
        }
    }

    /**
     * Cache DOM elements
     */
    cacheElements() {
        this.elements = {
            // File upload elements
            manifestFileInput: document.getElementById('manifestFileInput'),
            backbriefFileInput: document.getElementById('backbriefFileInput'),
            batchFileInput: document.getElementById('batchFileInput'),
            uploadManifestBtn: document.getElementById('uploadManifestBtn'),
            uploadBackbriefBtn: document.getElementById('uploadBackbriefBtn'),
            uploadBatchBtn: document.getElementById('uploadBatchBtn'),
            clearManifestBtn: document.getElementById('clearManifestBtn'),
            clearBackbriefBtn: document.getElementById('clearBackbriefBtn'),
            clearBatchBtn: document.getElementById('clearBatchBtn'),
            manifestStatus: document.getElementById('manifestStatus'),
            backbriefStatus: document.getElementById('backbriefStatus'),
            batchStatus: document.getElementById('batchStatus'),
            manifestInfo: document.getElementById('manifestInfo'),
            backbriefInfo: document.getElementById('backbriefInfo'),
            batchInfo: document.getElementById('batchInfo'),

            // Settings elements
            enableNotifications: document.getElementById('enableNotifications'),
            paidTimeMinutes: document.getElementById('paidTimeMinutes'),
            serviceAreaId: document.getElementById('serviceAreaId'),
            schedulingBaseUrl: document.getElementById('schedulingBaseUrl'),
            routePlanningBaseUrl: document.getElementById('routePlanningBaseUrl'),
            riskDashboardUrl: document.getElementById('riskDashboardUrl'),
            formatManualMessagesForChime: document.getElementById('formatManualMessagesForChime'),
            riskAlertsEnabled: document.getElementById('riskAlertsEnabled'),

            // Webhook elements
            chimeUrl: document.getElementById('chimeUrl'),
            slackUrl: document.getElementById('slackUrl'),
            discordUrl: document.getElementById('discordUrl'),
            slackWebhookUrl: document.getElementById('slackWebhookUrl'),
            slackUseChimeMarkdown: document.getElementById('slackUseChimeMarkdown'),

            // Action buttons
            testChimeBtn: document.getElementById('testChimeBtn'),
            testSlackBtn: document.getElementById('testSlackBtn'),
            testDiscordBtn: document.getElementById('testDiscordBtn'),
            clearWebhooksBtn: document.getElementById('clearWebhooksBtn'),
            resetSettingsBtn: document.getElementById('resetSettingsBtn'),
            exportSettingsBtn: document.getElementById('exportSettingsBtn'),
            importSettingsBtn: document.getElementById('importSettingsBtn'),

            // Status elements
            toast: document.getElementById('toast'),
            loadingIndicator: document.getElementById('loadingIndicator'),
        };
    }

    /**
     * Initialize manager modules
     */
    initializeManagers() {
        // File Upload Manager
        this.fileUploadManager = new FileUploadManager();
        this.fileUploadManager.initialize({
            manifestFileInput: this.elements.manifestFileInput,
            backbriefFileInput: this.elements.backbriefFileInput,
            batchFileInput: this.elements.batchFileInput,
            uploadManifestBtn: this.elements.uploadManifestBtn,
            uploadBackbriefBtn: this.elements.uploadBackbriefBtn,
            uploadBatchBtn: this.elements.uploadBatchBtn,
            clearManifestBtn: this.elements.clearManifestBtn,
            clearBackbriefBtn: this.elements.clearBackbriefBtn,
            clearBatchBtn: this.elements.clearBatchBtn,
            manifestStatus: this.elements.manifestStatus,
            backbriefStatus: this.elements.backbriefStatus,
            batchStatus: this.elements.batchStatus,
            manifestInfo: this.elements.manifestInfo,
            backbriefInfo: this.elements.backbriefInfo,
            batchInfo: this.elements.batchInfo,
        });

        // Settings Manager
        this.settingsManager = new SettingsManager();
        this.settingsManager.initialize({
            enableNotifications: this.elements.enableNotifications,
            paidTimeMinutes: this.elements.paidTimeMinutes,
            serviceAreaId: this.elements.serviceAreaId,
            schedulingBaseUrl: this.elements.schedulingBaseUrl,
            routePlanningBaseUrl: this.elements.routePlanningBaseUrl,
            riskDashboardUrl: this.elements.riskDashboardUrl,
            formatManualMessagesForChime: this.elements.formatManualMessagesForChime,
            riskAlertsEnabled: this.elements.riskAlertsEnabled,
            slackWebhookUrl: this.elements.slackWebhookUrl,
            slackUseChimeMarkdown: this.elements.slackUseChimeMarkdown,
        });

        // Webhook Manager
        this.webhookManager = new WebhookManager();
        this.webhookManager.initialize({
            chimeUrl: this.elements.chimeUrl,
            slackUrl: this.elements.slackUrl,
            discordUrl: this.elements.discordUrl,
            testChimeBtn: this.elements.testChimeBtn,
            testSlackBtn: this.elements.testSlackBtn,
            testDiscordBtn: this.elements.testDiscordBtn,
            clearWebhooksBtn: this.elements.clearWebhooksBtn,
        });
    }

    /**
     * Set up global event listeners
     */
    setupGlobalEventListeners() {
        // Reset settings button
        if (this.elements.resetSettingsBtn) {
            this.elements.resetSettingsBtn.addEventListener(
                'click',
                withErrorHandling(
                    this.handleResetSettings.bind(this),
                    'OptionsManager.handleResetSettings'
                )
            );
        }

        // Export settings button
        if (this.elements.exportSettingsBtn) {
            this.elements.exportSettingsBtn.addEventListener(
                'click',
                withErrorHandling(
                    this.handleExportSettings.bind(this),
                    'OptionsManager.handleExportSettings'
                )
            );
        }

        // Import settings button
        if (this.elements.importSettingsBtn) {
            this.elements.importSettingsBtn.addEventListener(
                'click',
                withErrorHandling(
                    this.handleImportSettings.bind(this),
                    'OptionsManager.handleImportSettings'
                )
            );
        }

        // Tab navigation
        this.setupTabNavigation();

        // Keyboard shortcuts
        document.addEventListener(
            'keydown',
            withErrorHandling(
                this.handleKeyboardShortcuts.bind(this),
                'OptionsManager.handleKeyboardShortcuts'
            )
        );
    }

    /**
     * Set up tab navigation
     */
    setupTabNavigation() {
        const tabButtons = document.querySelectorAll('.tab-button');
        const tabContents = document.querySelectorAll('.tab-content');

        tabButtons.forEach(button => {
            button.addEventListener('click', event => {
                const targetTab = event.target.getAttribute('data-tab');

                // Update active tab button
                tabButtons.forEach(btn => btn.classList.remove('active'));
                event.target.classList.add('active');

                // Update visible tab content
                tabContents.forEach(content => {
                    if (content.id === targetTab) {
                        content.classList.add('active');
                    } else {
                        content.classList.remove('active');
                    }
                });

                // Store active tab
                localStorage.setItem('dsp-options-active-tab', targetTab);
            });
        });

        // Restore active tab
        const savedTab = localStorage.getItem('dsp-options-active-tab');
        if (savedTab) {
            const tabButton = document.querySelector(`[data-tab="${savedTab}"]`);
            if (tabButton) {
                tabButton.click();
            }
        }
    }

    /**
     * Load initial data
     */
    async loadInitialData() {
        try {
            this.setLoading(true);

            // All managers will load their own data during initialization
            // This method can be used for any global initialization
            await this.updatePageTitle();
        } catch (error) {
            console.warn('Failed to load initial data:', error);
            this.showError('Failed to load some page data');
        } finally {
            this.setLoading(false);
        }
    }

    /**
     * Update page title with version
     */
    updatePageTitle() {
        try {
            const manifest = browser.runtime.getManifest();
            const titleElement = document.querySelector('h1');
            if (titleElement && manifest.version) {
                titleElement.textContent = `DSP Management Extension - Options (v${manifest.version})`;
            }
        } catch (error) {
            console.warn('Failed to update page title:', error);
        }
    }

    /**
     * Handle reset settings request
     */
    async handleResetSettings() {
        const confirmed = confirm(
            'Are you sure you want to reset ALL settings to defaults? This will affect:\n\n• File uploads (cleared)\n• General settings (reset)\n• Webhooks (cleared)\n\nThis action cannot be undone.'
        );

        if (!confirmed) {
            return;
        }

        try {
            this.setLoading(true);
            this.showToast('Resetting all settings...', 'info');

            // Reset all managers
            await Promise.all([
                this.settingsManager.resetSettings(),
                this.webhookManager.clearAllWebhooks(),
                this.clearAllFileData(),
            ]);

            this.showToast('All settings reset successfully', 'success');
        } catch (error) {
            ErrorHandler.logError(error, 'OptionsManager.handleResetSettings');
            this.showToast('Failed to reset settings', 'error');
        } finally {
            this.setLoading(false);
        }
    }

    /**
     * Handle export settings request
     */
    async handleExportSettings() {
        try {
            this.setLoading(true);
            await this.settingsManager.exportSettings();
        } catch (error) {
            ErrorHandler.logError(error, 'OptionsManager.handleExportSettings');
            this.showToast('Failed to export settings', 'error');
        } finally {
            this.setLoading(false);
        }
    }

    /**
     * Handle import settings request
     */
    async handleImportSettings() {
        try {
            this.setLoading(true);
            await this.settingsManager.importSettings();
        } catch (error) {
            ErrorHandler.logError(error, 'OptionsManager.handleImportSettings');
            this.showToast('Failed to import settings', 'error');
        } finally {
            this.setLoading(false);
        }
    }

    /**
     * Clear all file upload data
     */
    async clearAllFileData() {
        try {
            const keys = ['manifestData', 'backbriefData', 'batchData'];
            await browser.storage.local.remove(keys);

            // Update UI for all upload types
            ['manifest', 'backbrief', 'batch'].forEach(type => {
                const statusElement = document.getElementById(`${type}Status`);
                const infoElement = document.getElementById(`${type}Info`);

                if (statusElement) {
                    statusElement.textContent = 'No file uploaded';
                    statusElement.className = 'upload-status info';
                }

                if (infoElement) {
                    infoElement.textContent = '';
                }
            });
        } catch (error) {
            console.error('Failed to clear file data:', error);
            throw error;
        }
    }

    /**
     * Handle keyboard shortcuts
     * @param {KeyboardEvent} event - Keyboard event
     */
    handleKeyboardShortcuts(event) {
        // Ctrl/Cmd + S to save (export settings)
        if ((event.ctrlKey || event.metaKey) && event.key === 's') {
            event.preventDefault();
            this.handleExportSettings();
            return;
        }

        // Ctrl/Cmd + O to open (import settings)
        if ((event.ctrlKey || event.metaKey) && event.key === 'o') {
            event.preventDefault();
            this.handleImportSettings();
            return;
        }

        // Ctrl/Cmd + R to reset (with confirmation)
        if ((event.ctrlKey || event.metaKey) && event.key === 'r' && event.shiftKey) {
            event.preventDefault();
            this.handleResetSettings();
            return;
        }
    }

    /**
     * Set loading state
     * @param {boolean} loading - Whether loading
     */
    setLoading(loading) {
        this.isLoading = loading;

        // Update loading indicator
        if (this.elements.loadingIndicator) {
            this.elements.loadingIndicator.style.display = loading ? 'block' : 'none';
        }

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

        // Auto-hide after duration
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
     * Get options page statistics
     * @returns {object} Statistics
     */
    getStatistics() {
        return {
            isLoading: this.isLoading,
            fileUploadStats: this.fileUploadManager?.getStatistics(),
            webhookStats: this.webhookManager?.getStatistics(),
            activeTab: localStorage.getItem('dsp-options-active-tab') || 'settings',
        };
    }
}

// Initialize options manager
const optionsManager = new OptionsManager();

// Make available globally for debugging
window.dspOptionsManager = optionsManager;

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { OptionsManager };
}
