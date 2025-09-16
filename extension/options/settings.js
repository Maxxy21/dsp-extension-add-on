async function loadSettings() {
    if (!browser?.storage?.local) {
        throw new Error('Browser storage API not available');
    }

    try {
        console.log('📡 Loading settings...');

        const notificationResult = await browser.storage.local.get(['notificationsEnabled']);
        const notificationsEnabled = notificationResult.notificationsEnabled !== undefined
            ? notificationResult.notificationsEnabled
            : true;

        console.log('✅ Loaded notification settings:', notificationsEnabled);

        if (elements.enableNotifications) {
            elements.enableNotifications.checked = notificationsEnabled;
        }

        await loadServiceTypeSettings();
        await loadGeneralSettings();
        await renderUrlPreviews();
        await loadWebhooks();
        await loadUploadedManifestStatus();
        await loadUploadedBackbriefStatus();

        if (notificationsEnabled) {
            await loadAlarmStatus();
        }

        console.log('✅ Settings loaded successfully');
    } catch (error) {
        console.error('❌ Error loading settings:', error);
        showToast('Failed to load some settings, using defaults', 'error');
    }
}

async function loadGeneralSettings() {
    try {
        const result = await browser.storage.local.get(['settings']);
        const settings = result.settings || {};
        const paidTime = Number.isFinite(settings.paidTimeMinutes) ? settings.paidTimeMinutes : 525;
        const chimeFmt = settings.formatManualMessagesForChime !== false;
        const serviceAreaId = settings.serviceAreaId || '';
        const schedulingBaseUrl = settings.schedulingBaseUrl || '';
        const routePlanningBaseUrl = settings.routePlanningBaseUrl || '';
        const riskAlertsEnabled = settings.riskAlertsEnabled === true;
        const riskDashboardUrl = settings.riskDashboardUrl || '';
        const slackWebhookUrl = settings.slackWebhookUrl || '';
        const slackUseChimeMarkdown = settings.slackUseChimeMarkdown === true;
        const thr = settings.riskThresholds || { bc: 10, bcResidential: 5, cna: 25, cnaOutlierFactor: 1.5, missing: 1, uta: 5, utl: 5, rejected: 2 };
        const renotifyStep = Number.isFinite(settings.riskRenotifyStep) ? settings.riskRenotifyStep : 5;

        if (elements.paidTimeMinutes) elements.paidTimeMinutes.value = paidTime;
        if (elements.formatChimeManual) elements.formatChimeManual.checked = chimeFmt;
        if (elements.serviceAreaId) elements.serviceAreaId.value = serviceAreaId;
        if (elements.schedulingUrl) elements.schedulingUrl.value = schedulingBaseUrl;
        if (elements.routePlanningUrl) elements.routePlanningUrl.value = routePlanningBaseUrl;
        if (elements.enableRiskAlerts) elements.enableRiskAlerts.checked = riskAlertsEnabled;
        if (elements.riskDashboardUrl) elements.riskDashboardUrl.value = riskDashboardUrl;
        if (elements.slackWebhookUrl) elements.slackWebhookUrl.value = slackWebhookUrl;
        if (elements.slackUseChimeMarkdown) elements.slackUseChimeMarkdown.checked = slackUseChimeMarkdown;
        if (elements.thrBc) elements.thrBc.value = thr.bc;
        if (elements.thrBcResidential) elements.thrBcResidential.value = thr.bcResidential;
        if (elements.thrCna) elements.thrCna.value = thr.cna;
        if (elements.thrCnaFactor) elements.thrCnaFactor.value = thr.cnaOutlierFactor;
        if (elements.thrMissing) elements.thrMissing.value = thr.missing;
        if (elements.thrUta) elements.thrUta.value = thr.uta;
        if (elements.thrUtl) elements.thrUtl.value = thr.utl;
        if (elements.thrRejected) elements.thrRejected.value = thr.rejected;
        if (elements.thrRenotifyStep) elements.thrRenotifyStep.value = renotifyStep;
        if (elements.inferPaidTime) elements.inferPaidTime.checked = settings.paidTimeInferFromConstraints === true;

        const failedReasons = settings.failedReasons || [
            'BUSINESS_CLOSED','LOCKER_ISSUE','UNABLE_TO_LOCATE_ADDRESS','UNABLE_TO_ACCESS','OTP_NOT_AVAILABLE','ITEMS_MISSING'
        ];
        if (elements.failedBackbriefUrl) elements.failedBackbriefUrl.value = settings.failedBackbriefUrl || '';
        if (elements.failedChunkSize) elements.failedChunkSize.value = Number.isFinite(settings.failedChunkSize) ? settings.failedChunkSize : 20;
        if (elements.failedAutoEnabled) elements.failedAutoEnabled.checked = settings.failedAutoEnabled === true;
        if (elements.failedSendTime) elements.failedSendTime.value = settings.failedSendTime || '09:00';
        ['BUSINESS_CLOSED','LOCKER_ISSUE','UNABLE_TO_LOCATE_ADDRESS','UNABLE_TO_ACCESS','OTP_NOT_AVAILABLE','ITEMS_MISSING'].forEach(rid => {
            const el = elements['fr_' + rid]; if (el) el.checked = failedReasons.includes(rid);
        });
    } catch (error) {
        console.warn('⚠️ Failed to load general settings, using defaults');
        if (elements.paidTimeMinutes) elements.paidTimeMinutes.value = 525;
        if (elements.formatChimeManual) elements.formatChimeManual.checked = true;
        if (elements.serviceAreaId) elements.serviceAreaId.value = '';
        if (elements.schedulingUrl) elements.schedulingUrl.value = '';
        if (elements.routePlanningUrl) elements.routePlanningUrl.value = '';
        if (elements.enableRiskAlerts) elements.enableRiskAlerts.checked = false;
        if (elements.riskDashboardUrl) elements.riskDashboardUrl.value = '';
        if (elements.slackWebhookUrl) elements.slackWebhookUrl.value = '';
        if (elements.slackUseChimeMarkdown) elements.slackUseChimeMarkdown.checked = false;
        if (elements.thrBc) elements.thrBc.value = 10;
        if (elements.thrBcResidential) elements.thrBcResidential.value = 5;
        if (elements.thrCna) elements.thrCna.value = 25;
        if (elements.thrCnaFactor) elements.thrCnaFactor.value = 1.5;
        if (elements.thrMissing) elements.thrMissing.value = 1;
        if (elements.thrUta) elements.thrUta.value = 5;
        if (elements.thrUtl) elements.thrUtl.value = 5;
        if (elements.thrRejected) elements.thrRejected.value = 2;
        if (elements.thrRenotifyStep) elements.thrRenotifyStep.value = 5;
        if (elements.inferPaidTime) elements.inferPaidTime.checked = false;
        if (elements.failedBackbriefUrl) elements.failedBackbriefUrl.value = '';
        if (elements.failedChunkSize) elements.failedChunkSize.value = 20;
        if (elements.failedAutoEnabled) elements.failedAutoEnabled.checked = false;
        if (elements.failedSendTime) elements.failedSendTime.value = '09:00';
        ['BUSINESS_CLOSED','LOCKER_ISSUE','UNABLE_TO_LOCATE_ADDRESS','UNABLE_TO_ACCESS','OTP_NOT_AVAILABLE','ITEMS_MISSING'].forEach(rid => {
            const el = elements['fr_' + rid]; if (el) el.checked = true;
        });
    }
}

