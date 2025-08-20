// background/background.js - Enhanced with multi-service type support

async function getWebhookUrl(dspCode) {
    const { webhooks = {} } = await browser.storage.local.get('webhooks');
    return webhooks[dspCode];
}

async function getNotificationSettings() {
    const { notificationsEnabled = true } = await browser.storage.local.get('notificationsEnabled');
    return notificationsEnabled;
}

async function getServiceTypeSettings() {
    const { 
        serviceTypes = {
            'cycle1': true,     // Standard Parcel - default enabled
            'samedayB': false,  // Multi-Use
            'samedayC': false   // Sameday Parcel
        }
    } = await browser.storage.local.get('serviceTypes');
    return serviceTypes;
}

// Service type configuration
const SERVICE_TYPES = {
    cycle1: {
        name: 'Standard Parcel',
        displayName: 'Cycle 1 (Standard Parcel)',
        alarms: [
            { name: 'checkDSP_cycle1_14', hour: 14, minute: 0 },
            { name: 'checkDSP_cycle1_1530', hour: 15, minute: 30 }
        ]
    },
    samedayB: {
        name: 'Multi-Use',
        displayName: 'Sameday B (Multi-Use)',
        alarms: [
            { name: 'checkDSP_samedayB_10', hour: 10, minute: 0 }
        ]
    },
    samedayC: {
        name: 'Sameday Parcel',
        displayName: 'Sameday C (Sameday Parcel)',
        alarms: [
            { name: 'checkDSP_samedayC_1415', hour: 14, minute: 15 }
        ]
    }
};

// Set up extension
browser.runtime.onInstalled.addListener(async () => {
    const notificationsEnabled = await getNotificationSettings();
    if (notificationsEnabled) {
        await createServiceTypeAlarms();
    }
    console.log('DSP Management Tool installed, notifications:', notificationsEnabled ? 'enabled' : 'disabled');
});

async function createServiceTypeAlarms() {
    try {
        console.log('🔔 Creating service type alarms...');
        
        // Clear all existing alarms first
        await clearAllAlarms();
        
        const serviceTypeSettings = await getServiceTypeSettings();
        console.log('📋 Service type settings:', serviceTypeSettings);
        
        // Create alarms for enabled service types
        for (const [serviceType, enabled] of Object.entries(serviceTypeSettings)) {
            if (enabled && SERVICE_TYPES[serviceType]) {
                await createAlarmsForServiceType(serviceType);
            }
        }
        
        console.log('✅ Service type alarms created successfully');
    } catch (error) {
        console.error('❌ Error creating service type alarms:', error);
    }
}

async function createAlarmsForServiceType(serviceType) {
    const config = SERVICE_TYPES[serviceType];
    if (!config) return;
    
    console.log(`⏰ Creating alarms for ${config.displayName}`);
    
    for (const alarm of config.alarms) {
        await browser.alarms.create(alarm.name, {
            when: getNextAlarmTime(alarm.hour, alarm.minute),
            periodInMinutes: 24 * 60 // Daily
        });
        
        console.log(`✅ Created alarm: ${alarm.name} at ${alarm.hour}:${alarm.minute.toString().padStart(2, '0')}`);
    }
}

async function clearAllAlarms() {
    const existingAlarms = await browser.alarms.getAll();
    for (const alarm of existingAlarms) {
        if (alarm.name.startsWith('checkDSP_')) {
            await browser.alarms.clear(alarm.name);
            console.log(`🗑️ Cleared alarm: ${alarm.name}`);
        }
    }
}

function getNextAlarmTime(hours, minutes) {
    const now = new Date();
    const next = new Date(now);
    next.setHours(hours, minutes, 0, 0);
    if (next <= now) {
        next.setDate(next.getDate() + 1);
    }
    return next.getTime();
}

