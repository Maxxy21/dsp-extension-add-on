// popup/popup.js - Working modern implementation

// Ensure browser polyfill is available
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
        elements.checkboxContainer.innerHTML = '';
    }
}

function showEmptyDSPState() {
    if (elements.checkboxContainer) {
        elements.checkboxContainer.innerHTML = `
            <div style="text-align: center; padding: 20px; color: var(--text-muted);">
                <p><strong>No DSPs configured</strong></p>
                <p style="font-size: 12px; margin-top: 4px;">Add webhook URLs in Settings to get started</p>
            </div>
        `;
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

    // Populate checkbox container
    if (elements.checkboxContainer) {
        elements.checkboxContainer.innerHTML = sortedDspCodes.map(dspCode => `
            <div class="checkbox-option">
                <input type="checkbox" id="dsp-${dspCode}" value="${dspCode}">
                <label for="dsp-${dspCode}" class="checkbox-label">${dspCode}</label>
            </div>
        `).join('');
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
            button.dataset.originalText = button.innerHTML;
        }
        // Show loading spinner
        button.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style="animation: spin 1s linear infinite;">
                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" opacity="0.25"/>
                <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" opacity="0.75"/>
            </svg>
            <span>Processing...</span>
        `;
    } else {
        button.disabled = false;
        button.classList.remove('loading');
        if (button.dataset.originalText) {
            button.innerHTML = button.dataset.originalText;
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