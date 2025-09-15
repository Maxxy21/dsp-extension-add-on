/**
 * Alarm Manager - Handles scheduling and triggering of automatic DSP checks
 */

import { SERVICE_TYPE_CONFIG, TIMING } from '../shared/constants.js';
import { storageService } from '../shared/storage.js';
import { AlarmError, withErrorHandling } from '../shared/errors.js';

export class AlarmManager {
    constructor(notificationService, checkService) {
        this.notificationService = notificationService;
        this.checkService = checkService;
        this.setupEventListeners();
    }

    /**
     * Set up event listeners for alarms
     */
    setupEventListeners() {
        browser.alarms.onAlarm.addListener(
            withErrorHandling(this.handleAlarm.bind(this), 'AlarmManager.handleAlarm')
        );
    }

    /**
     * Create alarms for all enabled service types
     * @returns {Promise<void>}
     */
    async createServiceTypeAlarms() {
        try {
            await this.clearAllAlarms();
            const enabledTypes = await storageService.getServiceTypes();

            for (const [serviceType, enabled] of Object.entries(enabledTypes)) {
                if (enabled) {
                    await this.createAlarmsForServiceType(serviceType);
                }
            }

            console.log('✅ Service type alarms created successfully');
        } catch (error) {
            throw AlarmError.fromAlarmCreation('service_type_alarms', error);
        }
    }

    /**
     * Create alarms for a specific service type
     * @param {string} serviceType - Service type to create alarms for
     * @returns {Promise<void>}
     */
    async createAlarmsForServiceType(serviceType) {
        const config = SERVICE_TYPE_CONFIG[serviceType];
        if (!config) {
            console.warn(`No configuration found for service type: ${serviceType}`);
            return;
        }

        for (const alarm of config.alarms) {
            await this.createAlarm(alarm.name, alarm.hour, alarm.minute);
        }

        console.log(`📅 Created ${config.alarms.length} alarms for ${serviceType}`);
    }

    /**
     * Create a single alarm
     * @param {string} name - Alarm name
     * @param {number} hour - Hour (0-23)
     * @param {number} minute - Minute (0-59)
     * @returns {Promise<void>}
     */
    async createAlarm(name, hour, minute) {
        try {
            const alarmTime = this.calculateNextAlarmTime(hour, minute);

            await browser.alarms.create(name, {
                when: alarmTime,
                periodInMinutes: TIMING.MINUTES_PER_DAY,
            });

            console.log(
                `⏰ Created alarm "${name}" for ${hour.toString().padStart(2, '0')}:${minute
                    .toString()
                    .padStart(2, '0')}`
            );
        } catch (error) {
            throw AlarmError.fromAlarmCreation(name, error);
        }
    }

    /**
     * Calculate the next occurrence of a given time
     * @param {number} hour - Target hour
     * @param {number} minute - Target minute
     * @returns {number} Timestamp for next occurrence
     */
    calculateNextAlarmTime(hour, minute) {
        const now = new Date();
        const target = new Date();

        target.setHours(hour, minute, 0, 0);

        // If target time has passed today, schedule for tomorrow
        if (target <= now) {
            target.setDate(target.getDate() + 1);
        }

        return target.getTime();
    }

    /**
     * Handle alarm trigger
     * @param {object} alarm - Alarm object from browser.alarms
     * @returns {Promise<void>}
     */
    async handleAlarm(alarm) {
        console.log(`🔔 Alarm triggered: ${alarm.name}`);

        try {
            const notificationsEnabled = await storageService.getNotificationsEnabled();

            if (!notificationsEnabled) {
                console.log('📵 Notifications disabled, skipping alarm check');
                return;
            }

            const serviceType = this.extractServiceTypeFromAlarm(alarm.name);
            if (!serviceType) {
                console.warn(`Could not determine service type for alarm: ${alarm.name}`);
                return;
            }

            // Trigger the appropriate check
            await this.checkService.performAutomaticCheck(serviceType, alarm.name);

            console.log(`✅ Automatic check completed for ${serviceType}`);
        } catch (error) {
            const serviceType = this.extractServiceTypeFromAlarm(alarm.name);
            throw AlarmError.fromAlarmTrigger(alarm.name, serviceType, error);
        }
    }

    /**
     * Extract service type from alarm name
     * @param {string} alarmName - Name of the alarm
     * @returns {string|null} Service type or null if not found
     */
    extractServiceTypeFromAlarm(alarmName) {
        // Alarm names follow pattern: checkDSP_{serviceType}_{time}
        const match = alarmName.match(/checkDSP_([^_]+)_/);
        return match ? match[1] : null;
    }

    /**
     * Clear all existing alarms
     * @returns {Promise<void>}
     */
    async clearAllAlarms() {
        try {
            await browser.alarms.clearAll();
            console.log('🧹 Cleared all existing alarms');
        } catch (error) {
            throw AlarmError.fromAlarmCreation('clear_all', error);
        }
    }

    /**
     * Get all current alarms
     * @returns {Promise<Array>} List of current alarms
     */
    async getAllAlarms() {
        try {
            return await browser.alarms.getAll();
        } catch (error) {
            console.error('Failed to get alarms:', error);
            return [];
        }
    }

    /**
     * Update alarms when service type settings change
     * @param {object} newServiceTypes - New service type settings
     * @returns {Promise<void>}
     */
    async updateAlarmsForServiceTypes(newServiceTypes) {
        console.log('🔄 Updating alarms for service type changes');

        try {
            await this.clearAllAlarms();

            for (const [serviceType, enabled] of Object.entries(newServiceTypes)) {
                if (enabled) {
                    await this.createAlarmsForServiceType(serviceType);
                }
            }

            console.log('✅ Alarms updated successfully');
        } catch (error) {
            throw AlarmError.fromAlarmCreation('update_service_types', error);
        }
    }

    /**
     * Get next scheduled alarm time for a service type
     * @param {string} serviceType - Service type to check
     * @returns {Promise<Date|null>} Next alarm time or null
     */
    async getNextAlarmTime(serviceType) {
        const alarms = await this.getAllAlarms();
        const serviceAlarms = alarms.filter(alarm =>
            alarm.name.includes(`checkDSP_${serviceType}_`)
        );

        if (serviceAlarms.length === 0) {
            return null;
        }

        const nextAlarm = serviceAlarms.reduce((earliest, current) =>
            current.scheduledTime < earliest.scheduledTime ? current : earliest
        );

        return new Date(nextAlarm.scheduledTime);
    }

    /**
     * Test alarm functionality (for development/debugging)
     * @param {string} serviceType - Service type to test
     * @returns {Promise<void>}
     */
    async testAlarm(serviceType) {
        const testAlarmName = `test_${serviceType}_${Date.now()}`;

        try {
            // Create alarm that triggers in 10 seconds
            await browser.alarms.create(testAlarmName, {
                when: Date.now() + 10000,
            });

            console.log(`🧪 Test alarm created: ${testAlarmName}`);
        } catch (error) {
            throw AlarmError.fromAlarmCreation(testAlarmName, error);
        }
    }
}
