if (typeof browser === 'undefined' && typeof chrome !== 'undefined') {
    var browser = chrome;
}

// Application state
let isLoading = false;
let webhookEntryCount = 0;
let lastParsedManifestMap = null;

// DOM elements Cache
let elements = {};

// Service type configuration
const SERVICE_TYPES = {
    cycle1: {
        name: 'Cycle 1 (Standard Parcel)',
        times: ['14:00', '15:00'],
        elementId: 'enableCycle1',
        timingId: 'cycle1Timing'
    },
    samedayB: {
        name: 'Sameday B (Multi-Use)',
        times: ['10:00'],
        elementId: 'enableSamedayB',
        timingId: 'samedayBTiming'
    },
    samedayC: {
        name: 'Sameday C (Sameday Parcel)',
        times: ['14:15'],
        elementId: 'enableSamedayC',
        timingId: 'samedayCTiming'
    }
};

// Initialize DOM
document.addEventListener('DOMContentLoaded', async function() {
    console.log('🎉 Enhanced options page initializing...');

    try {
        // Cache DOM elements
        cacheElements();

        // Set loading state
        setLoading(true);

        // Load settings
        await loadSettings();

        // Setup tabs
        setupTabs();
        await restoreActiveTab();

        // Setup event listeners
        setupEventListeners();

        // Clear loading state
        setLoading(false);

        console.log('✅ Options page initialized successfully');
    } catch (error) {
        console.error('❌ Error during initialization:', error);
        showToast('Failed to initialize settings: ' + error.message, 'error');
        setLoading(false);
    }
});

function cacheElements() {
    elements = {
        webhookEntries: document.getElementById('webhookEntries'),
        addWebhookBtn: document.getElementById('addWebhook'),
        enableNotifications: document.getElementById('enableNotifications'),
        toast: document.getElementById('status'),
        serviceAreaId: document.getElementById('serviceAreaId'),
        schedulingUrl: document.getElementById('schedulingUrl'),
        routePlanningUrl: document.getElementById('routePlanningUrl'),
        urlPreviews: document.getElementById('urlPreviews'),
        paidTimeMinutes: document.getElementById('paidTimeMinutes'),
        formatChimeManual: document.getElementById('formatChimeManual'),
        // Risk alerts
        enableRiskAlerts: document.getElementById('enableRiskAlerts'),
        riskDashboardUrl: document.getElementById('riskDashboardUrl'),
        slackWebhookUrl: document.getElementById('slackWebhookUrl'),
        testRiskScan: document.getElementById('testRiskScan'),
        resetRiskDedupe: document.getElementById('resetRiskDedupe'),
        slackUseChimeMarkdown: document.getElementById('slackUseChimeMarkdown'),
        thrBc: document.getElementById('thrBc'),
        thrBcResidential: document.getElementById('thrBcResidential'),
        thrCna: document.getElementById('thrCna'),
        thrCnaFactor: document.getElementById('thrCnaFactor'),
        thrMissing: document.getElementById('thrMissing'),
        thrUta: document.getElementById('thrUta'),
        thrUtl: document.getElementById('thrUtl'),
        thrRejected: document.getElementById('thrRejected'),
        thrRenotifyStep: document.getElementById('thrRenotifyStep'),
        inferPaidTime: document.getElementById('inferPaidTime'),
        // Failed reattempts
        failedBackbriefUrl: document.getElementById('failedBackbriefUrl'),
        failedChunkSize: document.getElementById('failedChunkSize'),
        failedAutoEnabled: document.getElementById('failedAutoEnabled'),
        failedSendTime: document.getElementById('failedSendTime'),
        fr_BUSINESS_CLOSED: document.getElementById('fr_BUSINESS_CLOSED'),
        fr_LOCKER_ISSUE: document.getElementById('fr_LOCKER_ISSUE'),
        fr_UNABLE_TO_LOCATE_ADDRESS: document.getElementById('fr_UNABLE_TO_LOCATE_ADDRESS'),
        fr_UNABLE_TO_ACCESS: document.getElementById('fr_UNABLE_TO_ACCESS'),
        fr_OTP_NOT_AVAILABLE: document.getElementById('fr_OTP_NOT_AVAILABLE'),
        fr_ITEMS_MISSING: document.getElementById('fr_ITEMS_MISSING'),
        // Service type elements
        enableCycle1: document.getElementById('enableCycle1'),
        enableSamedayB: document.getElementById('enableSamedayB'),
        enableSamedayC: document.getElementById('enableSamedayC'),
        cycle1Timing: document.getElementById('cycle1Timing'),
        samedayBTiming: document.getElementById('samedayBTiming'),
        samedayCTiming: document.getElementById('samedayCTiming'),
        // Batch input elements
        batchDropZone: document.getElementById('batchDropZone'),
        batchTextInput: document.getElementById('batchTextInput'),
        showTextInputBtn: document.getElementById('showTextInput'),
        processBatchBtn: document.getElementById('processBatch'),
        cancelBatchBtn: document.getElementById('cancelBatch'),
        // Manifest upload
        manifestUpload: document.getElementById('manifestUpload'),
        manifestStatus: document.getElementById('manifestStatus'),
        clearManifestMap: document.getElementById('clearManifestMap')
    };

    // Validate required elements
    const requiredElements = ['webhookEntries', 'addWebhookBtn', 'enableNotifications'];
    const missingElements = requiredElements.filter(key => !elements[key]);

    if (missingElements.length > 0) {
        console.error('❌ Missing required DOM elements:', missingElements);
        throw new Error('Required DOM elements not found');
    }
}

function setLoading(loading) {
    isLoading = loading;
    document.body.classList.toggle('loading', loading);

    if (elements.addWebhookBtn) {
        elements.addWebhookBtn.disabled = loading;
    }
}

function setupTabs() {
    try {
        const tabs = Array.from(document.querySelectorAll('.tabs .tab'));
        const main = document.querySelector('.main.tabbed');
        if (!tabs.length || !main) return;
        tabs.forEach(btn => {
            btn.addEventListener('click', async () => {
                const tab = btn.getAttribute('data-tab');
                setActiveTab(tab);
                try { await browser.storage.local.set({ optionsActiveTab: tab }); } catch {}
            });
        });
    } catch (e) {
        console.warn('Tabs setup failed:', e);
    }
}

function setActiveTab(tab) {
    const main = document.querySelector('.main.tabbed');
    const tabs = Array.from(document.querySelectorAll('.tabs .tab'));
    if (!main) return;
    main.setAttribute('data-active-tab', tab);
    tabs.forEach(b => b.classList.toggle('active', b.getAttribute('data-tab') === tab));
}

async function restoreActiveTab() {
    try {
        const { optionsActiveTab } = await browser.storage.local.get('optionsActiveTab');
        const tab = optionsActiveTab || 'general';
        setActiveTab(tab);
    } catch {
        setActiveTab('general');
    }
}

async function loadSettings() {
    if (!browser?.storage?.local) {
        throw new Error('Browser storage API not available');
    }

    try {
        console.log('📡 Loading settings...');

        // Load notification settings
        const notificationResult = await browser.storage.local.get(['notificationsEnabled']);
        const notificationsEnabled = notificationResult.notificationsEnabled !== undefined
            ? notificationResult.notificationsEnabled
            : true;

        console.log('✅ Loaded notification settings:', notificationsEnabled);

        if (elements.enableNotifications) {
            elements.enableNotifications.checked = notificationsEnabled;
        }

        // Load service type settings
        await loadServiceTypeSettings();

        // Load general/output settings
        await loadGeneralSettings();
        // Render URL previews
        await renderUrlPreviews();

        // Load webhooks
        await loadWebhooks();
        // Load uploaded manifest status
        await loadUploadedManifestStatus();
        // Load uploaded backbrief status
        await loadUploadedBackbriefStatus();

        // Load alarm status if notifications are enabled
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
        const chimeFmt = settings.formatManualMessagesForChime !== false; // default true
        const serviceAreaId = settings.serviceAreaId || '';
        const schedulingBaseUrl = settings.schedulingBaseUrl || '';
        const routePlanningBaseUrl = settings.routePlanningBaseUrl || '';
        const riskAlertsEnabled = settings.riskAlertsEnabled === true; // default off
        const riskDashboardUrl = settings.riskDashboardUrl || '';
        const slackWebhookUrl = settings.slackWebhookUrl || '';
        const slackUseChimeMarkdown = settings.slackUseChimeMarkdown === true; // default false
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

        // Failed reattempts
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
        // Failed reattempts defaults
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
            cycle1: true,     // Default enabled
            samedayB: false,
            samedayC: false
        };

        console.log('✅ Loaded service type settings:', serviceTypes);

        // Apply settings to UI
        Object.entries(SERVICE_TYPES).forEach(([serviceType, config]) => {
            const element = elements[config.elementId];
            const timingElement = elements[config.timingId];
            
            if (element) {
                element.checked = serviceTypes[serviceType] || false;
            }
            
            // Show/hide timing info based on enabled state
            if (timingElement) {
                timingElement.style.display = serviceTypes[serviceType] ? 'block' : 'none';
            }
        });

        // Display service type inference status (similar to amzl-scripts data display)
        await displayInferenceStatus(result.lastInferredTypes, result.inferenceTimestamp);

    } catch (error) {
        console.error('❌ Error loading service type settings:', error);
        // Set defaults if error
        Object.entries(SERVICE_TYPES).forEach(([serviceType, config]) => {
            const element = elements[config.elementId];
            if (element) {
                element.checked = serviceType === 'cycle1'; // Only cycle1 enabled by default
            }
        });
    }
}

