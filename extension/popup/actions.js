async function handleSendReattempts() {
    if (isLoading) return;

    const selectedDSPs = Object.keys(availableDSPs || {});
    if (selectedDSPs.length === 0) {
        showToast('⚠️ No DSP webhooks configured in Settings', 'error');
        return;
    }

    try {
        setButtonLoading(elements.sendReattemptsButton, true);
        try {
            const preview = await browser.runtime.sendMessage({ action: 'previewFailedReattemptStats' });
            if (preview?.success) {
                const { totalRows = 0, matchedTimeWindow = 0, matchedAddress = 0 } = preview;
                showToast(`Preview: ${matchedTimeWindow}/${totalRows} TW, ${matchedAddress}/${totalRows} Address. Sending...`, 'loading');
            }
        } catch {}
        showToast('Collecting Backbrief data and sending...', 'loading');

        const result = await browser.runtime.sendMessage({ action: 'runFailedReattemptReport' });
        if (result?.success) {
            const { sent = 0, dspsNotified = 0 } = result;
            if (sent > 0) {
                showToast(`✅ Sent ${sent} message(s) across ${dspsNotified} DSP(s)`, 'success');
            } else {
                showToast('✅ No failed shipments to send', 'success');
            }
        } else {
            showToast(result?.error || 'Failed to send reattempts', 'error');
        }
    } catch (e) {
        console.error('Send reattempts failed:', e);
        showToast(`❌ ${e.message}`, 'error');
    } finally {
        setButtonLoading(elements.sendReattemptsButton, false);
    }
}

