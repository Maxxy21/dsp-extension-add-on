/**
 * Settings Manager - Handles general settings in options page
 */

import { storageService } from '../shared/storage.js';
import { SERVICE_TYPE_CONFIG } from '../shared/constants.js';
import { withErrorHandling } from '../shared/errors.js';

const GENERAL_SETTINGS_CONFIG = {
    paidTimeMinutes: {
        elementKey: 'paidTimeMinutes',
        type: 'number',
        defaultValue: 525,
        label: 'Paid Time',
    },
    serviceAreaId: {
        elementKey: 'serviceAreaId',
        type: 'text',
        defaultValue: '',
        label: 'Service Area ID',
    },
    schedulingBaseUrl: {
        elementKey: 'schedulingUrl',
        type: 'text',
        defaultValue: '',
        label: 'Scheduling Base URL',
    },
    routePlanningBaseUrl: {
        elementKey: 'routePlanningUrl',
        type: 'text',
        defaultValue: '',
        label: 'Route Planning Base URL',
    },
    riskDashboardUrl: {
        elementKey: 'riskDashboardUrl',
        type: 'text',
        defaultValue: '',
        label: 'Risk Dashboard URL',
    },
    slackWebhookUrl: {
        elementKey: 'slackWebhookUrl',
        type: 'text',
        defaultValue: '',
        label: 'Slack Webhook URL',
    },
    formatManualMessagesForChime: {
        elementKey: 'formatChimeManual',
        type: 'boolean',
        defaultValue: true,
        label: 'Format Messages for Chime',
    },
    riskAlertsEnabled: {
        elementKey: 'enableRiskAlerts',
        type: 'boolean',
        defaultValue: false,
        label: 'Risk Alerts',
    },
    slackUseChimeMarkdown: {
        elementKey: 'slackUseChimeMarkdown',
        type: 'boolean',
        defaultValue: false,
        label: 'Use Chime Markdown in Slack',
    },
    inferPaidTime: {
        elementKey: 'inferPaidTime',
        type: 'boolean',
        defaultValue: false,
        label: 'Infer Paid Time from Constraints',
    },
};

export class SettingsManager {
    constructor() {
        this.settings = {};
        this.elements = {};
    }

    /**
     * Initialize settings manager
     * @param {object} elements - DOM elements
     */
    initialize(elements) {
        this.elements = elements;
        this.setupEventListeners();
        this.loadSettings();
    }

    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // Notification toggle
        if (this.elements.enableNotifications) {
            this.elements.enableNotifications.addEventListener(
                'change',
                withErrorHandling(
                    this.handleNotificationToggle.bind(this),
                    'SettingsManager.handleNotificationToggle'
                )
            );
        }

        // Service type checkboxes
        Object.keys(SERVICE_TYPE_CONFIG).forEach(serviceType => {
            const checkbox = document.getElementById(`serviceType_${serviceType}`);
            if (checkbox) {
                checkbox.addEventListener(
                    'change',
                    withErrorHandling(
                        () => this.handleServiceTypeToggle(serviceType),
                        'SettingsManager.handleServiceTypeToggle'
                    )
                );
            }
        });

