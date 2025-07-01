if (typeof browser === 'undefined' && typeof chrome !== 'undefined') {
    var browser = chrome;
}

// Application state
let isLoading = false;
let webhookEntryCount = 0;

// DOM elements cache
let elements = {};

// Initialize DOM
document.addEventListener('DOMContentLoaded', async function() {
    console.log('🎉 Modern options page initializing...');

    try {
        // Cache DOM elements
        cacheElements();

        // Set loading state
        setLoading(true);

        // Load settings
        await loadSettings();

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
        toast: document.getElementById('status')
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

        // Load webhooks
        await loadWebhooks();

        // Load alarm status if notifications are enabled
        if (notificationsEnabled) {
            await loadAlarmStatus();
        }

        console.log('✅ Settings loaded successfully');
    } catch (error) {
        console.error('❌ Error loading settings:', error);
        throw new Error('Failed to load settings from storage');
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

        // Auto-save on blur and input with debouncing
        input.addEventListener('blur', debounce(() => {
            console.log('💾 Input blur event, saving webhooks');
            saveWebhooks();
        }, 500));

        input.addEventListener('input', debounce(() => {
            console.log('💾 Input change event, saving webhooks');
            saveWebhooks();
        }, 2000));

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

    // Notification settings toggle
    if (elements.enableNotifications) {
        elements.enableNotifications.addEventListener('change', async (e) => {
            if (isLoading) return;

            const enabled = e.target.checked;
            console.log('🔔 Notification setting changed:', enabled);

            try {
                await saveNotificationSettings(enabled);

                // Send message to background script to update alarm
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
                    // Don't show error to user as settings are still saved
                }

                showToast(`Notifications ${enabled ? 'enabled' : 'disabled'} successfully!`, 'success');

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

        console.log('✅ Notification toggle listener attached');
    } else {
        console.error('❌ Notification toggle not found');
    }

    // Keyboard shortcuts
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

    console.log('✅ Event listeners set up successfully');
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
        console.log('✅ Webhooks saved successfully:', Object.keys(webhooks));

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
    const notificationCard = document.querySelector('.card:first-child .card-content');
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