// Handle alarms
browser.alarms.onAlarm.addListener(async (alarm) => {
    console.log(`🔔 Alarm triggered: ${alarm.name}`);
    
    if (alarm.name.startsWith('checkDSP_')) {
        // Double-check if notifications are still enabled
        const notificationsEnabled = await getNotificationSettings();
        if (!notificationsEnabled) {
            console.log('❌ Notifications disabled, skipping check');
            await clearAllAlarms();
            return;
        }
        
        // Determine service type from alarm name
        let serviceType = null;
        let alarmTime = '';
        
        if (alarm.name.includes('cycle1')) {
            serviceType = 'cycle1';
            alarmTime = alarm.name.includes('_14') ? '14:00' : '15:30';
        } else if (alarm.name.includes('samedayB')) {
            serviceType = 'samedayB';
            alarmTime = '10:00';
        } else if (alarm.name.includes('samedayC')) {
            serviceType = 'samedayC';
            alarmTime = '14:15';
        }
        
        if (serviceType) {
            console.log(`🎯 Processing ${serviceType} check at ${alarmTime}`);
            await checkDSPMismatches(serviceType, alarm.name);
        }
    } else if (alarm.name.startsWith('followUp_')) {
        // Handle follow-up notifications (15 minutes after initial)
        await handleFollowUpNotification(alarm.name);
    }
});

// Handle messages from popup and options
browser.runtime.onMessage.addListener(async (request, sender) => {
    try {
        console.log('📨 Background received message:', request);

        switch (request.action) {
            case "manualCheck":
                // For manual checks, check all enabled service types
                await checkAllEnabledServiceTypes();
                return { success: true };
                
            case "sendMessage":
                return await sendWebhookMessage(request.dsp, request.message);
                
            case "updateNotificationSettings":
                await updateNotificationSettings(request.enabled);
                return { success: true };
                
            case "updateServiceTypeSettings":
                await updateServiceTypeSettings(request.serviceTypes);
                return { success: true };
                
            case "getAlarmStatus":
                return await getAlarmStatus();
                
            case "serviceTypesInferred":
                await handleServiceTypesInferred(request.detectedTypes, request.updatedSettings);
                return { success: true };
                
            default:
                return { success: false, error: 'Unknown action' };
        }
    } catch (error) {
        console.error(`❌ Error handling ${request.action}:`, error);
        return { success: false, error: error.message };
    }
});

async function updateNotificationSettings(enabled) {
    try {
        await browser.storage.local.set({ notificationsEnabled: enabled });
        
        if (enabled) {
            await createServiceTypeAlarms();
            console.log('✅ Automatic notifications enabled');
        } else {
            await clearAllAlarms();
            console.log('✅ Automatic notifications disabled');
        }
    } catch (error) {
        console.error('❌ Error updating notification settings:', error);
        throw error;
    }
}

async function updateServiceTypeSettings(serviceTypes) {
    try {
        await browser.storage.local.set({ serviceTypes });
        
        // Recreate alarms with new settings
        const notificationsEnabled = await getNotificationSettings();
        if (notificationsEnabled) {
            await createServiceTypeAlarms();
        }
        
        console.log('✅ Service type settings updated:', serviceTypes);
    } catch (error) {
        console.error('❌ Error updating service type settings:', error);
        throw error;
    }
}

async function checkAllEnabledServiceTypes() {
    const serviceTypeSettings = await getServiceTypeSettings();
    
    for (const [serviceType, enabled] of Object.entries(serviceTypeSettings)) {
        if (enabled) {
            console.log(`🔍 Manual check for ${serviceType}`);
            await checkDSPMismatches(serviceType, `manual_${serviceType}`);
        }
    }
}

