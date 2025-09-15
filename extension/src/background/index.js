/**
 * Background Script Entry Point
 * Main background script for the DSP Management Extension
 */

import { storageService } from '../shared/storage.js';
import { MESSAGE_TYPES } from '../shared/constants.js';
import { ErrorHandler, withErrorHandling } from '../shared/errors.js';
import { AlarmManager } from './alarm-manager.js';
import { WebhookSender } from './webhook-sender.js';

// Import other modules as they are created
// import { ServiceTypeManager } from './service-type-manager.js';
// import { RiskScanner } from './risk-scanner.js';
// import { ReattemptManager } from './reattempt-manager.js';

class BackgroundService {
    constructor() {
        this.webhookSender = new WebhookSender();

        // Initialize other services
        this.alarmManager = new AlarmManager(
            null, // notificationService - will be implemented
            null // checkService - will be implemented
        );

        this.setupEventListeners();
        this.initialize();
    }

    /**
     * Initialize the background service
     */
    async initialize() {
        try {
            console.log('🚀 Initializing DSP Management Extension...');

            // Initialize storage with defaults
            await storageService.initialize();

            // Set up alarms for enabled service types
            await this.alarmManager.createServiceTypeAlarms();

            console.log('✅ Background service initialized successfully');
        } catch (error) {
            ErrorHandler.logError(error, 'BackgroundService.initialize');
        }
    }

    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // Extension lifecycle
        browser.runtime.onInstalled.addListener(
            withErrorHandling(this.handleInstalled.bind(this), 'BackgroundService.handleInstalled')
        );

        browser.runtime.onStartup.addListener(
            withErrorHandling(this.handleStartup.bind(this), 'BackgroundService.handleStartup')
        );

        // Message handling
        browser.runtime.onMessage.addListener(
            withErrorHandling(this.handleMessage.bind(this), 'BackgroundService.handleMessage')
        );