async function loadWebhooks() {
    try {
        console.log('📡 Loading webhooks...');
        const result = await browser.storage.local.get(['webhooks']);
        const webhooks = result.webhooks || {};

        if (!elements.webhookEntries) {
            throw new Error('Webhook container not found');
        }

        // Clear existing content safely
        clearWebhookEntries();
        webhookEntryCount = 0;

        const webhookKeys = Object.keys(webhooks);
        console.log(`Found ${webhookKeys.length} webhooks:`, webhooks);

        if (webhookKeys.length === 0) {
            showEmptyState();
        } else {
            // Load existing webhooks
            webhookKeys.forEach(dspCode => {
                addWebhookEntry(dspCode, webhooks[dspCode]);
            });
        }

        console.log('✅ Webhooks loaded successfully');
    } catch (error) {
        console.error('❌ Error loading webhooks:', error);
        showToast('Failed to load webhook configuration', 'error');
        showEmptyState();
    }
}

function clearWebhookEntries() {
    if (!elements.webhookEntries) return;

    // Safe way to clear content without innerHTML
    while (elements.webhookEntries.firstChild) {
        elements.webhookEntries.removeChild(elements.webhookEntries.firstChild);
    }
}

function showEmptyState() {
    if (!elements.webhookEntries) return;

    // Create empty state safely without innerHTML
    const emptyDiv = document.createElement('div');
    emptyDiv.className = 'empty-state';

    // Create SVG icon
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '48');
    svg.setAttribute('height', '48');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');

    const path1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path1.setAttribute('d', 'M9 19c-5 0-8-3-8-8s3-8 8-8 8 3 8 8-3 8-8 8z');
    path1.setAttribute('stroke', 'currentColor');
    path1.setAttribute('stroke-width', '2');
    path1.setAttribute('stroke-linecap', 'round');
    path1.setAttribute('stroke-linejoin', 'round');

    const path2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path2.setAttribute('d', 'M24 12h-8m0 0l3-3m-3 3l3 3');
    path2.setAttribute('stroke', 'currentColor');
    path2.setAttribute('stroke-width', '2');
    path2.setAttribute('stroke-linecap', 'round');
    path2.setAttribute('stroke-linejoin', 'round');

    svg.appendChild(path1);
    svg.appendChild(path2);

    // Create title
    const title = document.createElement('h3');
    title.textContent = 'No webhooks configured';

    // Create description
    const description = document.createElement('p');
    description.textContent = 'Add your first DSP webhook to get started with notifications';

    emptyDiv.appendChild(svg);
    emptyDiv.appendChild(title);
    emptyDiv.appendChild(description);

    elements.webhookEntries.appendChild(emptyDiv);
}

function addWebhookEntry(dspCode = '', webhookUrl = '') {
    if (!elements.webhookEntries) {
        console.error('❌ Webhook container not found');
        return;
    }

    // Remove empty state if it exists
    const emptyState = elements.webhookEntries.querySelector('.empty-state');
    if (emptyState) {
        emptyState.remove();
    }

    webhookEntryCount++;
    const entryId = `webhook-entry-${webhookEntryCount}`;

    // Create entry div
    const entryDiv = document.createElement('div');
    entryDiv.className = 'webhook-entry';
    entryDiv.setAttribute('data-entry-id', entryId);

    // Create DSP field
    const dspField = document.createElement('div');
    dspField.className = 'webhook-field';

    const dspLabel = document.createElement('label');
    dspLabel.htmlFor = `${entryId}-dsp`;
    dspLabel.textContent = 'DSP Code';

    const dspInput = document.createElement('input');
    dspInput.type = 'text';
    dspInput.id = `${entryId}-dsp`;
    dspInput.className = 'dsp-code';
    dspInput.placeholder = 'e.g., DHH1';
    dspInput.value = dspCode;
    dspInput.maxLength = 10;
    dspInput.pattern = '[A-Za-z0-9]+';
    dspInput.title = 'DSP code should contain only letters and numbers';
    dspInput.required = true;

    dspField.appendChild(dspLabel);
    dspField.appendChild(dspInput);

    // Create URL field
    const urlField = document.createElement('div');
    urlField.className = 'webhook-field';

    const urlLabel = document.createElement('label');
    urlLabel.htmlFor = `${entryId}-url`;
    urlLabel.textContent = 'Webhook URL';

    const urlInput = document.createElement('input');
    urlInput.type = 'url';
    urlInput.id = `${entryId}-url`;
    urlInput.className = 'webhook-url';
    urlInput.placeholder = 'https://hooks.chime.aws/...';
    urlInput.value = webhookUrl;
    urlInput.required = true;

    urlField.appendChild(urlLabel);
    urlField.appendChild(urlInput);

    // Create actions field
    const actionsField = document.createElement('div');
    actionsField.className = 'webhook-actions';

    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.className = 'remove-webhook';
    removeButton.setAttribute('aria-label', 'Remove this webhook entry');

    // Create SVG for remove button
    const removeSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    removeSvg.setAttribute('width', '14');
    removeSvg.setAttribute('height', '14');
    removeSvg.setAttribute('viewBox', '0 0 24 24');
    removeSvg.setAttribute('fill', 'none');
    removeSvg.setAttribute('aria-hidden', 'true');

    const path1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path1.setAttribute('d', 'M18 6L6 18');
    path1.setAttribute('stroke', 'currentColor');
    path1.setAttribute('stroke-width', '2');
    path1.setAttribute('stroke-linecap', 'round');

    const path2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path2.setAttribute('d', 'M6 6L18 18');
    path2.setAttribute('stroke', 'currentColor');
    path2.setAttribute('stroke-width', '2');
    path2.setAttribute('stroke-linecap', 'round');

    removeSvg.appendChild(path1);
    removeSvg.appendChild(path2);

    const removeText = document.createElement('span');
    removeText.textContent = 'Remove';

    removeButton.appendChild(removeSvg);
    removeButton.appendChild(removeText);

    actionsField.appendChild(removeButton);

    // Assemble the entry
    entryDiv.appendChild(dspField);
    entryDiv.appendChild(urlField);
    entryDiv.appendChild(actionsField);

    elements.webhookEntries.appendChild(entryDiv);

    // Add event listeners
    setupWebhookEntryListeners(entryDiv);

    // Focus the DSP code input if it's empty (new entry)
    if (!dspCode) {
        setTimeout(() => {
            dspInput.focus();
            dspInput.select();
        }, 100);
    }

    // Add smooth entry animation
    entryDiv.style.opacity = '0';
    entryDiv.style.transform = 'translateY(20px)';
    requestAnimationFrame(() => {
        entryDiv.style.transition = 'all 300ms ease';
        entryDiv.style.opacity = '1';
        entryDiv.style.transform = 'translateY(0)';
    });

    console.log(`✅ Added webhook entry for ${dspCode || 'new entry'}`);
}

