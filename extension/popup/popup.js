if (typeof browser === 'undefined' && typeof chrome !== 'undefined') {
    var browser = chrome;
}

// Application state
let availableDSPs = {};
let isLoading = false;

// DOM elements
let elements = {};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('🎉 Modern popup initializing...');

    // Cache DOM elements
    cacheElements();

    // Setup event listeners
    setupEventListeners();

    // Load DSP options
    loadDSPOptions();

    // Setup character counter
    setupCharacterCounter();

    console.log('✅ Popup initialized successfully');
});

function cacheElements() {
    elements = {
        dspSelect: document.getElementById('dspSelect'),
        checkboxContainer: document.getElementById('dspCheckboxes'),
        totalDspCount: document.getElementById('totalDspCount'),
        sendButtonText: document.getElementById('sendButtonText'),
        messageInput: document.getElementById('message'),
        charCount: document.getElementById('charCount'),
        checkNowButton: document.getElementById('checkNow'),
        sendSummaryButton: document.getElementById('sendSummary'),
        sendReattemptsButton: document.getElementById('sendReattempts'),
        sendMessageButton: document.getElementById('sendMessage'),
        openSettingsButton: document.getElementById('openSettings'),
        individualDspGroup: document.getElementById('individualDspGroup'),
        multipleDspGroup: document.getElementById('multipleDspGroup'),
        allDspGroup: document.getElementById('allDspGroup'),
        connectionStatus: document.getElementById('connectionStatus'),
        toast: document.getElementById('status')
    };
}

function setupEventListeners() {
    // Target type radio buttons
    document.querySelectorAll('input[name="targetType"]').forEach(radio => {
        radio.addEventListener('change', handleTargetTypeChange);
    });

    // Check Now button
    if (elements.checkNowButton) {
        elements.checkNowButton.addEventListener('click', handleCheckNow);
    }

    // Send Message button
    if (elements.sendMessageButton) {
        elements.sendMessageButton.addEventListener('click', handleSendMessage);
    }

    // Send DSP Summary button
    if (elements.sendSummaryButton) {
        elements.sendSummaryButton.addEventListener('click', handleSendSummary);
    }

    // Send Failed Reattempts button
    if (elements.sendReattemptsButton) {
        elements.sendReattemptsButton.addEventListener('click', handleSendReattempts);
    }

    // Settings button
    if (elements.openSettingsButton) {
        elements.openSettingsButton.addEventListener('click', handleOpenSettings);
    }

    // Message input
    if (elements.messageInput) {
        elements.messageInput.addEventListener('input', handleMessageInput);
        elements.messageInput.addEventListener('keydown', handleKeydown);
    }

    // Global keyboard shortcuts
    document.addEventListener('keydown', handleGlobalKeydown);
}

