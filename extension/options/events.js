function setupEventListeners() {
    console.log('🔧 Setting up event listeners');

    if (elements.addWebhookBtn) {
        elements.addWebhookBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (isLoading) return;
            addWebhookEntry();
        });
    }

    if (elements.enableNotifications) {
        elements.enableNotifications.addEventListener('change', async (e) => {
            if (isLoading) return;
            const enabled = e.target.checked;
            try {
                await saveNotificationSettings(enabled);
                try {
                    await browser.runtime.sendMessage({
                        action: 'updateNotificationSettings',
                        enabled
                    });
                } catch (runtimeError) {
                    console.warn('⚠️ Could not communicate with background script:', runtimeError);
                }
                showToast(`Master notifications ${enabled ? 'enabled' : 'disabled'} successfully!`, 'success');
                if (enabled) {
                    setTimeout(() => loadAlarmStatus(), 1000);
                } else {
                    clearAlarmStatus();
                }
            } catch (error) {
                console.error('❌ Error updating notification settings:', error);
                showToast('Failed to update notification settings', 'error');
                e.target.checked = !enabled;
            }
        });
    }

    Object.entries(SERVICE_TYPES).forEach(([serviceType, config]) => {
        const element = elements[config.elementId];
        const timingElement = elements[config.timingId];
        if (!element) return;
        element.addEventListener('change', async (e) => {
            if (isLoading) return;
            const enabled = e.target.checked;
            if (timingElement) {
                timingElement.style.display = enabled ? 'block' : 'none';
            }
            try {
                await saveServiceTypeSettings();
                showToast(`${config.name} ${enabled ? 'enabled' : 'disabled'}`, 'success');
                setTimeout(() => loadAlarmStatus(), 1000);
            } catch (error) {
                console.error(`❌ Error updating ${serviceType} settings:`, error);
                showToast(`Failed to update ${config.name} settings`, 'error');
                e.target.checked = !enabled;
                if (timingElement) {
                    timingElement.style.display = !enabled ? 'block' : 'none';
                }
            }
        });
    });

    setupBatchInputListeners();

    [elements.paidTimeMinutes, elements.formatChimeManual, elements.serviceAreaId]
        .filter(Boolean)
        .forEach(el => {
            el.addEventListener('change', saveGeneralSettings);
            el.addEventListener('blur', saveGeneralSettings);
        });
    [elements.schedulingUrl, elements.routePlanningUrl]
        .filter(Boolean)
        .forEach(el => {
            el.addEventListener('change', saveGeneralSettings);
            el.addEventListener('blur', saveGeneralSettings);
        });

    const thresholdInputs = [elements.thrBc, elements.thrBcResidential, elements.thrCna, elements.thrCnaFactor, elements.thrMissing, elements.thrUta, elements.thrUtl, elements.thrRejected, elements.thrRenotifyStep];
    thresholdInputs.filter(Boolean).forEach(el => {
        el.addEventListener('change', saveGeneralSettings);
        el.addEventListener('blur', saveGeneralSettings);
    });

    if (elements.enableRiskAlerts) {
        elements.enableRiskAlerts.addEventListener('change', saveGeneralSettings);
    }
    if (elements.riskDashboardUrl) {
        elements.riskDashboardUrl.addEventListener('change', saveGeneralSettings);
        elements.riskDashboardUrl.addEventListener('blur', saveGeneralSettings);
    }
    if (elements.slackWebhookUrl) {
        elements.slackWebhookUrl.addEventListener('change', saveGeneralSettings);
        elements.slackWebhookUrl.addEventListener('blur', saveGeneralSettings);
    }
    if (elements.slackUseChimeMarkdown) {
        elements.slackUseChimeMarkdown.addEventListener('change', saveGeneralSettings);
    }
    if (elements.inferPaidTime) {
        elements.inferPaidTime.addEventListener('change', saveGeneralSettings);
    }

    if (elements.failedBackbriefUrl) {
        elements.failedBackbriefUrl.addEventListener('change', saveGeneralSettings);
        elements.failedBackbriefUrl.addEventListener('blur', saveGeneralSettings);
    }
    if (elements.failedChunkSize) {
        elements.failedChunkSize.addEventListener('change', saveGeneralSettings);
        elements.failedChunkSize.addEventListener('blur', saveGeneralSettings);
    }
    if (elements.failedAutoEnabled) {
        elements.failedAutoEnabled.addEventListener('change', async (e) => {
            await saveGeneralSettings();
            try { await browser.runtime.sendMessage({ action: 'configureFailedReattemptsAlarm' }); } catch {}
        });
    }
    if (elements.failedSendTime) {
        elements.failedSendTime.addEventListener('change', async () => {
            await saveGeneralSettings();
            try { await browser.runtime.sendMessage({ action: 'configureFailedReattemptsAlarm' }); } catch {}
        });
        elements.failedSendTime.addEventListener('blur', saveGeneralSettings);
    }
    ['BUSINESS_CLOSED','LOCKER_ISSUE','UNABLE_TO_LOCATE_ADDRESS','UNABLE_TO_ACCESS','OTP_NOT_AVAILABLE','ITEMS_MISSING'].forEach(rid => {
        const el = elements['fr_' + rid];
        if (el) el.addEventListener('change', saveGeneralSettings);
    });

    if (elements.testRiskScan) {
        elements.testRiskScan.addEventListener('click', async () => {
            showToast('Running risk scan...', 'loading');
            try {
                const res = await browser.runtime.sendMessage({ action: 'riskScanNow' });
                if (res?.success) {
                    const s = res.stats || {};
                    if ((s.flagged || 0) > 0 && (s.notified || 0) === 0) {
                        showToast(`Flagged ${s.flagged} but sent 0. Check DSP webhooks and Slack URL.`, 'warning');
                    } else {
                        showToast(`Risk scan: flagged ${s.flagged || 0}, notified ${s.notified || 0}`, 'success');
                    }
                } else {
                    showToast(res?.error || 'Risk scan failed', 'error');
                }
            } catch (e) {
                showToast(e.message || 'Risk scan failed', 'error');
            }
        });
    }

    if (elements.resetRiskDedupe) {
        elements.resetRiskDedupe.addEventListener('click', async () => {
            try {
                await browser.runtime.sendMessage({ action: 'resetRiskDedupe' });
                showToast("Today's alert state cleared", 'success');
            } catch (e) {
                showToast('Reset failed: ' + (e.message || 'unknown error'), 'error');
            }
        });
    }

    if (elements.manifestUpload) {
        elements.manifestUpload.addEventListener('change', handleManifestUpload);
    }
    if (elements.clearManifestMap) {
        elements.clearManifestMap.addEventListener('click', async () => {
            await browser.storage.local.remove('uploadedManifestMap');
            updateManifestStatus(null);
            showToast('Cleared uploaded manifest', 'success');
        });
    }
    const sendReattemptsNowBtn = document.getElementById('sendReattemptsNow');
    if (sendReattemptsNowBtn) {
        sendReattemptsNowBtn.addEventListener('click', sendReattemptsUsingManifest);
    }

    if (elements.backbriefUpload) {
        elements.backbriefUpload.addEventListener('change', handleBackbriefUpload);
    }
    const clearBackbriefBtn = document.getElementById('clearBackbriefData');
    if (clearBackbriefBtn) {
        clearBackbriefBtn.addEventListener('click', async () => {
            await browser.storage.local.remove('uploadedBackbriefRows');
            updateBackbriefStatus(null);
            showToast('Cleared uploaded backbrief', 'success');
        });
    }
    const sendBackbriefNowBtn = document.getElementById('sendBackbriefNow');
    if (sendBackbriefNowBtn) {
        sendBackbriefNowBtn.addEventListener('click', sendReattemptsUsingBackbrief);
    }

    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            saveWebhooks();
        }
        if (e.key === 'Escape') {
            hideToast();
        }
    });

    window.addEventListener('beforeunload', () => {
        console.log('💾 Page unloading, saving webhooks...');
        saveWebhooks();
    });

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            console.log('💾 Page hidden, saving webhooks...');
            saveWebhooks();
        }
    });

    console.log('✅ Event listeners set up successfully');
}