function setupWebhookEntryListeners(entryDiv) {
    if (!entryDiv) return;

    const removeBtn = entryDiv.querySelector('.remove-webhook');
    const inputs = entryDiv.querySelectorAll('input');

    if (removeBtn) {
        removeBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();

            if (isLoading) return;

            try {
                console.log('🗑️ Removing webhook entry');

                // Animate removal
                entryDiv.style.transition = 'all 300ms ease';
                entryDiv.style.opacity = '0';
                entryDiv.style.transform = 'translateY(-20px)';

                setTimeout(async () => {
                    entryDiv.remove();
                    await saveWebhooks();

                    // Show empty state if no entries left
                    if (elements.webhookEntries && elements.webhookEntries.children.length === 0) {
                        showEmptyState();
                    }
                }, 300);

                showToast('Webhook removed successfully', 'success');
            } catch (error) {
                console.error('❌ Error removing webhook:', error);
                showToast('Failed to remove webhook', 'error');
            }
        });
    }

    inputs.forEach(input => {
        if (!input) return;

        // Auto-save on blur (immediate) and input with debouncing
        input.addEventListener('blur', () => {
            console.log('💾 Input blur event, saving webhooks immediately');
            saveWebhooks();
        });

        input.addEventListener('input', debounce(() => {
            console.log('💾 Input change event, saving webhooks (debounced)');
            saveWebhooks();
        }, 2000));

        // Also save on Enter key
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                console.log('💾 Enter key pressed, saving webhooks immediately');
                saveWebhooks();
            }
        });

        // Add validation feedback
        input.addEventListener('invalid', (e) => {
            const field = e.target.closest('.webhook-field');
            if (field) {
                field.classList.add('error');
            }
        });

        input.addEventListener('input', (e) => {
            const field = e.target.closest('.webhook-field');
            if (field && e.target.checkValidity()) {
                field.classList.remove('error');
            }
        });
    });
}

function setupEventListeners() {
    console.log('🔧 Setting up event listeners');

    // Add webhook button
    if (elements.addWebhookBtn) {
        elements.addWebhookBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            if (isLoading) {
                console.log('⏳ Currently loading, ignoring add webhook request');
                return;
            }

            console.log('➕ Adding new webhook entry');
            addWebhookEntry();
        });

        console.log('✅ Add webhook button listener attached');
    } else {
        console.error('❌ Add webhook button not found');
    }

    // Master notification settings toggle
    if (elements.enableNotifications) {
        elements.enableNotifications.addEventListener('change', async (e) => {
            if (isLoading) return;

            const enabled = e.target.checked;
            console.log('🔔 Master notification setting changed:', enabled);

            try {
                await saveNotificationSettings(enabled);

                // Send message to background script to update alarms
                try {
                    const response = await browser.runtime.sendMessage({
                        action: 'updateNotificationSettings',
                        enabled: enabled
                    });

                    if (response?.success) {
                        console.log('✅ Background script updated successfully');
                    } else {
                        console.warn('⚠️ Background script update failed:', response);
                    }
                } catch (runtimeError) {
                    console.warn('⚠️ Could not communicate with background script:', runtimeError);
                }

                showToast(`Master notifications ${enabled ? 'enabled' : 'disabled'} successfully!`, 'success');

                // Load alarm status if enabled
                if (enabled) {
                    setTimeout(() => loadAlarmStatus(), 1000);
                } else {
                    clearAlarmStatus();
                }
            } catch (error) {
                console.error('❌ Error updating notification settings:', error);
                showToast('Failed to update notification settings', 'error');
                // Revert toggle state
                e.target.checked = !enabled;
            }
        });

        console.log('✅ Master notification toggle listener attached');
    }

    // Service type toggles
    Object.entries(SERVICE_TYPES).forEach(([serviceType, config]) => {
        const element = elements[config.elementId];
        const timingElement = elements[config.timingId];

        if (element) {
            element.addEventListener('change', async (e) => {
                if (isLoading) return;

                const enabled = e.target.checked;
                console.log(`🎯 Service type ${serviceType} changed:`, enabled);

                // Show/hide timing info
                if (timingElement) {
                    timingElement.style.display = enabled ? 'block' : 'none';
                }

                try {
                    await saveServiceTypeSettings();
                    showToast(`${config.name} ${enabled ? 'enabled' : 'disabled'}`, 'success');

                    // Load updated alarm status
                    setTimeout(() => loadAlarmStatus(), 1000);
                } catch (error) {
                    console.error(`❌ Error updating ${serviceType} settings:`, error);
                    showToast(`Failed to update ${config.name} settings`, 'error');
                    // Revert toggle state
                    e.target.checked = !enabled;
                    if (timingElement) {
                        timingElement.style.display = !enabled ? 'block' : 'none';
                    }
                }
            });

            console.log(`✅ Service type ${serviceType} listener attached`);
        }
    });

    // Batch input event listeners
    setupBatchInputListeners();

    // General/output settings listeners
    if (elements.paidTimeMinutes) {
        elements.paidTimeMinutes.addEventListener('change', saveGeneralSettings);
        elements.paidTimeMinutes.addEventListener('blur', saveGeneralSettings);
    }
    if (elements.formatChimeManual) {
        elements.formatChimeManual.addEventListener('change', saveGeneralSettings);
    }
    if (elements.serviceAreaId) {
        elements.serviceAreaId.addEventListener('change', saveGeneralSettings);
        elements.serviceAreaId.addEventListener('blur', saveGeneralSettings);
    }
    if (elements.schedulingUrl) {
        elements.schedulingUrl.addEventListener('change', saveGeneralSettings);
        elements.schedulingUrl.addEventListener('blur', saveGeneralSettings);
    }
    if (elements.routePlanningUrl) {
        elements.routePlanningUrl.addEventListener('change', saveGeneralSettings);
        elements.routePlanningUrl.addEventListener('blur', saveGeneralSettings);
    }
    // Risk alerts listeners
    if (elements.enableRiskAlerts) {
        elements.enableRiskAlerts.addEventListener('change', async () => {
            await saveGeneralSettings();
            // Ask background to (re)configure risk scan alarm
            try { await browser.runtime.sendMessage({ action: 'configureRiskAlarm' }); } catch {}
        });
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
    // Failed reattempts listeners
    if (elements.failedAutoEnabled) {
        elements.failedAutoEnabled.addEventListener('change', async () => {
            await saveGeneralSettings();
            try { await browser.runtime.sendMessage({ action: 'configureFailedReattemptsAlarm' }); } catch {}
        });
    }
    if (elements.failedBackbriefUrl) {
        elements.failedBackbriefUrl.addEventListener('change', saveGeneralSettings);
        elements.failedBackbriefUrl.addEventListener('blur', saveGeneralSettings);
    }
    if (elements.failedChunkSize) {
        elements.failedChunkSize.addEventListener('change', saveGeneralSettings);
        elements.failedChunkSize.addEventListener('blur', saveGeneralSettings);
    }
    if (elements.failedSendTime) {
        elements.failedSendTime.addEventListener('change', async () => {
            await saveGeneralSettings();
            try { await browser.runtime.sendMessage({ action: 'configureFailedReattemptsAlarm' }); } catch {}
        });
        elements.failedSendTime.addEventListener('blur', saveGeneralSettings);
    }
    // Reason checkboxes
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
    // Manifest upload listeners
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
    // Backbrief upload listeners
    elements.backbriefUpload = document.getElementById('backbriefUpload');
    elements.backbriefStatus = document.getElementById('backbriefStatus');
    elements.clearBackbriefData = document.getElementById('clearBackbriefData');
    if (elements.backbriefUpload) {
        elements.backbriefUpload.addEventListener('change', handleBackbriefUpload);
    }
    if (elements.clearBackbriefData) {
        elements.clearBackbriefData.addEventListener('click', async () => {
            await browser.storage.local.remove('uploadedBackbriefRows');
            updateBackbriefStatus(null);
            showToast('Cleared uploaded backbrief', 'success');
        });
    }
    const sendBackbriefNowBtn = document.getElementById('sendBackbriefNow');
    if (sendBackbriefNowBtn) {
        sendBackbriefNowBtn.addEventListener('click', sendReattemptsUsingBackbrief);
    }
    // Threshold listeners
    [elements.thrBc, elements.thrBcResidential, elements.thrCna, elements.thrCnaFactor, elements.thrMissing, elements.thrUta, elements.thrUtl, elements.thrRejected]
      .filter(Boolean)
      .concat([elements.thrRenotifyStep])
      .forEach(el => {
          el.addEventListener('change', saveGeneralSettings);
          el.addEventListener('blur', saveGeneralSettings);
      });
    if (elements.schedulingUrl) {
        elements.schedulingUrl.addEventListener('change', saveGeneralSettings);
        elements.schedulingUrl.addEventListener('blur', saveGeneralSettings);
    }
    if (elements.routePlanningUrl) {
        elements.routePlanningUrl.addEventListener('change', saveGeneralSettings);
        elements.routePlanningUrl.addEventListener('blur', saveGeneralSettings);
    }

    // Global keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey) {
            if (e.key === 's') {
                e.preventDefault();
                console.log('⌨️ Ctrl+S pressed, saving webhooks');
                saveWebhooks();
            }
        }

        // Escape to close toast
        if (e.key === 'Escape') {
            hideToast();
        }
    });

    // Save webhooks before page unload to prevent data loss
    window.addEventListener('beforeunload', () => {
        console.log('💾 Page unloading, saving webhooks...');
        saveWebhooks();
    });

    // Also save when page becomes hidden (for mobile/tab switching)
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            console.log('💾 Page hidden, saving webhooks...');
            saveWebhooks();
        }
    });

    console.log('✅ Event listeners set up successfully');
}