async function loadServiceTypeSettings() {
    try {
        console.log('📡 Loading service type settings...');
        const result = await browser.storage.local.get(['serviceTypes', 'lastInferredTypes', 'inferenceTimestamp']);
        const serviceTypes = result.serviceTypes || {
            cycle1: true,
            samedayB: false,
            samedayC: false
        };

        console.log('✅ Loaded service type settings:', serviceTypes);

        Object.entries(SERVICE_TYPES).forEach(([serviceType, config]) => {
            const element = elements[config.elementId];
            const timingElement = elements[config.timingId];
            if (element) {
                element.checked = serviceTypes[serviceType] || false;
            }
            if (timingElement) {
                timingElement.style.display = serviceTypes[serviceType] ? 'block' : 'none';
            }
        });

        await displayInferenceStatus(result.lastInferredTypes, result.inferenceTimestamp);
    } catch (error) {
        console.error('❌ Error loading service type settings:', error);
        Object.entries(SERVICE_TYPES).forEach(([serviceType, config]) => {
            const element = elements[config.elementId];
            if (element) {
                element.checked = serviceType === 'cycle1';
            }
        });
    }
}

async function displayInferenceStatus(lastInferredTypes, inferenceTimestamp) {
    try {
        const statusEl = document.getElementById('serviceTypeInferenceStatus');
        if (!statusEl) return;
        statusEl.textContent = '';

        if (!Array.isArray(lastInferredTypes) || lastInferredTypes.length === 0) {
            statusEl.textContent = 'No automatic detections yet';
            statusEl.className = 'inference-status';
            return;
        }

        const date = inferenceTimestamp ? new Date(inferenceTimestamp) : null;
        const dateText = date ? date.toLocaleString() : 'recently';
        statusEl.textContent = `Auto-detected ${lastInferredTypes.join(', ')} on ${dateText}`;
        statusEl.className = 'inference-status detected';
    } catch (error) {
        console.error('❌ Error displaying inference status:', error);
    }
}