async function checkDSPMismatches(serviceType, alarmName) {
    try {
        console.log(`🔍 Starting DSP mismatch check for ${serviceType}...`);

        const tabs = await browser.tabs.query({
            url: "https://logistics.amazon.co.uk/internal/scheduling/dsps*"
        });

        let dspTab;
        let createdNewTab = false;

        if (tabs.length > 0) {
            dspTab = tabs[0];
            console.log('📄 Found existing DSP tab, reloading...');
            await browser.tabs.reload(dspTab.id);
        } else {
            // Only create new tab for production site, not for local testing
            console.log('🆕 Creating new DSP tab...');
            dspTab = await browser.tabs.create({
                url: "https://logistics.amazon.co.uk/internal/scheduling/dsps",
                active: false
            });
            createdNewTab = true;
        }

        // Wait for page to load
        console.log('⏳ Waiting for page to load...');
        await new Promise(resolve => setTimeout(resolve, 6000));

        try {
            console.log('📡 Sending message to content script...');
            const response = await browser.tabs.sendMessage(dspTab.id, { 
                action: "checkMismatches",
                serviceType: serviceType
            });
            
            console.log('📊 Mismatch check response:', response);

            if (response && response.mismatches && response.mismatches.length > 0) {
                console.log(`🚨 Found ${response.mismatches.length} mismatches for ${serviceType}`);
                await sendMismatchNotifications(response.mismatches, serviceType);
                
                // Schedule follow-up notification for 15 minutes later
                await scheduleFollowUpNotification(response.mismatches, serviceType, alarmName);
            } else {
                console.log(`✅ No mismatches found for ${serviceType}`);
            }
        } catch (messageError) {
            console.error('❌ Error communicating with content script:', messageError);
        }

        // Clean up if we created a new tab
        if (createdNewTab) {
            console.log('🧹 Cleaning up created tab...');
            setTimeout(async () => {
                try {
                    await browser.tabs.remove(dspTab.id);
                    console.log('✅ Tab removed successfully');
                } catch (e) {
                    console.log('ℹ️ Tab already closed or could not be removed');
                }
            }, 3000);
        }

        console.log(`✅ DSP mismatch check completed for ${serviceType}`);
    } catch (error) {
        console.error(`❌ Error in checkDSPMismatches for ${serviceType}:`, error);
        throw error;
    }
}

async function scheduleFollowUpNotification(mismatches, serviceType, originalAlarmName) {
    try {
        const followUpAlarmName = `followUp_${originalAlarmName}_${Date.now()}`;
        const followUpTime = Date.now() + (15 * 60 * 1000); // 15 minutes from now
        
        // Store mismatch data for follow-up
        await browser.storage.local.set({
            [`followUp_${followUpAlarmName}`]: {
                mismatches,
                serviceType,
                originalAlarmName,
                scheduledTime: followUpTime
            }
        });
        
        // Create follow-up alarm
        await browser.alarms.create(followUpAlarmName, {
            when: followUpTime
        });
        
        console.log(`⏰ Scheduled follow-up notification for ${serviceType} in 15 minutes`);
    } catch (error) {
        console.error('❌ Error scheduling follow-up notification:', error);
    }
}

async function handleFollowUpNotification(alarmName) {
    try {
        console.log(`🔔 Processing follow-up notification: ${alarmName}`);
        
        // Get stored follow-up data
        const followUpKey = `followUp_${alarmName}`;
        const result = await browser.storage.local.get(followUpKey);
        const followUpData = result[followUpKey];
        
        if (!followUpData) {
            console.warn('⚠️ No follow-up data found for:', alarmName);
            return;
        }
        
        // Check if mismatches still exist
        const currentMismatches = await recheckMismatches(followUpData.serviceType);
        
        // Find DSPs that still have mismatches
        const stillMismatched = followUpData.mismatches.filter(originalMismatch =>
            currentMismatches.some(currentMismatch => 
                currentMismatch.dspName === originalMismatch.dspName
            )
        );
        
        if (stillMismatched.length > 0) {
            console.log(`🚨 ${stillMismatched.length} DSPs still have mismatches after 15 minutes`);
            
            // Send browser notification to user
            await sendBrowserNotification(stillMismatched, followUpData.serviceType);
            
            // Optionally send additional webhook notifications
            await sendFollowUpWebhookNotifications(stillMismatched, followUpData.serviceType);
        } else {
            console.log('✅ All mismatches resolved within 15 minutes');
        }
        
        // Clean up stored follow-up data
        await browser.storage.local.remove(followUpKey);
        
    } catch (error) {
        console.error('❌ Error handling follow-up notification:', error);
    }
}