async function handleSendSummary() {
    if (isLoading) return;

    const selectedDSPs = Object.keys(availableDSPs || {});
    if (selectedDSPs.length === 0) {
        showToast('⚠️ No DSP webhooks configured in Settings', 'error');
        return;
    }

    try {
        setButtonLoading(elements.sendSummaryButton, true);
        showToast('Generating and sending summaries...', 'loading');

        let tabs = await browser.tabs.query({ active: true, currentWindow: true });
        let targetTab = tabs && tabs[0];
        let isRoutePlanning = !!(targetTab?.url && targetTab.url.includes('.route.planning.last-mile.a2z.com/route-planning'));
        if (!isRoutePlanning) {
            const matches = await browser.tabs.query({ url: '*://*.route.planning.last-mile.a2z.com/route-planning/*' });
            if (matches && matches.length > 0) {
                targetTab = matches[0];
            } else {
                const { settings = {} } = await browser.storage.local.get('settings');
                const base = settings.routePlanningBaseUrl || 'https://eu.route.planning.last-mile.a2z.com/route-planning';
                const today = computeDateParam('other');
                let targetUrl = base;
                try {
                    const u = new URL(base);
                    if (/\/route-planning\/[A-Z0-9]+\/.+/.test(u.pathname)) {
                        targetUrl = `${u.origin}${u.pathname}/${today}`;
                    }
                } catch {}
                console.log('🆕 Opening Route Planning page (fallback)...');
                targetTab = await browser.tabs.create({ url: targetUrl, active: false });
                await new Promise(r => setTimeout(r, 7000));
            }
        }

        let overridePaidTime = null;
        try {
            const { settings = {} } = await browser.storage.local.get('settings');
            if (settings.paidTimeInferFromConstraints === true) {
                const base = settings.routePlanningBaseUrl || '';
                if (base) {
                    let constraintsUrl = base.replace('://eu.route.planning.last-mile.a2z.com/route-planning', '://eu.dispatch.planning.last-mile.a2z.com/route-constraints');
                    try {
                        const u = new URL(constraintsUrl);
                        const today = computeDateParam('other');
                        if (!/\d{4}-\d{2}-\d{2}$/.test(u.pathname)) {
                            constraintsUrl = `${u.origin}${u.pathname}/${today}`;
                        }
                    } catch {}
                    let ctab;
                    const matchesC = await browser.tabs.query({ url: '*://eu.dispatch.planning.last-mile.a2z.com/route-constraints/*' });
                    if (matchesC && matchesC.length > 0) {
                        ctab = matchesC[0];
                        await browser.tabs.update(ctab.id, { url: constraintsUrl, active: false });
                    } else {
                        ctab = await browser.tabs.create({ url: constraintsUrl, active: false });
                    }
                    await new Promise(r => setTimeout(r, 6000));
                    try {
                        const resPT = await browser.tabs.sendMessage(ctab.id, { action: 'getPaidTimeFromConstraints' });
                        if (resPT?.success && Number.isFinite(resPT.minutes) && resPT.minutes > 0) {
                            overridePaidTime = resPT.minutes;
                        }
                    } catch (e) {
                        console.warn('Paid time inference messaging failed:', e);
                    }
                }
            }
        } catch (e) { console.warn('Paid time inference skipped:', e); }

        const response = await browser.tabs.sendMessage(targetTab.id, {
            action: 'getDSPSummary',
            dsps: selectedDSPs,
            overridePaidTime: overridePaidTime
        });

        if (!response?.success) {
            throw new Error(response?.error || 'Failed to generate summaries');
        }

        const { items = {}, paidTime } = response;
        let success = 0; let failed = 0;
        const _now = new Date();
        const todayStr = `${String(_now.getDate()).padStart(2, '0')}.${String(_now.getMonth() + 1).padStart(2, '0')}.${_now.getFullYear()}`;

        for (const dsp of selectedDSPs) {
            const item = items[dsp];
            if (!item) {
                failed++;
                console.warn(`No data found for ${dsp}`);
                continue;
            }

            const { avgShift, avgSpr } = item;
            const message =
                `/md 📋 Daily Route Planning Summary\n\n` +
                `🚚 ${dsp} | ${todayStr}\n\n` +
                `📦 SPR: ${avgSpr}\n` +
                `⏱️ Shift Time: ${avgShift} min\n` +
                `💰 Paid Time: ${paidTime} min`;

            const result = await browser.runtime.sendMessage({
                action: 'sendMessage',
                dsp,
                message
            });

            if (result?.success) success++; else failed++;
            await new Promise(r => setTimeout(r, 600));
        }

        if (success > 0 && failed === 0) {
            showToast(`✅ Sent ${success} summary${success !== 1 ? 'ies' : ''}`, 'success');
        } else if (success > 0) {
            showToast(`⚠️ Sent ${success}, failed ${failed}`, 'error');
        } else {
            showToast('❌ Failed to send any summaries', 'error');
        }
    } catch (error) {
        console.error('Send summary failed:', error);
        showToast(`❌ ${error.message}`, 'error');
    } finally {
        setButtonLoading(elements.sendSummaryButton, false);
    }
}

async function handleCheckNow() {
    if (isLoading) return;

    console.log('🔍 Manual check requested');
    setButtonLoading(elements.checkNowButton, true);
    showToast('Checking for mismatches...', 'loading');

    try {
        try {
            const [{ serviceTypes = {} } = {}, { settings = {} } = {}] = await Promise.all([
                browser.storage.local.get('serviceTypes'),
                browser.storage.local.get('settings')
            ]);
            const cycle1Enabled = serviceTypes.cycle1 !== false;
            const dateStr = computeDateParam(cycle1Enabled ? 'cycle1' : 'other');
            const saId = settings.serviceAreaId || '';
            const baseUrl = 'https://logistics.amazon.co.uk/internal/scheduling/dsps';
            const params = new URLSearchParams();
            if (saId) params.set('serviceAreaId', saId);
            params.set('date', dateStr);
            const targetUrl = `${baseUrl}?${params.toString()}`;

            let rosteringTabs = await browser.tabs.query({ url: baseUrl + '*' });
            if (!rosteringTabs || rosteringTabs.length === 0) {
                console.log('🆕 Opening rostering page (fallback)...');
                await browser.tabs.create({ url: targetUrl, active: false });
                await new Promise(r => setTimeout(r, 5000));
            }
        } catch (e) {
            console.warn('Rostering fallback open failed or skipped:', e);
        }

        const response = await browser.runtime.sendMessage({ action: "manualCheck" });
        if (response?.success) {
            showToast('✅ Mismatch check completed successfully!', 'success');
        } else {
            throw new Error(response?.error || 'Check failed');
        }
    } catch (error) {
        console.error('❌ Check failed:', error);
        showToast(`❌ ${error.message}`, 'error');
    } finally {
        setButtonLoading(elements.checkNowButton, false);
    }
}