async function saveGeneralSettings() {
    try {
        const paid = parseInt(elements.paidTimeMinutes?.value || '525', 10);
        const paidTimeMinutes = Number.isFinite(paid) ? paid : 525;
        const formatManualMessagesForChime = !!elements.formatChimeManual?.checked;
        const serviceAreaId = (elements.serviceAreaId?.value || '').trim();
        const schedulingRaw = (elements.schedulingUrl?.value || '').trim();
        const routePlanningRaw = (elements.routePlanningUrl?.value || '').trim();
        const riskAlertsEnabled = !!elements.enableRiskAlerts?.checked;
        const riskDashboardUrl = (elements.riskDashboardUrl?.value || '').trim();
        const slackWebhookUrl = (elements.slackWebhookUrl?.value || '').trim();
        const slackUseChimeMarkdown = !!elements.slackUseChimeMarkdown?.checked;
        const pInt = (val, def) => {
            const n = parseInt(String(val ?? ''), 10);
            return Number.isFinite(n) ? n : def;
        };
        const pFloat = (val, def) => {
            const n = parseFloat(String(val ?? ''));
            return Number.isFinite(n) ? n : def;
        };

        const newSettings = {
            paidTimeMinutes,
            formatManualMessagesForChime,
            serviceAreaId,
            riskAlertsEnabled,
            riskDashboardUrl,
            slackWebhookUrl,
            slackUseChimeMarkdown,
            riskThresholds: {
                bc: pInt(elements.thrBc?.value, 10),
                bcResidential: pInt(elements.thrBcResidential?.value, 5),
                cna: pInt(elements.thrCna?.value, 25),
                cnaOutlierFactor: pFloat(elements.thrCnaFactor?.value, 1.5),
                missing: pInt(elements.thrMissing?.value, 1),
                uta: pInt(elements.thrUta?.value, 5),
                utl: pInt(elements.thrUtl?.value, 5),
                rejected: pInt(elements.thrRejected?.value, 2)
            },
            riskRenotifyStep: pInt(elements.thrRenotifyStep?.value, 5),
            paidTimeInferFromConstraints: !!elements.inferPaidTime?.checked,
            failedBackbriefUrl: (elements.failedBackbriefUrl?.value || '').trim(),
            failedChunkSize: pInt(elements.failedChunkSize?.value, 20),
            failedAutoEnabled: !!elements.failedAutoEnabled?.checked,
            failedSendTime: (elements.failedSendTime?.value || '09:00').trim(),
            failedReasons: ['BUSINESS_CLOSED','LOCKER_ISSUE','UNABLE_TO_LOCATE_ADDRESS','UNABLE_TO_ACCESS','OTP_NOT_AVAILABLE','ITEMS_MISSING'].filter(rid => elements['fr_' + rid]?.checked)
        };

        const { schedulingBaseUrl, parsedServiceAreaId } = normalizeSchedulingUrl(schedulingRaw, serviceAreaId);
        const { routePlanningBaseUrl } = normalizeRoutePlanningUrl(routePlanningRaw);
        newSettings.schedulingBaseUrl = schedulingBaseUrl;
        newSettings.serviceAreaId = parsedServiceAreaId || serviceAreaId;
        newSettings.routePlanningBaseUrl = routePlanningBaseUrl;

        await browser.storage.local.set({ settings: newSettings });
        console.log('✅ Saved general settings', newSettings);
        showToast('Settings saved', 'success');
        await renderUrlPreviews();
    } catch (error) {
        console.error('❌ Error saving settings:', error);
        showToast('Failed to save settings', 'error');
    }
}