async function loadUploadedManifestStatus() {
    try {
        const { uploadedManifestMap } = await browser.storage.local.get('uploadedManifestMap');
        updateManifestStatus(uploadedManifestMap);
    } catch (e) {
        console.warn('Failed to load manifest status');
    }
}

async function loadUploadedBackbriefStatus() {
    try {
        const { uploadedBackbriefRows } = await browser.storage.local.get('uploadedBackbriefRows');
        updateBackbriefStatus(uploadedBackbriefRows);
    } catch (e) {
        console.warn('Failed to load backbrief status');
    }
}

function updateManifestStatus(state) {
    if (!elements.manifestStatus) return;
    // Clear existing
    while (elements.manifestStatus.firstChild) {
        elements.manifestStatus.removeChild(elements.manifestStatus.firstChild);
    }
    if (!state || !state.count) {
        const span = document.createElement('span');
        span.textContent = 'No manifest uploaded';
        elements.manifestStatus.appendChild(span);
        return;
    }
    const strong = document.createElement('strong');
    strong.textContent = String(state.count);
    const text1 = document.createTextNode(' rows • ');
    const dateSpan = document.createElement('span');
    dateSpan.textContent = state.date || 'Unknown date';
    elements.manifestStatus.appendChild(strong);
    elements.manifestStatus.appendChild(text1);
    elements.manifestStatus.appendChild(dateSpan);
}

function updateBackbriefStatus(state) {
    const el = elements.backbriefStatus;
    if (!el) return;
    while (el.firstChild) el.removeChild(el.firstChild);
    if (!state || !state.count) {
        const span = document.createElement('span');
        span.textContent = 'No backbrief uploaded';
        el.appendChild(span);
        return;
    }
    const strong = document.createElement('strong');
    strong.textContent = String(state.count);
    const text1 = document.createTextNode(' rows • ');
    const dateSpan = document.createElement('span');
    dateSpan.textContent = state.date || 'Unknown date';
    el.appendChild(strong);
    el.appendChild(text1);
    el.appendChild(dateSpan);
}

async function handleManifestUpload(evt) {
    try {
        const file = evt.target.files && evt.target.files[0];
        if (!file) return;
        const name = (file.name || '').toLowerCase();
        let parsed = {};
        if (name.endsWith('.csv')) {
            const text = await file.text();
            parsed = parseManifestCsv(text);
        } else if (name.endsWith('.xls') || name.endsWith('.xlsx')) {
            parsed = await parseManifestExcel(file);
        } else {
            throw new Error('Unsupported file type. Please upload .xls, .xlsx, or .csv');
        }
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        lastParsedManifestMap = parsed;
        const count = Object.keys(parsed).length;
        const state = { date: `${yyyy}-${mm}-${dd}`, count };
        try {
            if (count <= 10000) {
                await browser.storage.local.set({ uploadedManifestMap: { ...state, map: parsed } });
            } else {
                await browser.storage.local.remove('uploadedManifestMap');
            }
        } catch {}
        updateManifestStatus(state);
        showToast(`Loaded ${count} manifest rows${count > 10000 ? ' (in memory only)' : ''}`, 'success');
    } catch (e) {
        console.error('Manifest upload failed:', e);
        showToast('Failed to process manifest CSV', 'error');
    } finally {
        if (elements.manifestUpload) elements.manifestUpload.value = '';
    }
}

function parseManifestCsv(text) {
    // Simple CSV parser
    const rows = [];
    let i = 0, field = '', inQuotes = false, row = [];
    const pushField = () => { row.push(field); field = ''; };
    const pushRow = () => { if (row.length) rows.push(row); row = []; };
    while (i < text.length) {
        const ch = text[i];
        if (inQuotes) {
            if (ch === '"') {
                if (text[i+1] === '"') { field += '"'; i++; }
                else inQuotes = false;
            } else field += ch;
        } else {
            if (ch === '"') inQuotes = true;
            else if (ch === ',') pushField();
            else if (ch === '\n') { pushField(); pushRow(); }
            else if (ch === '\r') {}
            else field += ch;
        }
        i++;
    }
    if (field.length || row.length) { pushField(); pushRow(); }
    if (rows.length === 0) return {};
    const header = rows[0].map(h => normalizeKey(h));
    const idx = {};
    header.forEach((h, i) => { idx[h] = i; });
    const pick = (r, keys) => {
        for (const k of keys) {
            const i = idx[k];
            if (i != null && r[i] != null) return (r[i] || '').trim();
        }
        return '';
    };
    const out = {};
    for (let r = 1; r < rows.length; r++) {
        const cols = rows[r];
        const trackingId = (pick(cols, ['tracking_id','trackingid','tracking','tid','id']) || '').toUpperCase();
        if (!trackingId) continue;
        const address = pick(cols, ['actual_customer_address','customer_address','address']);
        let timeWindow = pick(cols, ['time_window','timewindow','tw']);
        if (!timeWindow) {
            const st = pick(cols, ['start_time','start']);
            const et = pick(cols, ['end_time','end']);
            if (st || et) timeWindow = `${st || ''} - ${et || ''}`.trim();
        }
        if (address || timeWindow) out[trackingId] = { address, timeWindow: timeWindow || 'No Time Window' };
    }
    return out;
}

async function sendReattemptsUsingManifest() {
    try {
        if (!lastParsedManifestMap || !Object.keys(lastParsedManifestMap).length) {
            showToast('Upload a manifest first', 'error');
            return;
        }
        const entries = Object.entries(lastParsedManifestMap);
        const chunkSize = 5000;
        showToast('Uploading manifest to background...', 'loading');
        for (let i = 0; i < entries.length; i += chunkSize) {
            const slice = entries.slice(i, i + chunkSize);
            const chunk = Object.fromEntries(slice);
            await browser.runtime.sendMessage({ action: 'setTempManifestMapChunk', chunk, done: false });
            await new Promise(r => setTimeout(r, 10));
        }
        await browser.runtime.sendMessage({ action: 'setTempManifestMapChunk', chunk: {}, done: true });
        try {
            const preview = await browser.runtime.sendMessage({ action: 'previewFailedReattemptStats' });
            if (preview?.success) {
                const { totalRows = 0, matchedTimeWindow = 0, matchedAddress = 0 } = preview;
                showToast(`Preview: ${matchedTimeWindow}/${totalRows} TW, ${matchedAddress}/${totalRows} Address. Sending...`, 'loading');
            }
        } catch {}
        showToast('Running reattempts with uploaded manifest...', 'loading');
        const res = await browser.runtime.sendMessage({ action: 'runFailedReattemptReport' });
        if (res?.success) {
            const { sent = 0, dspsNotified = 0 } = res;
            showToast(`Sent ${sent} message(s) across ${dspsNotified} DSP(s)`, 'success');
        } else {
            showToast(res?.error || 'Failed to send reattempts', 'error');
        }
    } catch (e) {
        showToast(e.message || 'Failed to send reattempts', 'error');
    }
}