async function handleSendReattempts() {
    if (isLoading) return;

    // Ensure we have DSP webhooks
    const selectedDSPs = Object.keys(availableDSPs || {});
    if (selectedDSPs.length === 0) {
        showToast('⚠️ No DSP webhooks configured in Settings', 'error');
        return;
    }

    try {
        setButtonLoading(elements.sendReattemptsButton, true);
        // Preview match stats first
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

    // Always send to all configured DSPs
    const selectedDSPs = Object.keys(availableDSPs || {});
    if (selectedDSPs.length === 0) {
        showToast('⚠️ No DSP webhooks configured in Settings', 'error');
        return;
    }

    try {
        setButtonLoading(elements.sendSummaryButton, true);
        showToast('Generating and sending summaries...', 'loading');

        // Find a Route Planning tab (active first, else any matching). If none, open a new one.
        let tabs = await browser.tabs.query({ active: true, currentWindow: true });
        let targetTab = tabs && tabs[0];
        let isRoutePlanning = !!(targetTab?.url && targetTab.url.includes('.route.planning.last-mile.a2z.com/route-planning'));
        if (!isRoutePlanning) {
            const matches = await browser.tabs.query({ url: '*://*.route.planning.last-mile.a2z.com/route-planning/*' });
            if (matches && matches.length > 0) {
                targetTab = matches[0];
            } else {
                // Build from configured base URL, else generic
                const { settings = {} } = await browser.storage.local.get('settings');
                const base = settings.routePlanningBaseUrl || 'https://eu.route.planning.last-mile.a2z.com/route-planning';
                const today = computeDateParam('other'); // today
                let targetUrl = base;
                try {
                    // If base is the root, just open it; else append date /YYYY-MM-DD
                    const u = new URL(base);
                    if (/\/route-planning\/[A-Z0-9]+\/.+/.test(u.pathname)) {
                        targetUrl = `${u.origin}${u.pathname}/${today}`;
                    }
                } catch (e) {}
                console.log('🆕 Opening Route Planning page (fallback)...');
                targetTab = await browser.tabs.create({ url: targetUrl, active: false });
                await new Promise(r => setTimeout(r, 7000));
            }
        }

        // Optionally infer Paid Time from Constraints page
        let overridePaidTime = null;
        try {
            const { settings = {} } = await browser.storage.local.get('settings');
            if (settings.paidTimeInferFromConstraints === true) {
                // Build constraints URL from routePlanningBaseUrl
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

        // Ask content script for per-DSP summary values
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

        // Compute today's date string for message context (European format DD.MM.YYYY)
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
            // Build Chime Markdown message using the requested concise format
            // Example:
            // 📋 Daily Route Planning Summary
            //
            // 🚚 SPTN | 08.09.2025
            //
            // 📦 SPR: 167
            // ⏱️ Shift Time: 504 min
            // 💰 Paid Time: 525 min
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

            // Gentle pacing
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

async function loadDSPOptions() {
    try {
        console.log('📡 Loading DSP options...');
        updateConnectionStatus('loading');

        if (!browser?.storage?.local) {
            throw new Error('Browser storage not available');
        }

        const { webhooks = {} } = await browser.storage.local.get('webhooks');
        console.log('✅ Loaded webhooks:', Object.keys(webhooks));

        availableDSPs = webhooks;
        const dspCodes = Object.keys(webhooks);

        clearDSPOptions();

        if (dspCodes.length === 0) {
            showEmptyDSPState();
            updateConnectionStatus('disconnected');
            return;
        }

        populateDSPOptions(dspCodes);
        updateConnectionStatus('ready');

        console.log(`✅ Loaded ${dspCodes.length} DSP options successfully`);

    } catch (error) {
        console.error('❌ Error loading DSP options:', error);
        showToast('Failed to load DSP configuration', 'error');
        updateConnectionStatus('error');
    }
}

function clearDSPOptions() {
    // Clear select dropdown (keep first option)
    if (elements.dspSelect) {
        while (elements.dspSelect.options.length > 1) {
            elements.dspSelect.remove(1);
        }
    }

    // Clear checkbox container
    if (elements.checkboxContainer) {
        // Safe way to clear content without innerHTML
        while (elements.checkboxContainer.firstChild) {
            elements.checkboxContainer.removeChild(elements.checkboxContainer.firstChild);
        }
    }
}

function showEmptyDSPState() {
    if (elements.checkboxContainer) {
        // Safe way to create elements without innerHTML
        const emptyDiv = document.createElement('div');
        emptyDiv.style.cssText = 'text-align: center; padding: 20px; color: var(--text-muted);';

        const title = document.createElement('p');
        const titleStrong = document.createElement('strong');
        titleStrong.textContent = 'No DSPs configured';
        title.appendChild(titleStrong);

        const description = document.createElement('p');
        description.style.cssText = 'font-size: 12px; margin-top: 4px;';
        description.textContent = 'Add webhook URLs in Settings to get started';

        emptyDiv.appendChild(title);
        emptyDiv.appendChild(description);
        elements.checkboxContainer.appendChild(emptyDiv);
    }

    if (elements.totalDspCount) {
        elements.totalDspCount.textContent = '0';
    }

    // Disable send button
    if (elements.sendMessageButton) {
        elements.sendMessageButton.disabled = true;
        elements.sendMessageButton.title = 'Configure DSPs in Settings first';
    }
}

function populateDSPOptions(dspCodes) {
    // Sort DSP codes alphabetically
    const sortedDspCodes = dspCodes.sort();

    // Populate select dropdown
    if (elements.dspSelect) {
        sortedDspCodes.forEach(dspCode => {
            const option = document.createElement('option');
            option.value = dspCode;
            option.textContent = dspCode;
            elements.dspSelect.appendChild(option);
        });
    }

    // Populate checkbox container safely
    if (elements.checkboxContainer) {
        // Clear existing content safely
        while (elements.checkboxContainer.firstChild) {
            elements.checkboxContainer.removeChild(elements.checkboxContainer.firstChild);
        }

        // Create checkboxes safely without innerHTML
        sortedDspCodes.forEach(dspCode => {
            const optionDiv = document.createElement('div');
            optionDiv.className = 'checkbox-option';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `dsp-${dspCode}`;
            checkbox.value = dspCode;

            const label = document.createElement('label');
            label.htmlFor = `dsp-${dspCode}`;
            label.className = 'checkbox-label';
            label.textContent = dspCode;

            optionDiv.appendChild(checkbox);
            optionDiv.appendChild(label);
            elements.checkboxContainer.appendChild(optionDiv);
        });
    }

    // Update total count
    if (elements.totalDspCount) {
        elements.totalDspCount.textContent = sortedDspCodes.length;
    }

    // Enable send button
    if (elements.sendMessageButton) {
        elements.sendMessageButton.disabled = false;
        elements.sendMessageButton.title = '';
    }
}

function handleTargetTypeChange(event) {
    const targetType = event.target.value;
    console.log('🎯 Target type changed:', targetType);

    // Hide all groups
    if (elements.individualDspGroup) elements.individualDspGroup.style.display = 'none';
    if (elements.multipleDspGroup) elements.multipleDspGroup.style.display = 'none';
    if (elements.allDspGroup) elements.allDspGroup.style.display = 'none';

    // Show relevant group and update button text
    switch (targetType) {
        case 'individual':
            if (elements.individualDspGroup) elements.individualDspGroup.style.display = 'block';
            if (elements.sendButtonText) elements.sendButtonText.textContent = 'Send Message';
            break;
        case 'multiple':
            if (elements.multipleDspGroup) elements.multipleDspGroup.style.display = 'block';
            if (elements.sendButtonText) elements.sendButtonText.textContent = 'Send to Selected';
            break;
        case 'all':
            if (elements.allDspGroup) elements.allDspGroup.style.display = 'block';
            if (elements.sendButtonText) elements.sendButtonText.textContent = 'Send to All';
            break;
    }
}

function getSelectedDSPs() {
    const targetTypeElement = document.querySelector('input[name="targetType"]:checked');
    const targetType = targetTypeElement ? targetTypeElement.value : 'individual';

    let selectedDSPs = [];

    switch (targetType) {
        case 'individual':
            const selectedDsp = elements.dspSelect?.value || '';
            selectedDSPs = selectedDsp ? [selectedDsp] : [];
            break;

        case 'multiple':
            const checkboxes = document.querySelectorAll('#dspCheckboxes input[type="checkbox"]:checked');
            selectedDSPs = Array.from(checkboxes).map(cb => cb.value);
            break;

        case 'all':
            selectedDSPs = Object.keys(availableDSPs);
            break;
    }

    console.log(`🎯 Selected DSPs (${targetType}):`, selectedDSPs);
    return selectedDSPs;
}

async function handleCheckNow() {
    if (isLoading) {
        console.log('⏳ Already processing, ignoring check request');
        return;
    }

    console.log('🔍 Manual check requested');
    setButtonLoading(elements.checkNowButton, true);
    showToast('Checking for mismatches...', 'loading');

    try {
        // Ensure rostering page is open (fallback): prefer cycle1 date if enabled
        try {
            const [{ serviceTypes = {} } = {}, { settings = {} } = {}] = await Promise.all([
                browser.storage.local.get('serviceTypes'),
                browser.storage.local.get('settings')
            ]);
            const cycle1Enabled = serviceTypes.cycle1 !== false; // default true if unset
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
        console.log('✅ Manual check response:', response);

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

function computeDateParam(serviceType) {
    const now = new Date();
    const date = new Date(now);
    if (serviceType === 'cycle1') {
        date.setDate(date.getDate() + 1);
    }
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

async function handleSendMessage() {
    if (isLoading) {
        console.log('⏳ Already processing, ignoring send request');
        return;
    }

    const selectedDSPs = getSelectedDSPs();
    const message = elements.messageInput?.value?.trim() || '';

    console.log('📤 Send message requested:', {
        dspCount: selectedDSPs.length,
        messageLength: message.length
    });

    // Validation
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
        // Focus appropriate input based on target type
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
                dsp: dsp,
                message: message
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

        // Update progress and add delay between messages
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
            // Fallback for older browsers
            const optionsUrl = browser.runtime.getURL('options/options.html');
            browser.tabs.create({ url: optionsUrl });
        }
    } catch (error) {
        console.error('❌ Error opening settings:', error);
        showToast('Failed to open settings page', 'error');
    }
}

function handleMessageInput() {
    updateCharacterCount();
    validateMessageLength();
}

function updateCharacterCount() {
    const message = elements.messageInput?.value || '';
    if (elements.charCount) {
        elements.charCount.textContent = `${message.length} characters`;

        // Color code based on length
        if (message.length > 1800) {
            elements.charCount.style.color = 'var(--error)';
        } else if (message.length > 1500) {
            elements.charCount.style.color = 'var(--warning)';
        } else {
            elements.charCount.style.color = 'var(--text-muted)';
        }
    }
}

function validateMessageLength() {
    const message = elements.messageInput?.value || '';
    if (message.length > 2000) {
        elements.messageInput.style.borderColor = 'var(--error)';
        showToast('Message too long (max 2000 characters)', 'error');
    } else {
        elements.messageInput.style.borderColor = '';
    }
}

function setupCharacterCounter() {
    // Initialize character count
    updateCharacterCount();
}

function handleKeydown(event) {
    // Ctrl/Cmd + Enter to send message
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault();
        if (elements.sendMessageButton && !elements.sendMessageButton.disabled && !isLoading) {
            console.log('⌨️ Ctrl+Enter pressed, sending message');
            handleSendMessage();
        }
    }
}

function handleGlobalKeydown(event) {
    // Escape to close toast
    if (event.key === 'Escape') {
        hideToast();
    }

    // Ctrl/Cmd + R to refresh DSP list
    if ((event.ctrlKey || event.metaKey) && event.key === 'r') {
        event.preventDefault();
        loadDSPOptions();
    }
}

function setButtonLoading(button, loading) {
    if (!button) return;

    isLoading = loading;

    if (loading) {
        button.disabled = true;
        button.classList.add('loading');
        if (!button.dataset.originalText) {
            button.dataset.originalText = button.textContent;
        }

        // Create loading content safely
        button.textContent = '';

        const loadingSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        loadingSvg.setAttribute('width', '16');
        loadingSvg.setAttribute('height', '16');
        loadingSvg.setAttribute('viewBox', '0 0 24 24');
        loadingSvg.setAttribute('fill', 'none');
        loadingSvg.style.animation = 'spin 1s linear infinite';

        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', '12');
        circle.setAttribute('cy', '12');
        circle.setAttribute('r', '10');
        circle.setAttribute('stroke', 'currentColor');
        circle.setAttribute('stroke-width', '4');
        circle.setAttribute('opacity', '0.25');

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('fill', 'currentColor');
        path.setAttribute('d', 'M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z');
        path.setAttribute('opacity', '0.75');

        loadingSvg.appendChild(circle);
        loadingSvg.appendChild(path);

        const span = document.createElement('span');
        span.textContent = 'Processing...';

        button.appendChild(loadingSvg);
        button.appendChild(span);
    } else {
        button.disabled = false;
        button.classList.remove('loading');
        if (button.dataset.originalText) {
            button.textContent = button.dataset.originalText;
        }
    }
}

function showToast(message, type = 'loading') {
    if (!elements.toast) {
        console.log('🔔 Toast (no element):', message, type);
        return;
    }

    console.log('🔔 Showing toast:', message, type);

    elements.toast.textContent = message;
    elements.toast.className = `toast ${type} show`;

    // Auto-hide non-loading toasts
    if (type !== 'loading') {
        setTimeout(() => {
            hideToast();
        }, type === 'error' ? 6000 : 4000);
    }
}

function hideToast() {
    if (elements.toast) {
        elements.toast.classList.remove('show');
    }
}

function updateConnectionStatus(status) {
    if (!elements.connectionStatus) return;

    const statusDot = elements.connectionStatus.querySelector('.status-dot');
    const statusText = elements.connectionStatus.querySelector('span');

    if (statusDot && statusText) {
        switch (status) {
            case 'ready':
                statusDot.style.background = 'var(--success)';
                statusText.textContent = 'Ready';
                break;
            case 'loading':
                statusDot.style.background = 'var(--warning)';
                statusText.textContent = 'Loading';
                break;
            case 'disconnected':
                statusDot.style.background = 'var(--gray-400)';
                statusText.textContent = 'No DSPs';
                break;
            case 'error':
                statusDot.style.background = 'var(--error)';
                statusText.textContent = 'Error';
                break;
        }
    }
}

// Add spin animation CSS
const style = document.createElement('style');
style.textContent = `
    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }
`;
document.head.appendChild(style);