async function saveNotificationSettings(enabled) {
    if (!browser?.storage?.local) {
        throw new Error('Browser storage API not available');
    }

    try {
        console.log('💾 Saving notification settings:', enabled);
        await browser.storage.local.set({ notificationsEnabled: enabled });
        console.log('✅ Notification settings saved successfully');
    } catch (error) {
        console.error('❌ Error saving notification settings:', error);
        throw new Error('Failed to save notification settings');
    }
}

async function saveServiceTypeSettings() {
    if (!browser?.storage?.local) {
        throw new Error('Browser storage API not available');
    }

    try {
        console.log('💾 Saving service type settings...');
        const serviceTypes = {};
        Object.entries(SERVICE_TYPES).forEach(([serviceType, config]) => {
            const element = elements[config.elementId];
            if (element) {
                serviceTypes[serviceType] = element.checked;
            }
        });

        console.log('💾 Service type settings to save:', serviceTypes);
        await browser.storage.local.set({ serviceTypes });

        try {
            const response = await browser.runtime.sendMessage({
                action: 'updateServiceTypeSettings',
                serviceTypes: serviceTypes
            });

            if (response?.success) {
                console.log('✅ Background script service types updated successfully');
            } else {
                console.warn('⚠️ Background script service type update failed:', response);
            }
        } catch (runtimeError) {
            console.warn('⚠️ Could not communicate with background script:', runtimeError);
        }

        console.log('✅ Service type settings saved successfully');
    } catch (error) {
        console.error('❌ Error saving service type settings:', error);
        throw new Error('Failed to save service type settings');
    }
}

async function loadAlarmStatus() {
    try {
        const response = await browser.runtime.sendMessage({ action: 'getAlarmStatus' });
        if (response?.success) {
            displayAlarmStatus(response.alarms || []);
        } else {
            clearAlarmStatus();
        }
    } catch (error) {
        console.warn('⚠️ Failed to load alarm status:', error);
        clearAlarmStatus();
    }
}

function displayAlarmStatus(alarms) {
    const container = document.getElementById('alarmStatus');
    if (!container) return;
    container.innerHTML = '';

    if (!Array.isArray(alarms) || alarms.length === 0) {
        const span = document.createElement('span');
        span.textContent = 'No automatic checks scheduled';
        container.appendChild(span);
        return;
    }

    alarms.forEach(alarm => {
        const row = document.createElement('div');
        row.className = 'alarm-row';

        const name = document.createElement('span');
        name.textContent = alarm.description || alarm.name;

        const time = document.createElement('span');
        time.textContent = alarm.nextScheduled;

        row.appendChild(name);
        row.appendChild(time);
        container.appendChild(row);
    });
}

function clearAlarmStatus() {
    const container = document.getElementById('alarmStatus');
    if (!container) return;
    container.innerHTML = '';
    const span = document.createElement('span');
    span.textContent = 'Automatic checks disabled';
    container.appendChild(span);
}