async function parseManifestExcel(file) {
    if (typeof XLSX === 'undefined' || !XLSX || !XLSX.read) {
        throw new Error('Excel parser not available. Please upload CSV or include xlsx.min.js');
    }
    const ab = await file.arrayBuffer();
    const wb = XLSX.read(new Uint8Array(ab), { type: 'array' });
    const out = {};
    const norm = (s) => String(s ?? '').trim();
    const normalizeKey = (h) => String(h ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    const likely = {
        trackingId: ['tracking_id','trackingid','tracking','tid','id'],
        address: ['actual_customer_address','customer_address','address'],
        tw: ['time_window','timewindow','tw'],
        start: ['start_time','start','tw_start','time_window_start','starttime'],
        end: ['end_time','end','tw_end','time_window_end','endtime']
    };
    const pickByHeader = (rowObj, keys) => {
        for (const k of keys) {
            if (rowObj[k] != null && String(rowObj[k]).length) return norm(rowObj[k]);
        }
        return '';
    };
    const headerHas = (hdr, pats) => pats.some(p => hdr.includes(p));
    const findHeaderRow = (rows) => {
        const maxScan = Math.min(rows.length, 15);
        for (let r = 0; r < maxScan; r++) {
            const raw = rows[r] || [];
            const hdr = raw.map(normalizeKey).map(h => h.replace(/^unnamed_.*$/, ''));
            if (!hdr.length) continue;
            const hasTracking = hdr.some(h => headerHas(h, likely.trackingId));
            const hasTW = hdr.some(h => headerHas(h, likely.tw)) || (hdr.some(h => headerHas(h, likely.start)) && hdr.some(h => headerHas(h, likely.end)));
            if (hasTracking && hasTW) return { index: r, header: hdr };
        }
        // fallback: first non-empty row
        for (let r = 0; r < maxScan; r++) {
            const raw = rows[r] || [];
            const hdr = raw.map(normalizeKey);
            if (hdr.some(Boolean)) return { index: r, header: hdr };
        }
        return { index: 0, header: (rows[0] || []).map(normalizeKey) };
    };
    for (const sheetName of wb.SheetNames) {
        const ws = wb.Sheets[sheetName];
        if (!ws) continue;
        const grid = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });
        if (!grid || grid.length < 2) continue;
        const { index: hdrIdx, header } = findHeaderRow(grid);
        const data = grid.slice(hdrIdx + 1);
        for (const arr of data) {
            if (!arr || !arr.length) continue;
            const rowObj = {};
            header.forEach((h, i) => { if (h) rowObj[h] = arr[i]; });
            const trackingId = norm(pickByHeader(rowObj, likely.trackingId)).toUpperCase();
            if (!trackingId) continue;
            const address = pickByHeader(rowObj, likely.address);
            let timeWindow = pickByHeader(rowObj, likely.tw);
            if (!timeWindow) {
                const st = pickByHeader(rowObj, likely.start);
                const et = pickByHeader(rowObj, likely.end);
                if (st || et) timeWindow = `${st || ''} - ${et || ''}`.trim();
            }
            if (address || timeWindow) out[trackingId] = { address, timeWindow: timeWindow || 'No Time Window' };
        }
    }
    return out;
}