        // Storage changes
        browser.storage.onChanged.addListener(
            withErrorHandling(
                this.handleStorageChange.bind(this),
                'BackgroundService.handleStorageChange'
            )
        );
    }

    /**
     * Handle extension installation/update
     */
    async handleInstalled(details) {
        console.log('📦 Extension installed/updated:', details.reason);

        if (details.reason === 'install') {
            // First-time installation
            await this.handleFirstInstall();
        } else if (details.reason === 'update') {
            // Extension update
            await this.handleUpdate(details.previousVersion);
        }
    }

    /**
     * Handle extension startup
     */
    async handleStartup() {
        console.log('🔄 Extension startup');
        await this.initialize();
    }

    /**
     * Handle first-time installation
     */
    async handleFirstInstall() {
        console.log('🎉 First-time installation detected');

        // Show welcome notification
        try {
            await browser.notifications.create({
                type: 'basic',
                iconUrl: 'icons/icon.svg',
                title: 'DSP Management Extension',
                message:
                    'Extension installed successfully! Click the extension icon to get started.',
            });
        } catch (error) {
            console.warn('Could not show welcome notification:', error);
        }

        // Open options page
        try {
            await browser.runtime.openOptionsPage();
        } catch (error) {
            console.warn('Could not open options page:', error);
        }
    }

    /**
     * Handle extension update
     */
    async handleUpdate(previousVersion) {
        console.log(
            `📈 Extension updated from ${previousVersion} to ${
                browser.runtime.getManifest().version
            }`
        );

        // Perform any necessary migration or cleanup
        await this.performMigration(previousVersion);

        // Recreate alarms (in case alarm logic changed)
        await this.alarmManager.createServiceTypeAlarms();
    }

    /**
     * Handle messages from other parts of the extension
     */
    async handleMessage(message, sender, _sendResponse) {
        console.log(
            '📨 Received message:',
            message.action,
            'from:',
            sender.tab?.url || 'extension'
        );

        try {
            switch (message.action) {
                case MESSAGE_TYPES.MANUAL_CHECK:
                    return await this.handleManualCheck(message);

                case MESSAGE_TYPES.SEND_MESSAGE:
                    return await this.handleSendMessage(message);

                case MESSAGE_TYPES.UPDATE_NOTIFICATION_SETTINGS:
                    return await this.handleUpdateNotificationSettings(message);

                case MESSAGE_TYPES.GET_SETTINGS:
                    return await this.handleGetSettings(message);

                case MESSAGE_TYPES.SAVE_SETTINGS:
                    return await this.handleSaveSettings(message);

                case MESSAGE_TYPES.SEND_SUMMARY:
                    return await this.handleSendSummary(message);

                case MESSAGE_TYPES.TEST_WEBHOOK:
                    return await this.handleTestWebhook(message);

                default:
                    console.warn('Unknown message action:', message.action);
                    return { success: false, error: 'Unknown action' };
            }
        } catch (error) {
            ErrorHandler.logError(error, `BackgroundService.handleMessage.${message.action}`);
            return { success: false, error: error.message };
        }
    }

    /**
     * Handle storage changes
     */
    async handleStorageChange(changes, areaName) {
        if (areaName !== 'local') {
            return;
        }

        console.log('💾 Storage changed:', Object.keys(changes));

        // React to service type changes
        if (changes.serviceTypes) {
            console.log('🔄 Service types changed, updating alarms...');
            await this.alarmManager.updateAlarmsForServiceTypes(changes.serviceTypes.newValue);
        }

        // React to notification setting changes
        if (changes.notificationsEnabled) {
            console.log('🔔 Notification settings changed:', changes.notificationsEnabled.newValue);
        }
    }

    /**
     * Handle manual check request
     */
    handleManualCheck(_message) {
        console.log('🔍 Manual check requested');

        // This will be implemented when we create the check service
        // return await this.checkService.performManualCheck();

        // Temporary response
        return { success: true, message: 'Manual check completed (placeholder)' };
    }

    /**
     * Handle send message request
     */
    async handleSendMessage(message) {
        const { dsp, message: messageText, targetType = 'individual' } = message;

        console.log(`📤 Sending message to ${targetType}:`, dsp);

        try {
            let result;

            switch (targetType) {
                case 'individual':
                    result = await this.webhookSender.sendToDSP(dsp, messageText);
                    break;

                case 'multiple':
                    result = await this.webhookSender.sendToMultipleDSPs(dsp, messageText);
                    break;

                case 'all':
                    result = await this.webhookSender.sendToAllDSPs(messageText);
                    break;

                default:
                    throw new Error(`Unknown target type: ${targetType}`);
            }

            return { success: true, result };
        } catch (error) {
            ErrorHandler.logError(error, 'BackgroundService.handleSendMessage');
            return { success: false, error: error.message };
        }
    }

    /**
     * Handle notification settings update
     */
    async handleUpdateNotificationSettings(message) {
        const { enabled } = message;

        await storageService.setNotificationsEnabled(enabled);

        console.log(`🔔 Notifications ${enabled ? 'enabled' : 'disabled'}`);

        return { success: true };
    }

    /**
     * Handle get settings request
     */
    async handleGetSettings(_message) {
        try {
            const settings = {
                webhooks: await storageService.getWebhooks(),
                notificationsEnabled: await storageService.getNotificationsEnabled(),
                serviceTypes: await storageService.getServiceTypes(),
                schedulingBaseUrl: await storageService.getSchedulingBaseUrl(),
                serviceAreaId: await storageService.getServiceAreaId(),
            };

            return { success: true, settings };
        } catch (error) {
            ErrorHandler.logError(error, 'BackgroundService.handleGetSettings');
            return { success: false, error: error.message };
        }
    }

    /**
     * Handle save settings request
     */
    async handleSaveSettings(message) {
        const { settings } = message;

        try {
            const updates = {};

            if (settings.webhooks !== undefined) {
                updates.webhooks = settings.webhooks;
            }

            if (settings.notificationsEnabled !== undefined) {
                updates.notificationsEnabled = settings.notificationsEnabled;
            }

            if (settings.serviceTypes !== undefined) {
                updates.serviceTypes = settings.serviceTypes;
            }

            if (settings.schedulingBaseUrl !== undefined) {
                updates.schedulingBaseUrl = settings.schedulingBaseUrl;
            }

            if (settings.serviceAreaId !== undefined) {
                updates.serviceAreaId = settings.serviceAreaId;
            }

            await storageService.setMultiple(updates);

            console.log('💾 Settings saved successfully');
            return { success: true };
        } catch (error) {
            ErrorHandler.logError(error, 'BackgroundService.handleSaveSettings');
            return { success: false, error: error.message };
        }
    }

    /**
     * Handle send summary request
     */
    handleSendSummary(_message) {
        // This will be implemented when we create the summary service
        console.log('📊 Summary send requested');
        return { success: true, message: 'Summary sent (placeholder)' };
    }

    async handleTestWebhook(message) {
        const { dspCode, webhookUrl } = message;

        if (!webhookUrl) {
            return { success: false, error: 'Webhook URL is required' };
        }

        try {
            await this.webhookSender.sendWebhook(
                webhookUrl,
                '🧪 Test message from DSP Management Extension\n\nThis is a verification ping to confirm your webhook is reachable.',
                {
                    title: 'Webhook Test',
                    dspCode,
                    urgent: false,
                }
            );

            return { success: true };
        } catch (error) {
            ErrorHandler.logError(error, 'BackgroundService.handleTestWebhook');
            return { success: false, error: error.message };
        }
    }

    /**
     * Perform migration between versions
     */
    performMigration(previousVersion) {
        console.log(`🔄 Performing migration from version ${previousVersion}`);

        // Add migration logic here as needed
        // For example:
        // if (previousVersion < '1.5.0') {
        //     await this.migrateToV15();
        // }
    }
}

// Initialize the background service
new BackgroundService();

// Export for testing purposes
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { BackgroundService };
}