        // General settings inputs
        Object.entries(GENERAL_SETTINGS_CONFIG).forEach(([settingName, config]) => {
            const element = this.getElement(config.elementKey);
            if (!element) {
                return;
            }

            element.addEventListener(
                'change',
                withErrorHandling(
                    event => this.handleConfiguredSettingChange(settingName, config, event),
                    `SettingsManager.handleSettingChange.${settingName}`
                )
            );
        });
    }

    /**
     * Resolve element reference from cached elements or DOM
     * @param {string} key - Element key/id
     * @returns {HTMLElement|null} DOM element
     */
    getElement(key) {
        return this.elements?.[key] || document.getElementById(key);
    }

    /**
     * Load settings from storage
     */
    async loadSettings() {
        try {
            console.log('⚙️ Loading settings...');

            // Load all settings
            const [notifications, serviceTypes] = await Promise.all([
                storageService.getNotificationsEnabled(),
                storageService.getServiceTypes(),
            ]);

            const generalSettings = await this.loadStoredSettings();

            // Update notification toggle
            if (this.elements.enableNotifications) {
                this.elements.enableNotifications.checked = notifications;
            }

            // Update service type checkboxes
            Object.entries(serviceTypes).forEach(([serviceType, enabled]) => {
                const checkbox = document.getElementById(`serviceType_${serviceType}`);
                if (checkbox) {
                    checkbox.checked = enabled;
                }
            });

            // Update general settings
            this.updateGeneralSettingsUI(generalSettings);

            console.log('✅ Settings loaded successfully');
        } catch (error) {
            console.error('Failed to load settings:', error);
            this.showError('Failed to load settings');
        }
    }

    /**
     * Load general settings from storage
     * @returns {Promise<object>} General settings
     */
    async loadStoredSettings() {
        try {
            const result = await browser.storage.local.get(['settings']);
            this.settings = result.settings || {};
            return this.settings;
        } catch (error) {
            console.warn('Failed to load general settings:', error);
            this.settings = {};
            return this.settings;
        }
    }

    /**
     * Update general settings UI
     * @param {object} settings - Settings object
     */
    updateGeneralSettingsUI(settings) {
        Object.entries(GENERAL_SETTINGS_CONFIG).forEach(([settingName, config]) => {
            const element = this.getElement(config.elementKey);
            if (!element) {
                return;
            }

            const storedValue = settings[settingName];
            const resolvedValue = storedValue !== undefined ? storedValue : config.defaultValue;

            if (config.type === 'boolean') {
                element.checked = Boolean(resolvedValue);
            } else {
                element.value = resolvedValue ?? '';
            }
        });
    }

    /**
     * Handle notification toggle
     * @param {Event} event - Change event
     */
    async handleNotificationToggle(event) {
        try {
            const enabled = event.target.checked;
            await storageService.setNotificationsEnabled(enabled);

            // Update background script
            await browser.runtime.sendMessage({
                action: 'updateNotificationSettings',
                enabled,
            });

            this.showSuccess(`Notifications ${enabled ? 'enabled' : 'disabled'}`);
        } catch (error) {
            console.error('Failed to update notifications:', error);
            this.showError('Failed to update notification settings');

            // Revert checkbox state
            event.target.checked = !event.target.checked;
        }
    }

    /**
     * Handle service type toggle
     * @param {string} serviceType - Service type
     */
    async handleServiceTypeToggle(serviceType) {
        try {
            const checkbox = document.getElementById(`serviceType_${serviceType}`);
            if (!checkbox) {
                return;
            }

            const currentServiceTypes = await storageService.getServiceTypes();
            currentServiceTypes[serviceType] = checkbox.checked;

            await storageService.setServiceTypes(currentServiceTypes);

            this.showSuccess(
                `${SERVICE_TYPE_CONFIG[serviceType]?.displayName || serviceType} ${
                    checkbox.checked ? 'enabled' : 'disabled'
                }`
            );
        } catch (error) {
            console.error('Failed to update service type:', error);
            this.showError('Failed to update service type settings');
        }
    }

    /**
     * Handle general setting change
     * @param {string} settingName - Setting name
     */
    async handleConfiguredSettingChange(settingName, config, event) {
        try {
            const rawValue =
                config.type === 'boolean'
                    ? event.target.checked
                    : (event.target.value ?? '').trim();

            const value = this.parseSettingValue(settingName, config, rawValue);
            await this.saveGeneralSetting(settingName, value);

            const label = this.getSettingLabel(settingName);
            const message =
                config.type === 'boolean'
                    ? `${label} ${value ? 'enabled' : 'disabled'}`
                    : `${label} updated`;

            this.showSuccess(message);
        } catch (error) {
            console.error(`Failed to update ${settingName}:`, error);
            this.showError(`Failed to update ${this.getSettingLabel(settingName)}`);
            this.resetSettingField(settingName, config);
        }
    }

    parseSettingValue(settingName, config, rawValue) {
        if (config.type === 'number') {
            const parsedValue = parseInt(rawValue, 10);
            if (Number.isNaN(parsedValue) || parsedValue < 0) {
                throw new Error('Paid time must be a positive number');
            }
            return parsedValue;
        }

        if (config.type === 'boolean') {
            return Boolean(rawValue);
        }

        return typeof rawValue === 'string' ? rawValue.trim() : rawValue;
    }

    async saveGeneralSetting(settingName, value) {
        if (!this.settings) {
            await this.loadStoredSettings();
        }

        this.settings = {
            ...this.settings,
            [settingName]: value,
        };

        await browser.storage.local.set({ settings: this.settings });
    }

    getSettingLabel(settingName) {
        return GENERAL_SETTINGS_CONFIG[settingName]?.label || settingName;
    }

    resetSettingField(settingName, config) {
        const element = this.getElement(config.elementKey);
        if (!element) {
            return;
        }

        const value = this.getSettingValue(settingName);

        if (config.type === 'boolean') {
            element.checked = Boolean(value);
        } else {
            element.value = value ?? '';
        }
    }

    getSettingValue(settingName) {
        if (this.settings && this.settings[settingName] !== undefined) {
            return this.settings[settingName];
        }

        return GENERAL_SETTINGS_CONFIG[settingName]?.defaultValue;
    }

    async getSettingsSnapshot() {
        if (!this.settings) {
            await this.loadStoredSettings();
        }

        return { ...this.settings };
    }

    /**
     * Reset all settings to defaults
     */
    async resetSettings() {
        try {
            const confirmed = confirm(
                'Are you sure you want to reset all settings to defaults? This cannot be undone.'
            );
            if (!confirmed) {
                return;
            }

            // Reset to defaults
            await storageService.setNotificationsEnabled(true);
            await storageService.setServiceTypes({
                cycle1: true,
                samedayB: false,
                samedayC: false,
            });

            await browser.storage.local.set({
                settings: {
                    paidTimeMinutes: 525,
                    formatManualMessagesForChime: true,
                    riskAlertsEnabled: false,
                    slackUseChimeMarkdown: false,
                    inferPaidTime: false,
                    serviceAreaId: '',
                    schedulingBaseUrl: '',
                    routePlanningBaseUrl: '',
                    riskDashboardUrl: '',
                    slackWebhookUrl: '',
                },
            });

            // Reload UI
            await this.loadSettings();

            this.showSuccess('Settings reset to defaults');
        } catch (error) {
            console.error('Failed to reset settings:', error);
            this.showError('Failed to reset settings');
        }
    }

    /**
     * Export settings to JSON
     */
    async exportSettings() {
        try {
            const [notifications, serviceTypes, generalSettings] = await Promise.all([
                storageService.getNotificationsEnabled(),
                storageService.getServiceTypes(),
                this.getSettingsSnapshot(),
            ]);

            const exportData = {
                notificationsEnabled: notifications,
                serviceTypes,
                settings: generalSettings,
                exportDate: new Date().toISOString(),
                version: browser.runtime.getManifest().version,
            };

            const blob = new Blob([JSON.stringify(exportData, null, 2)], {
                type: 'application/json',
            });
            const url = URL.createObjectURL(blob);

            const link = document.createElement('a');
            link.href = url;
            link.download = `dsp-extension-settings-${new Date().toISOString().slice(0, 10)}.json`;
            link.click();

            URL.revokeObjectURL(url);

            this.showSuccess('Settings exported successfully');
        } catch (error) {
            console.error('Failed to export settings:', error);
            this.showError('Failed to export settings');
        }
    }

    /**
     * Import settings from JSON
     */
    importSettings() {
        try {
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = '.json';

            fileInput.onchange = async event => {
                const file = event.target.files[0];
                if (!file) {
                    return;
                }

                try {
                    const text = await this.readFileAsText(file);
                    const importData = JSON.parse(text);

                    // Validate import data
                    if (!this.validateImportData(importData)) {
                        throw new Error('Invalid settings file format');
                    }

                    // Import settings
                    if (importData.notificationsEnabled !== undefined) {
                        await storageService.setNotificationsEnabled(
                            importData.notificationsEnabled
                        );
                    }

                    if (importData.serviceTypes) {
                        await storageService.setServiceTypes(importData.serviceTypes);
                    }

                    if (importData.settings) {
                        await browser.storage.local.set({ settings: importData.settings });
                    }

                    // Reload UI
                    await this.loadSettings();

                    this.showSuccess('Settings imported successfully');
                } catch (error) {
                    console.error('Import failed:', error);
                    this.showError('Failed to import settings');
                }
            };

            fileInput.click();
        } catch (error) {
            console.error('Import setup failed:', error);
            this.showError('Failed to set up import');
        }
    }

    /**
     * Validate import data structure
     * @param {object} data - Import data
     * @returns {boolean} Whether data is valid
     */
    validateImportData(data) {
        if (!data || typeof data !== 'object') {
            return false;
        }

        // Check for expected properties
        const hasValidStructure =
            (data.notificationsEnabled === undefined ||
                typeof data.notificationsEnabled === 'boolean') &&
            (data.serviceTypes === undefined || typeof data.serviceTypes === 'object') &&
            (data.settings === undefined || typeof data.settings === 'object');

        return hasValidStructure;
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
     * Show toast notification
     * @param {string} message - Message to show
     * @param {string} type - Toast type
     */
    showToast(message, type = 'info') {
        console.log(`Settings Manager Toast (${type}): ${message}`);

        const toast = document.getElementById('status');
        if (toast) {
            toast.textContent = message;
            toast.className = `toast ${type} show`;
            setTimeout(() => {
                toast.className = 'toast';
            }, 3000);
        }
    }
}