function normalizeKey(h) {
    return String(h || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

async function handleBackbriefUpload(evt) {
    try {
        const file = evt.target.files && evt.target.files[0];
        if (!file) return;
        const text = await file.text();
        const rows = parseBackbriefCsv(text);
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        const state = { date: `${yyyy}-${mm}-${dd}`, count: rows.length, rows };
        await browser.storage.local.set({ uploadedBackbriefRows: state });
        updateBackbriefStatus(state);
        showToast(`Uploaded ${state.count} backbrief rows`, 'success');
    } catch (e) {
        console.error('Backbrief upload failed:', e);
        showToast('Failed to process backbrief CSV', 'error');
    } finally {
        if (elements.backbriefUpload) elements.backbriefUpload.value = '';
    }
}

function parseBackbriefCsv(text) {
    // Lightweight CSV parser
    const rows = [];
    let i = 0, field = '', inQuotes = false, row = [];
    const pushField = () => { row.push(field); field = ''; };
    const pushRow = () => { if (row.length) rows.push(row); row = []; };
    while (i < text.length) {
        const ch = text[i];
        if (inQuotes) {
            if (ch === '"') { if (text[i+1] === '"') { field += '"'; i++; } else inQuotes = false; }
            else field += ch;
        } else {
            if (ch === '"') inQuotes = true;
            else if (ch === ',') pushField();
            else if (ch === '\n') { pushField(); pushRow(); }
            else if (ch === '\r') {}
            else field += ch;
        }
        i++;
    }
    if (field.length || row.length) { pushField(); pushRow(); }
    if (rows.length === 0) return [];
    const header = rows[0].map(h => normalizeKey(h));
    const idx = {};
    header.forEach((h, i) => { idx[h] = i; });
    const pick = (r, keys) => {
        for (const k of keys) {
            const i = idx[k];
            if (i != null && r[i] != null) return (r[i] || '').trim();
        }
        return '';
    };
    const out = [];
    for (let r = 1; r < rows.length; r++) {
        const cols = rows[r];
        const trackingId = (pick(cols, ['tracking_id','trackingid','tracking','tid','id']) || '').toUpperCase();
        if (!trackingId) continue;
        const deliveryStation = pick(cols, ['delivery_station','ds','station']);
        const route = pick(cols, ['route','route_id','manifestroutecode']);
        const dspName = (pick(cols, ['dsp_name','dsp','latestdspname','compdadata_latestdspname']) || '').toUpperCase();
        const reason = pick(cols, ['reason','internal_reason_code']);
        const attemptReason = pick(cols, ['attempt_reason','compattemptdata_complatestattemptevent_internalreasoncode']);
        const latestAttempt = pick(cols, ['latest_attempt','attempt_time','compattemptdata_complatestattemptevent_timestamp']);
        const addressType = pick(cols, ['address_type']);
        out.push({ trackingId, deliveryStation, route, dspName, reason, attemptReason, latestAttempt, addressType });
    }
    return out;
}

async function sendReattemptsUsingBackbrief() {
    try {
        // Verify uploaded backbrief exists
        const { uploadedBackbriefRows } = await browser.storage.local.get('uploadedBackbriefRows');
        if (!uploadedBackbriefRows || !Array.isArray(uploadedBackbriefRows.rows) || uploadedBackbriefRows.rows.length === 0) {
            showToast('Upload a Backbrief CSV first', 'error');
            return;
        }
        try {
            const preview = await browser.runtime.sendMessage({ action: 'previewFailedReattemptStats' });
            if (preview?.success) {
                const { totalRows = 0, matchedTimeWindow = 0, matchedAddress = 0 } = preview;
                showToast(`Preview: ${matchedTimeWindow}/${totalRows} TW, ${matchedAddress}/${totalRows} Address. Sending...`, 'loading');
            }
        } catch {}
        showToast('Running reattempts with uploaded Backbrief...', 'loading');
        const res = await browser.runtime.sendMessage({ action: 'runFailedReattemptReport' });
        if (res?.success) {
            const { sent = 0, dspsNotified = 0 } = res;
            showToast(`Sent ${sent} message(s) across ${dspsNotified} DSP(s)`, 'success');
        } else {
            showToast(res?.error || 'Failed to send reattempts', 'error');
        }
    } catch (e) {
        showToast(e.message || 'Failed to send reattempts', 'error');
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
        // Safe parsers with defaults to avoid NaN thresholds breaking alerts
        const pInt = (val, def) => {
            const n = parseInt(String(val ?? ''), 10);
            return Number.isFinite(n) ? n : def;
        };
        const pFloat = (val, def) => {
            const n = parseFloat(String(val ?? ''));
            return Number.isFinite(n) ? n : def;
        };
        const thresholds = {
            bc: pInt(elements.thrBc?.value, 10),
            bcResidential: pInt(elements.thrBcResidential?.value, 5),
            cna: pInt(elements.thrCna?.value, 25),
            cnaOutlierFactor: pFloat(elements.thrCnaFactor?.value, 1.5),
            missing: pInt(elements.thrMissing?.value, 1),
            uta: pInt(elements.thrUta?.value, 5),
            utl: pInt(elements.thrUtl?.value, 5),
            rejected: pInt(elements.thrRejected?.value, 2),
        };
        const renotifyStep = pInt(elements.thrRenotifyStep?.value, 5);
        const paidTimeInferFromConstraints = !!elements.inferPaidTime?.checked;

        // Failed reattempts settings
        const failedBackbriefUrl = (elements.failedBackbriefUrl?.value || '').trim();
        const failedChunkSize = pInt(elements.failedChunkSize?.value, 20);
        const failedAutoEnabled = !!elements.failedAutoEnabled?.checked;
        const failedSendTime = (elements.failedSendTime?.value || '09:00').trim();
        const failedReasons = [
            elements.fr_BUSINESS_CLOSED?.checked ? 'BUSINESS_CLOSED' : null,
            elements.fr_LOCKER_ISSUE?.checked ? 'LOCKER_ISSUE' : null,
            elements.fr_UNABLE_TO_LOCATE_ADDRESS?.checked ? 'UNABLE_TO_LOCATE_ADDRESS' : null,
            elements.fr_UNABLE_TO_ACCESS?.checked ? 'UNABLE_TO_ACCESS' : null,
            elements.fr_OTP_NOT_AVAILABLE?.checked ? 'OTP_NOT_AVAILABLE' : null,
            elements.fr_ITEMS_MISSING?.checked ? 'ITEMS_MISSING' : null,
        ].filter(Boolean);

        // Normalize URLs (strip dates, extract IDs)
        const { schedulingBaseUrl, parsedServiceAreaId } = normalizeSchedulingUrl(schedulingRaw, serviceAreaId);
        const { routePlanningBaseUrl } = normalizeRoutePlanningUrl(routePlanningRaw);

        const result = await browser.storage.local.get(['settings']);
        const settings = result.settings || {};
        settings.paidTimeMinutes = paidTimeMinutes;
        settings.formatManualMessagesForChime = formatManualMessagesForChime;
        settings.serviceAreaId = parsedServiceAreaId;
        settings.schedulingBaseUrl = schedulingBaseUrl;
        settings.routePlanningBaseUrl = routePlanningBaseUrl;
        settings.riskAlertsEnabled = riskAlertsEnabled;
        settings.riskDashboardUrl = riskDashboardUrl;
        settings.slackWebhookUrl = slackWebhookUrl;
        settings.slackUseChimeMarkdown = slackUseChimeMarkdown;
        settings.riskThresholds = thresholds;
        settings.riskRenotifyStep = Number.isFinite(renotifyStep) ? renotifyStep : 5;
        settings.paidTimeInferFromConstraints = paidTimeInferFromConstraints;
        // Failed reattempts
        settings.failedBackbriefUrl = failedBackbriefUrl;
        settings.failedChunkSize = failedChunkSize;
        settings.failedAutoEnabled = failedAutoEnabled;
        settings.failedSendTime = failedSendTime;
        settings.failedReasons = failedReasons.length ? failedReasons : ['BUSINESS_CLOSED','LOCKER_ISSUE','UNABLE_TO_LOCATE_ADDRESS','UNABLE_TO_ACCESS','OTP_NOT_AVAILABLE','ITEMS_MISSING'];

        await browser.storage.local.set({ settings });
        showToast('Saved settings', 'success');
        await renderUrlPreviews();
        // reconfigure alarms affected by settings
        try { await browser.runtime.sendMessage({ action: 'configureRiskAlarm' }); } catch {}
        try { await browser.runtime.sendMessage({ action: 'configureFailedReattemptsAlarm' }); } catch {}
    } catch (error) {
        console.error('❌ Error saving general settings:', error);
        showToast('Failed to save output settings', 'error');
    }
}

// Helpers: URL normalization
function normalizeSchedulingUrl(input, fallbackServiceAreaId) {
    if (!input) {
        return {
            schedulingBaseUrl: fallbackServiceAreaId
                ? `https://logistics.amazon.co.uk/internal/scheduling/dsps?serviceAreaId=${encodeURIComponent(fallbackServiceAreaId)}`
                : '',
            parsedServiceAreaId: fallbackServiceAreaId || ''
        };
    }
    try {
        const url = new URL(input);
        const base = `${url.origin}${url.pathname}`;
        const sa = url.searchParams.get('serviceAreaId') || fallbackServiceAreaId || '';
        const baseParams = new URLSearchParams();
        if (sa) baseParams.set('serviceAreaId', sa);
        return {
            schedulingBaseUrl: sa ? `${base}?${baseParams.toString()}` : base,
            parsedServiceAreaId: sa
        };
    } catch (e) {
        return { schedulingBaseUrl: input, parsedServiceAreaId: fallbackServiceAreaId || '' };
    }
}

function normalizeRoutePlanningUrl(input) {
    if (!input) return { routePlanningBaseUrl: '' };
    try {
        const url = new URL(input);
        // Expect .../route-planning/<station>/<planId>/<date?>
        const parts = url.pathname.split('/').filter(Boolean);
        const rpIndex = parts.findIndex(p => p === 'route-planning');
        if (rpIndex !== -1 && parts.length >= rpIndex + 3) {
            const station = parts[rpIndex + 1];
            const planId = parts[rpIndex + 2];
            const basePath = `/route-planning/${station}/${planId}`;
            return { routePlanningBaseUrl: `${url.origin}${basePath}` };
        }
        // Fallback: return input without trailing date-like segment
        return { routePlanningBaseUrl: input.replace(/\/[0-9]{4}-[0-9]{2}-[0-9]{2}\/?$/, '') };
    } catch (e) {
        return { routePlanningBaseUrl: input.replace(/\/[0-9]{4}-[0-9]{2}-[0-9]{2}\/?$/, '') };
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

        // Send message to background script to update service type alarms
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

async function saveWebhooks() {
    if (isLoading) {
        console.log('⏳ Already loading, skipping save');
        return;
    }

    if (!browser?.storage?.local) {
        console.error('❌ Browser storage API not available');
        showToast('Browser storage not available', 'error');
        return;
    }

    try {
        setLoading(true);
        console.log('💾 Saving webhooks...');

        const webhooks = {};
        const entries = document.querySelectorAll('.webhook-entry');
        const errors = [];

        console.log(`Processing ${entries.length} webhook entries`);

        entries.forEach((entry, index) => {
            const dspCodeInput = entry.querySelector('.dsp-code');
            const webhookUrlInput = entry.querySelector('.webhook-url');

            if (!dspCodeInput || !webhookUrlInput) {
                errors.push(`Entry ${index + 1}: Missing input fields`);
                return;
            }

            const dspCode = dspCodeInput.value.trim().toUpperCase();
            const webhookUrl = webhookUrlInput.value.trim();

            // Clear any existing error states
            const dspField = dspCodeInput.closest('.webhook-field');
            const urlField = webhookUrlInput.closest('.webhook-field');

            if (dspField) dspField.classList.remove('error');
            if (urlField) urlField.classList.remove('error');

            // Validate inputs
            if (dspCode && !webhookUrl) {
                errors.push(`Entry ${index + 1}: DSP code "${dspCode}" is missing webhook URL`);
                if (urlField) urlField.classList.add('error');
                return;
            }

            if (!dspCode && webhookUrl) {
                errors.push(`Entry ${index + 1}: Webhook URL is missing DSP code`);
                if (dspField) dspField.classList.add('error');
                return;
            }

            // Skip empty entries
            if (!dspCode && !webhookUrl) {
                console.log(`Skipping empty entry ${index + 1}`);
                return;
            }

            // Validate URL format
            try {
                new URL(webhookUrl);
            } catch (urlError) {
                errors.push(`Entry ${index + 1}: Invalid webhook URL format`);
                if (urlField) urlField.classList.add('error');
                return;
            }

            // Check for duplicates
            if (webhooks[dspCode]) {
                errors.push(`Entry ${index + 1}: DSP code "${dspCode}" is already configured`);
                if (dspField) dspField.classList.add('error');
                return;
            }

            webhooks[dspCode] = webhookUrl;
            console.log(`✅ Added webhook for ${dspCode}: ${webhookUrl.substring(0, 50)}...`);
        });

        if (errors.length > 0) {
            console.error('❌ Validation errors:', errors);
            showToast(`Validation error: ${errors[0]}`, 'error');
            setLoading(false);
            return;
        }

        await browser.storage.local.set({ webhooks });
        console.log('✅ Webhooks saved successfully to storage:', Object.keys(webhooks));
        console.log('📊 Full webhook data:', webhooks);

        // Verify the save worked by reading it back
        const verification = await browser.storage.local.get('webhooks');
        console.log('🔍 Verification - data read back from storage:', verification.webhooks);

        showToast('Webhook configuration saved successfully!', 'success');

    } catch (error) {
        console.error('❌ Error saving webhooks:', error);
        showToast('Failed to save webhook configuration: ' + error.message, 'error');
    } finally {
        setLoading(false);
    }
}

async function loadAlarmStatus() {
    try {
        console.log('📅 Loading alarm status...');
        const response = await browser.runtime.sendMessage({ action: 'getAlarmStatus' });

        if (response?.success && response.alarms) {
            displayAlarmStatus(response.alarms);
        }
    } catch (error) {
        console.warn('Could not load alarm status:', error);
    }
}

function displayAlarmStatus(alarms) {
    // Find the notification card content
    const notificationCard = document.querySelector('.card:nth-child(2) .card-content');
    if (!notificationCard) return;

    // Remove existing status display
    const existingStatus = notificationCard.querySelector('.alarm-status');
    if (existingStatus) {
        existingStatus.remove();
    }

    if (alarms.length === 0) return;

    // Create alarm status display safely
    const statusDiv = document.createElement('div');
    statusDiv.className = 'alarm-status';
    statusDiv.style.cssText = `
        margin-top: 16px;
        padding: 12px;
        background: var(--success-light);
        border: 1px solid rgba(16, 185, 129, 0.2);
        border-radius: var(--radius);
        font-size: 13px;
    `;

    // Create header
    const headerDiv = document.createElement('div');
    headerDiv.style.cssText = 'display: flex; align-items: center; gap: 8px; margin-bottom: 8px;';

    // Create SVG icon
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '16');
    svg.setAttribute('height', '16');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.style.color = 'var(--success)';

    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', '12');
    circle.setAttribute('cy', '12');
    circle.setAttribute('r', '10');
    circle.setAttribute('stroke', 'currentColor');
    circle.setAttribute('stroke-width', '2');

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M12 6v6l4 2');
    path.setAttribute('stroke', 'currentColor');
    path.setAttribute('stroke-width', '2');
    path.setAttribute('stroke-linecap', 'round');

    svg.appendChild(circle);
    svg.appendChild(path);

    const headerText = document.createElement('strong');
    headerText.textContent = 'Scheduled Checks Active';
    headerText.style.color = 'var(--success)';

    headerDiv.appendChild(svg);
    headerDiv.appendChild(headerText);

    // Create alarm list
    const alarmList = document.createElement('div');

    alarms.forEach(alarm => {
        const alarmDiv = document.createElement('div');
        alarmDiv.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin: 4px 0;';

        const description = document.createElement('span');
        description.style.cssText = 'font-weight: 600; color: var(--text-primary);';
        description.textContent = alarm.description;

        const nextTime = document.createElement('span');
        nextTime.style.cssText = 'color: var(--text-secondary);';
        nextTime.textContent = `Next: ${alarm.nextScheduled}`;

        alarmDiv.appendChild(description);
        alarmDiv.appendChild(nextTime);
        alarmList.appendChild(alarmDiv);
    });

    statusDiv.appendChild(headerDiv);
    statusDiv.appendChild(alarmList);
    notificationCard.appendChild(statusDiv);
}

function clearAlarmStatus() {
    const existingStatus = document.querySelector('.alarm-status');
    if (existingStatus) {
        existingStatus.remove();
    }
}

// Utility functions
function debounce(func, delay) {
    let timeoutId;
    return function (...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
}

function showToast(message, type = 'success') {
    if (!elements.toast) {
        console.log('🔔 Toast (no element):', message, type);
        return;
    }

    console.log('🔔 Showing toast:', message, type);

    elements.toast.textContent = message;
    elements.toast.className = `toast ${type} show`;

    // Auto-hide after delay
    setTimeout(() => {
        hideToast();
    }, type === 'error' ? 6000 : 4000);
}

function hideToast() {
    if (elements.toast) {
        elements.toast.classList.remove('show');
    }
}

// Service Type Inference Display (similar to amzl-scripts data presentation)
async function displayInferenceStatus(lastInferredTypes, inferenceTimestamp) {
    try {
        const inferenceStatusElement = document.getElementById('inferenceStatus');
        const detectedTypesElement = document.getElementById('detectedTypes');
        const inferenceTimeElement = document.getElementById('inferenceTime');
        
        if (!inferenceStatusElement || !detectedTypesElement || !inferenceTimeElement) {
            console.warn('📊 Inference status elements not found in DOM');
            return;
        }

        if (lastInferredTypes && lastInferredTypes.length > 0) {
            // Show the inference status section
            inferenceStatusElement.style.display = 'block';
            
            // Format detected types with friendly names (similar to amzl-scripts service type mapping)
            const friendlyNames = lastInferredTypes.map(type => {
                const mapping = {
                    'cycle1': 'Cycle 1 (Standard)',
                    'samedayB': 'Sameday B (Multi-Use)', 
                    'samedayC': 'Sameday C (Sameday)'
                };
                return mapping[type] || type;
            }).join(', ');
            
            detectedTypesElement.textContent = friendlyNames;
            
            // Format timestamp
            if (inferenceTimestamp) {
                const inferenceDate = new Date(inferenceTimestamp);
                const now = new Date();
                const timeDiff = now - inferenceDate;
                
                let timeText = '';
                if (timeDiff < 60000) { // Less than 1 minute
                    timeText = 'Just now';
                } else if (timeDiff < 3600000) { // Less than 1 hour
                    const minutes = Math.floor(timeDiff / 60000);
                    timeText = `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
                } else if (timeDiff < 86400000) { // Less than 1 day
                    const hours = Math.floor(timeDiff / 3600000);
                    timeText = `${hours} hour${hours !== 1 ? 's' : ''} ago`;
                } else {
                    timeText = inferenceDate.toLocaleDateString() + ' at ' + inferenceDate.toLocaleTimeString();
                }
                
                inferenceTimeElement.textContent = `Last detected: ${timeText}`;
            }
            
            console.log('📊 Displayed inference status:', friendlyNames);
        } else {
            // Hide inference status if no data
            inferenceStatusElement.style.display = 'none';
            console.log('📊 No inference data to display');
        }
    } catch (error) {
        console.error('❌ Error displaying inference status:', error);
    }
}

// Batch Input Functionality
function setupBatchInputListeners() {
    console.log('🔧 Setting up batch input listeners');

    if (!elements.batchDropZone || !elements.batchTextInput) {
        console.warn('⚠️ Batch input elements not found');
        return;
    }

    // Drop zone click to activate text mode
    elements.batchDropZone.addEventListener('click', (e) => {
        if (e.target === elements.batchTextInput) return;
        activateTextMode();
    });

    // Show text input button
    if (elements.showTextInputBtn) {
        elements.showTextInputBtn.addEventListener('click', (e) => {
            e.preventDefault();
            activateTextMode();
        });
    }

    // Process batch button
    if (elements.processBatchBtn) {
        elements.processBatchBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            await processBatchInput();
        });
    }

    // Cancel batch button
    if (elements.cancelBatchBtn) {
        elements.cancelBatchBtn.addEventListener('click', (e) => {
            e.preventDefault();
            deactivateTextMode();
        });
    }

    // Drag and drop handlers
    elements.batchDropZone.addEventListener('dragover', handleDragOver);
    elements.batchDropZone.addEventListener('dragleave', handleDragLeave);
    elements.batchDropZone.addEventListener('drop', handleDrop);

    // Text input handlers
    elements.batchTextInput.addEventListener('input', handleTextInput);
    elements.batchTextInput.addEventListener('paste', handlePaste);

    console.log('✅ Batch input listeners set up successfully');
}

function activateTextMode() {
    if (!elements.batchDropZone || !elements.batchTextInput) return;

    elements.batchDropZone.classList.add('text-mode');
    elements.batchTextInput.style.display = 'block';
    elements.batchTextInput.focus();

    // Show/hide buttons
    if (elements.showTextInputBtn) elements.showTextInputBtn.style.display = 'none';
    if (elements.processBatchBtn) elements.processBatchBtn.style.display = 'inline-flex';
    if (elements.cancelBatchBtn) elements.cancelBatchBtn.style.display = 'inline-flex';

    console.log('📝 Text mode activated');
}

function deactivateTextMode() {
    if (!elements.batchDropZone || !elements.batchTextInput) return;

    elements.batchDropZone.classList.remove('text-mode');
    elements.batchTextInput.style.display = 'none';
    elements.batchTextInput.value = '';

    // Show/hide buttons
    if (elements.showTextInputBtn) elements.showTextInputBtn.style.display = 'inline-flex';
    if (elements.processBatchBtn) elements.processBatchBtn.style.display = 'none';
    if (elements.cancelBatchBtn) elements.cancelBatchBtn.style.display = 'none';

    console.log('📝 Text mode deactivated');
}

function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    elements.batchDropZone.classList.add('drag-over');
}

function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    elements.batchDropZone.classList.remove('drag-over');
}

function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    elements.batchDropZone.classList.remove('drag-over');

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
        processFiles(files);
    } else {
        // Handle text drop
        const text = e.dataTransfer.getData('text/plain');
        if (text) {
            activateTextMode();
            elements.batchTextInput.value = text;
            handleTextInput();
        }
    }
}

async function processFiles(files) {
    console.log('📁 Processing dropped files:', files.length);

    for (const file of files) {
        if (file.type === 'text/plain' || file.type === 'text/csv' || file.name.endsWith('.txt') || file.name.endsWith('.csv')) {
            try {
                const text = await readFileAsText(file);
                activateTextMode();
                elements.batchTextInput.value = text;
                handleTextInput();
                break; // Only process the first valid file
            } catch (error) {
                console.error('❌ Error reading file:', error);
                showToast(`Failed to read file: ${file.name}`, 'error');
            }
        } else {
            showToast(`Unsupported file type: ${file.name}`, 'error');
        }
    }
}

function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(new Error('Failed to read file'));
        reader.readAsText(file);
    });
}

function handleTextInput() {
    const text = elements.batchTextInput.value.trim();
    const isValid = text.length > 0;
    
    if (elements.processBatchBtn) {
        elements.processBatchBtn.disabled = !isValid;
    }
}

function handlePaste(e) {
    // Let the paste happen naturally, then process
    setTimeout(() => {
        handleTextInput();
    }, 10);
}

async function processBatchInput() {
    if (isLoading) return;

    const text = elements.batchTextInput.value.trim();
    if (!text) {
        showToast('Please enter some text to process', 'error');
        return;
    }

    try {
        setLoading(true);
        console.log('🔄 Processing batch input');

        const webhooks = parseBatchText(text);
        
        if (webhooks.length === 0) {
            showToast('No valid DSP codes and webhook URLs found', 'error');
            return;
        }

        // Add webhooks to the UI
        let addedCount = 0;
        for (const { dspCode, webhookUrl } of webhooks) {
            // Check if DSP code already exists
            const existingEntries = document.querySelectorAll('.webhook-entry .dsp-code');
            const isDuplicate = Array.from(existingEntries).some(input => 
                input.value.trim().toUpperCase() === dspCode.toUpperCase()
            );

            if (!isDuplicate) {
                addWebhookEntry(dspCode, webhookUrl);
                addedCount++;
                console.log(`✅ Added webhook entry: ${dspCode} -> ${webhookUrl.substring(0, 50)}...`);
            } else {
                console.warn(`⚠️ Skipping duplicate DSP code: ${dspCode}`);
            }
        }

        // Wait a moment for DOM updates, then save
        console.log(`💾 Preparing to save ${addedCount} new webhook entries...`);
        await new Promise(resolve => setTimeout(resolve, 100));
        await saveWebhooks();

        showToast(`Successfully imported ${addedCount} webhook${addedCount !== 1 ? 's' : ''}!`, 'success');
        deactivateTextMode();

    } catch (error) {
        console.error('❌ Error processing batch input:', error);
        showToast(`Failed to process batch input: ${error.message}`, 'error');
    } finally {
        setLoading(false);
    }
}

function parseBatchText(text) {
    console.log('📊 Parsing batch text');
    const webhooks = [];
    const lines = text.split('\n').map(line => line.trim()).filter(line => line);

    for (const line of lines) {
        // Skip empty lines and comments
        if (!line || line.startsWith('#') || line.startsWith('//')) {
            continue;
        }

        let dspCode = '';
        let webhookUrl = '';

        // Try comma-separated format
        if (line.includes(',')) {
            const parts = line.split(',').map(part => part.trim());
            if (parts.length >= 2) {
                dspCode = parts[0];
                webhookUrl = parts[1];
            }
        }
        // Try tab-separated format
        else if (line.includes('\t')) {
            const parts = line.split('\t').map(part => part.trim());
            if (parts.length >= 2) {
                dspCode = parts[0];
                webhookUrl = parts[1];
            }
        }
        // Try space-separated format (if more than one space)
        else if (line.includes('  ')) {
            const parts = line.split(/\s{2,}/).map(part => part.trim());
            if (parts.length >= 2) {
                dspCode = parts[0];
                webhookUrl = parts[1];
            }
        }

        // Validate parsed data
        if (dspCode && webhookUrl) {
            // Validate DSP code format
            if (!/^[A-Za-z0-9]+$/.test(dspCode)) {
                console.warn(`⚠️ Invalid DSP code format: ${dspCode}`);
                continue;
            }

            // Validate URL format
            try {
                new URL(webhookUrl);
            } catch {
                console.warn(`⚠️ Invalid webhook URL: ${webhookUrl}`);
                continue;
            }

            webhooks.push({
                dspCode: dspCode.toUpperCase(),
                webhookUrl: webhookUrl
            });
        } else {
            console.warn(`⚠️ Could not parse line: ${line}`);
        }
    }

    console.log(`📊 Parsed ${webhooks.length} valid webhook entries`);
    return webhooks;
}


function computeDateParam(serviceType) {
    const now = new Date();
    const date = new Date(now);
    if (serviceType === 'cycle1') date.setDate(date.getDate() + 1);
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

function buildSchedulingUrl(settings, isCycle1, dateStr) {
    const baseConfigured = settings.schedulingBaseUrl || '';
    const serviceAreaId = settings.serviceAreaId || '';
    const defaultBase = 'https://logistics.amazon.co.uk/internal/scheduling/dsps';
    let baseUrl = baseConfigured || (serviceAreaId ? `${defaultBase}?serviceAreaId=${encodeURIComponent(serviceAreaId)}` : defaultBase);
    try {
        const url = new URL(baseUrl, defaultBase);
        url.searchParams.set('date', dateStr);
        return url.toString();
    } catch (e) {
        return baseUrl + (baseUrl.includes('?') ? `&date=${dateStr}` : `?date=${dateStr}`);
    }
}

function buildRoutePlanningUrl(settings, dateStr) {
    const base = settings.routePlanningBaseUrl || '';
    if (!base) return 'https://eu.route.planning.last-mile.a2z.com/route-planning';
    try {
        const url = new URL(base);
        if (/\/route-planning\/[A-Z0-9]+\/.+/.test(url.pathname)) {
            return `${url.origin}${url.pathname}/${dateStr}`;
        }
        return base;
    } catch (e) {
        return base.endsWith('/') ? base + dateStr : `${base}/${dateStr}`;
    }
}

async function renderUrlPreviews() {
    try {
        const { settings = {} } = await browser.storage.local.get('settings');
        const today = computeDateParam('other');
        const tomorrow = computeDateParam('cycle1');
        const schedCycle1 = buildSchedulingUrl(settings, true, tomorrow);
        const schedToday = buildSchedulingUrl(settings, false, today);
        const routeToday = buildRoutePlanningUrl(settings, today);
        if (!elements.urlPreviews) return;
        while (elements.urlPreviews.firstChild) elements.urlPreviews.removeChild(elements.urlPreviews.firstChild);
        const items = [
            { label: 'Scheduling (Cycle 1 - tomorrow)', url: schedCycle1 },
            { label: 'Scheduling (Today)', url: schedToday },
            { label: 'Route Planning (Today)', url: routeToday }
        ];
        items.forEach(item => {
            const row = document.createElement('div');
            row.className = 'url-preview';

            const label = document.createElement('div');
            label.className = 'url-label';
            label.textContent = item.label;

            const link = document.createElement('a');
            link.className = 'url-link';
            link.href = item.url;
            link.textContent = item.url;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';

            row.appendChild(label);
            row.appendChild(link);
            elements.urlPreviews.appendChild(row);
        });
    } catch (e) {
        console.warn('Failed to render URL previews:', e);
    }
}