async function recheckMismatches(serviceType) {
    try {
        console.log(`🔄 Rechecking mismatches for ${serviceType} - refreshing page first...`);
        
        const tabs = await browser.tabs.query({
            url: "https://logistics.amazon.co.uk/internal/scheduling/dsps*"
        });
        
        if (tabs.length === 0) {
            console.log('🔍 No DSP tab found for recheck, skipping');
            return [];
        }
        
        const dspTab = tabs[0];
        
        // Refresh the page first to get latest roster data
        console.log('🔄 Refreshing DSP tab to get latest roster data...');
        await browser.tabs.reload(dspTab.id);
        
        // Wait for page to reload and content script to initialize
        console.log('⏳ Waiting for page to reload and initialize...');
        await new Promise(resolve => setTimeout(resolve, 6000));
        
        // Now check for mismatches with fresh data
        console.log('📡 Checking mismatches with fresh data...');
        const response = await browser.tabs.sendMessage(dspTab.id, { 
            action: "checkMismatches",
            serviceType: serviceType
        });
        
        console.log(`📊 Recheck completed for ${serviceType}: ${response?.mismatches?.length || 0} mismatches found`);
        return response?.mismatches || [];
    } catch (error) {
        console.error('❌ Error rechecking mismatches:', error);
        return [];
    }
}

async function sendBrowserNotification(mismatches, serviceType) {
    try {
        const serviceConfig = SERVICE_TYPES[serviceType];
        const dspNames = mismatches.map(m => m.dspName.split(' ')[0]).join(', ');
        
        // Create browser notification
        await browser.notifications.create({
            type: 'basic',
            iconUrl: browser.runtime.getURL('icons/icon.svg'),
            title: `DSP Roster Alert - ${serviceConfig.displayName}`,
            message: `${mismatches.length} DSP${mismatches.length > 1 ? 's' : ''} still have unresolved mismatches after 15 minutes: ${dspNames}`,
            buttons: [
                { title: 'Open DSP Page' },
                { title: 'Dismiss' }
            ]
        });
        
        console.log('🔔 Browser notification sent for persistent mismatches');
    } catch (error) {
        console.error('❌ Error sending browser notification:', error);
    }
}

// Handle notification button clicks
browser.notifications.onButtonClicked.addListener(async (notificationId, buttonIndex) => {
    if (buttonIndex === 0) { // Open DSP Page
        try {
            // Always open production site from notifications
            await browser.tabs.create({
                url: "https://logistics.amazon.co.uk/internal/scheduling/dsps",
                active: true
            });
        } catch (error) {
            console.error('❌ Error opening DSP page:', error);
        }
    }
    
    // Clear notification
    browser.notifications.clear(notificationId);
});

