async function getWebhookUrl(dspCode) {
    const { webhooks = {} } = await browser.storage.local.get('webhooks');
    return webhooks[dspCode];
}

async function getNotificationSettings() {
    const { notificationsEnabled = true } = await browser.storage.local.get('notificationsEnabled');
    return notificationsEnabled;
}

// Set up alarm for 14:00 daily
browser.runtime.onInstalled.addListener(async () => {
    const notificationsEnabled = await getNotificationSettings();
    if (notificationsEnabled) {
        await createDailyAlarm();
    }
    console.log('DSP Management Tool installed, notifications:', notificationsEnabled ? 'enabled' : 'disabled');
});

async function createDailyAlarm() {
    // Clear existing alarm first
    await browser.alarms.clear('checkDSP');
    
    // Create new alarm
    await browser.alarms.create('checkDSP', {
        when: getNextAlarmTime(),
        periodInMinutes: 24 * 60 // Daily
    });
    console.log('Daily alarm created for 14:00');
}

async function clearDailyAlarm() {
    await browser.alarms.clear('checkDSP');
    console.log('Daily alarm cleared');
}

function getNextAlarmTime() {
    const now = new Date();
    const next = new Date(now);
    next.setHours(14, 0, 0, 0);
    if (next <= now) {
        next.setDate(next.getDate() + 1);
    }
    return next.getTime();
}

// Handle alarm
browser.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === 'checkDSP') {
        // Double-check if notifications are still enabled
        const notificationsEnabled = await getNotificationSettings();
        if (notificationsEnabled) {
            console.log('DSP check alarm triggered');
            await checkDSPMismatches();
        } else {
            console.log('DSP check alarm triggered but notifications are disabled');
            await clearDailyAlarm();
        }
    }
});

// Handle manual check requests from popup and notification settings updates
browser.runtime.onMessage.addListener(async (request, sender) => {
    try {
        console.log('Background received message:', request);
        
        if (request.action === "manualCheck") {
            await checkDSPMismatches();
            return { success: true };
        } else if (request.action === "sendMessage") {
            const result = await sendWebhookMessage(request.dsp, request.message);
            return result;
        } else if (request.action === "updateNotificationSettings") {
            await updateNotificationSettings(request.enabled);
            return { success: true };
        }
        
        return { success: false, error: 'Unknown action' };
    } catch (error) {
        console.error(`Error handling ${request.action}:`, error);
        return { success: false, error: error.message };
    }
});

async function updateNotificationSettings(enabled) {
    try {
        if (enabled) {
            await createDailyAlarm();
            console.log('Automatic notifications enabled');
        } else {
            await clearDailyAlarm();
            console.log('Automatic notifications disabled');
        }
    } catch (error) {
        console.error('Error updating notification settings:', error);
        throw error;
    }
}

async function checkDSPMismatches() {
    try {
        console.log('Starting DSP mismatch check...');
        
        const tabs = await browser.tabs.query({
            url: "https://logistics.amazon.co.uk/internal/scheduling/dsps*"
        });

        let dspTab;
        let createdNewTab = false;
        
        if (tabs.length > 0) {
            dspTab = tabs[0];
            console.log('Found existing DSP tab, reloading...');
            await browser.tabs.reload(dspTab.id);
        } else {
            console.log('Creating new DSP tab...');
            dspTab = await browser.tabs.create({
                url: "https://logistics.amazon.co.uk/internal/scheduling/dsps",
                active: false
            });
            createdNewTab = true;
        }

        // Wait for page to load
        console.log('Waiting for page to load...');
        await new Promise(resolve => setTimeout(resolve, 6000));

        try {
            console.log('Sending message to content script...');
            const response = await browser.tabs.sendMessage(dspTab.id, { action: "checkMismatches" });
            console.log('Mismatch check response:', response);

            if (response && response.mismatches && response.mismatches.length > 0) {
                console.log(`Found ${response.mismatches.length} mismatches, sending notifications...`);
                await sendMismatchNotifications(response.mismatches);
            } else {
                console.log('No mismatches found or empty response');
            }
        } catch (messageError) {
            console.error('Error communicating with content script:', messageError);
            // This might happen if the page hasn't loaded yet or content script failed
        }

        // Clean up if we created a new tab
        if (createdNewTab) {
            console.log('Cleaning up created tab...');
            setTimeout(async () => {
                try {
                    await browser.tabs.remove(dspTab.id);
                    console.log('Tab removed successfully');
                } catch (e) {
                    console.log('Tab already closed or could not be removed');
                }
            }, 3000);
        }
        
        console.log('DSP mismatch check completed');
    } catch (error) {
        console.error('Error in checkDSPMismatches:', error);
        throw error;
    }
}

async function sendMismatchNotifications(mismatches) {
    const results = [];
    
    console.log(`Sending notifications for ${mismatches.length} mismatches...`);
    
    for (const mismatch of mismatches) {
        try {
            const dspKey = mismatch.dspName.split(' ')[0];
            const webhookUrl = await getWebhookUrl(dspKey);
            
            if (webhookUrl) {
                const message = `:warning: Rostering Mismatch Alert for ${mismatch.dspName}:
:white_check_mark: Accepted: ${mismatch.confirmed}
:heavy_exclamation_mark: Rostered: ${mismatch.rostered}
Please check and adjust your roster accordingly.`;
                
                console.log(`Sending notification to ${dspKey}...`);
                const result = await sendWebhookMessage(dspKey, message);
                results.push({ dsp: dspKey, success: result.success, error: result.error });
                
                if (result.success) {
                    console.log(`✓ Notification sent successfully to ${dspKey}`);
                } else {
                    console.error(`✗ Failed to send notification to ${dspKey}:`, result.error);
                }
                
                // Small delay between webhook calls
                await new Promise(resolve => setTimeout(resolve, 1000));
            } else {
                console.log(`No webhook configured for DSP: ${dspKey}`);
                results.push({ dsp: dspKey, success: false, error: 'No webhook configured' });
            }
        } catch (error) {
            console.error('Error processing mismatch notification:', error);
            results.push({ dsp: mismatch.dspName, success: false, error: error.message });
        }
    }
    
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;
    console.log(`Notification results: ${successCount} successful, ${failCount} failed`);
    
    return results;
}

async function sendWebhookMessage(dsp, message) {
    const webhookUrl = await getWebhookUrl(dsp);
    if (!webhookUrl) {
        return { success: false, error: 'No webhook URL configured for this DSP' };
    }

    try {
        console.log(`Sending webhook message to ${dsp}:`, message.substring(0, 100) + '...');
        
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

        console.log(`✓ Message sent successfully to ${dsp}`);
        return { success: true };
        
    } catch (error) {
        console.error(`✗ Error sending webhook to ${dsp}:`, error);
        return { success: false, error: error.message };
    }
}