async function handleSendMessage() {
    if (isLoading) return;

    const selectedDSPs = getSelectedDSPs();
    const message = elements.messageInput?.value?.trim() || '';

    console.log('📤 Send message requested:', {
        dspCount: selectedDSPs.length,
        messageLength: message.length
    });

    const validationError = validateMessageForm(selectedDSPs, message);
    if (validationError) {
        showToast(validationError, 'error');
        return;
    }

    setButtonLoading(elements.sendMessageButton, true);
    showToast(`Sending message to ${selectedDSPs.length} DSP${selectedDSPs.length > 1 ? 's' : ''}...`, 'loading');

    const results = await sendMessagesToAllDSPs(selectedDSPs, message);
    handleSendResults(results, message);

    setButtonLoading(elements.sendMessageButton, false);
}

function validateMessageForm(selectedDSPs, message) {
    if (selectedDSPs.length === 0) {
        const targetType = document.querySelector('input[name="targetType"]:checked')?.value;
        if (targetType === 'individual' && elements.dspSelect) {
            elements.dspSelect.focus();
        }
        return '⚠️ Please select at least one DSP';
    }

    if (!message) {
        if (elements.messageInput) {
            elements.messageInput.focus();
        }
        return '⚠️ Please enter a message';
    }

    if (message.length > 2000) {
        return '⚠️ Message is too long (max 2000 characters)';
    }

    return null;
}

async function sendMessagesToAllDSPs(selectedDSPs, message) {
    const results = { success: 0, failed: 0, errors: [] };

    for (const [index, dsp] of selectedDSPs.entries()) {
        try {
            console.log(`📤 Sending message to ${dsp} (${index + 1}/${selectedDSPs.length})`);
            const result = await browser.runtime.sendMessage({
                action: "sendMessage",
                dsp,
                message
            });

            if (result?.success) {
                results.success++;
            } else {
                results.failed++;
                results.errors.push(`${dsp}: ${result?.error || 'Unknown error'}`);
            }
        } catch (error) {
            console.error(`❌ Error sending to ${dsp}:`, error);
            results.failed++;
            results.errors.push(`${dsp}: ${error.message}`);
        }

        if (selectedDSPs.length > 1) {
            showToast(`Sending messages... ${index + 1}/${selectedDSPs.length}`, 'loading');
        }
        await new Promise(resolve => setTimeout(resolve, 800));
    }

    return results;
}

function handleSendResults(results, message) {
    console.log('📊 Message sending results:', results);

    if (results.failed === 0) {
        showToast(`✅ Messages sent successfully to ${results.success} DSP${results.success > 1 ? 's' : ''}!`, 'success');
        if (elements.messageInput) {
            elements.messageInput.value = '';
            updateCharacterCount();
        }
    } else if (results.success === 0) {
        showToast(`❌ Failed to send messages: ${results.errors[0] || 'Unknown error'}`, 'error');
    } else {
        showToast(`⚠️ Partial success: ${results.success} sent, ${results.failed} failed`, 'error');
        console.log('📋 Detailed errors:', results.errors);
    }
}

function handleOpenSettings() {
    try {
        console.log('⚙️ Opening settings page');
        if (browser.runtime.openOptionsPage) {
            browser.runtime.openOptionsPage();
        } else {
            const optionsUrl = browser.runtime.getURL('options/options.html');
            browser.tabs.create({ url: optionsUrl });
        }
    } catch (error) {
        console.error('❌ Error opening settings:', error);
        showToast('Failed to open settings page', 'error');
    }
}