async function sendFollowUpWebhookNotifications(mismatches, serviceType) {
    try {
        const serviceConfig = SERVICE_TYPES[serviceType];
        
        for (const mismatch of mismatches) {
            const dspKey = mismatch.dspName.split(' ')[0];
            const webhookUrl = await getWebhookUrl(dspKey);
            
            if (webhookUrl) {
                let message = `/md #### 🚨 **URGENT - ${serviceConfig.displayName} Rostering Still Unresolved**

⚠️ **15 minutes have passed** since the initial alert for **${mismatch.dspName}**

| Status | Count |
|--------|-------|
| ✅ **Accepted** | ${mismatch.confirmed} |
| ❗ **Rostered** | ${mismatch.rostered} |

> **🔴 IMMEDIATE ACTION REQUIRED** - Please check and adjust your roster now.`;
                
                // Add roster deadline reminder for cycle 1
                if (serviceType === 'cycle1') {
                    message += `\n\n⏰ **URGENT DEADLINE:** Roster must be done by **15:15**.`;
                }

                await sendWebhookMessage(dspKey, message);
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        
        console.log('📤 Follow-up webhook notifications sent');
    } catch (error) {
        console.error('❌ Error sending follow-up webhook notifications:', error);
    }
}

async function sendMismatchNotifications(mismatches, serviceType) {
    const results = [];
    const serviceConfig = SERVICE_TYPES[serviceType];

    console.log(`📤 Sending notifications for ${mismatches.length} mismatches in ${serviceConfig.displayName}...`);

    for (const mismatch of mismatches) {
        try {
            const dspKey = mismatch.dspName.split(' ')[0];
            const webhookUrl = await getWebhookUrl(dspKey);

            if (webhookUrl) {
                let message = `/md #### ⚠️ ${serviceConfig.displayName} Rostering Mismatch Alert

**DSP:** ${mismatch.dspName}

| Status | Count |
|--------|-------|
| ✅ **Accepted** | ${mismatch.confirmed} |
| ❗ **Rostered** | ${mismatch.rostered} |

> **Action Required:** Please check and adjust your roster accordingly.`;
                
                // Add roster deadline reminder for cycle 1
                if (serviceType === 'cycle1') {
                    message += `\n\n⏰ **Reminder:** Please ensure your roster is done by **15:15**.`;
                }

                console.log(`📤 Sending notification to ${dspKey}...`);
                const result = await sendWebhookMessage(dspKey, message);
                results.push({ dsp: dspKey, success: result.success, error: result.error });

                if (result.success) {
                    console.log(`✅ Notification sent successfully to ${dspKey}`);
                } else {
                    console.error(`❌ Failed to send notification to ${dspKey}:`, result.error);
                }

                await new Promise(resolve => setTimeout(resolve, 1000));
            } else {
                console.log(`⚠️ No webhook configured for DSP : ${dspKey}`);
                results.push({ dsp: dspKey, success: false, error: 'No webhook configured' });
            }
        } catch (error) {
            console.error('❌ Error processing mismatch notification:', error);
            results.push({ dsp: mismatch.dspName, success: false, error: error.message });
        }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;
    console.log(`📊 Notification results: ${successCount} successful, ${failCount} failed`);

    return results;
}

async function sendWebhookMessage(dsp, message) {
    const webhookUrl = await getWebhookUrl(dsp);
    if (!webhookUrl) {
        return { success: false, error: 'No webhook URL configured for this DSP' };
    }

    try {
        console.log(`📤 Sending webhook message to ${dsp}:`, message.substring(0, 100) + '...');

        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ Content: message })
        });

        if (!response.ok) {
            let errorDetail = 'Unknown error';
            try {
                const errorText = await response.text();
                errorDetail = errorText || `HTTP ${response.status}: ${response.statusText}`;
            } catch (e) {
                errorDetail = `HTTP ${response.status}: ${response.statusText}`;
            }
            throw new Error(errorDetail);
        }

        console.log(`✅ Message sent successfully to ${dsp}`);
        return { success: true };

    } catch (error) {
        console.error(`❌ Error sending webhook to ${dsp}:`, error);
        return { success: false, error: error.message };
    }
}

async function handleServiceTypesInferred(detectedTypes, updatedSettings) {
    try {
        console.log('🔍 Service types inferred from page:', detectedTypes);
        console.log('📋 Updated settings:', updatedSettings);
        
        // Update alarms if notifications are enabled (similar to amzl-scripts alarm management)
        const notificationsEnabled = await getNotificationSettings();
        if (notificationsEnabled) {
            console.log('🔔 Updating alarms based on inferred service types...');
            await createServiceTypeAlarms();
        }
        
        // Optionally send notification about auto-detection
        const enabledTypes = Object.keys(updatedSettings).filter(type => updatedSettings[type]);
        if (enabledTypes.length > 0) {
            console.log(`✅ Auto-detected and enabled ${enabledTypes.length} service types: ${enabledTypes.join(', ')}`);
        }
        
    } catch (error) {
        console.error('❌ Error handling inferred service types:', error);
        throw error;
    }
}

async function getAlarmStatus() {
    try {
        const alarms = await browser.alarms.getAll();
        const dspAlarms = alarms.filter(alarm => alarm.name.startsWith('checkDSP_'));
        
        const formattedAlarms = dspAlarms.map(alarm => {
            const nextTime = new Date(alarm.scheduledTime);
            let description = 'Unknown Service';
            
            if (alarm.name.includes('cycle1')) {
                const time = alarm.name.includes('_14') ? '14:00' : '15:30';
                description = `Cycle 1 Check (${time})`;
            } else if (alarm.name.includes('samedayB')) {
                description = 'Sameday B Check (10:00)';
            } else if (alarm.name.includes('samedayC')) {
                description = 'Sameday C Check (14:15)';
            }
            
            return {
                name: alarm.name,
                description,
                nextScheduled: nextTime.toLocaleString()
            };
        });
        
        return {
            success: true,
            alarms: formattedAlarms
        };
    } catch (error) {
        console.error('❌ Error getting alarm status:', error);
        return { success: false, error: error.message };
    }
}
