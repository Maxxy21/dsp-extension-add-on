

// Ensure browser polyfill is available
if (typeof browser === 'undefined' && typeof chrome !== 'undefined') {
    var browser = chrome;
}

// Application state
let isLoading = false;
let webhookEntryCount = 0;

// DOM elements cache
let elements = {};

// Initialize when DOM is ready
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
        
        elements.webhookEntries.innerHTML = '';
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

function showEmptyState() {
    if (!elements.webhookEntries) return;
    
    elements.webhookEntries.innerHTML = `
        <div class="empty-state">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                <path d="M9 19c-5 0-8-3-8-8s3-8 8-8 8 3 8 8-3 8-8 8z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M24 12h-8m0 0l3-3m-3 3l3 3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <h3>No webhooks configured</h3>
            <p>Add your first DSP webhook to get started with notifications</p>
        </div>
    `;
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
    
    const entryDiv = document.createElement('div');
    entryDiv.className = 'webhook-entry';
    entryDiv.setAttribute('data-entry-id', entryId);
    
    entryDiv.innerHTML = `
        <div class="webhook-field">
            <label for="${entryId}-dsp">DSP Code</label>
            <input 
                type="text" 
                id="${entryId}-dsp"
                class="dsp-code" 
                placeholder="e.g., DHH1" 
                value="${escapeHtml(dspCode)}"
                maxlength="10"
                pattern="[A-Za-z0-9]+"
                title="DSP code should contain only letters and numbers"
                required
            >
        </div>
        <div class="webhook-field">
            <label for="${entryId}-url">Webhook URL</label>
            <input 
                type="url" 
                id="${entryId}-url"
                class="webhook-url" 
                placeholder="https://hooks.chime.aws/..."
                value="${escapeHtml(webhookUrl)}"
                required
            >
        </div>
        <div class="webhook-actions">
            <button type="button" class="remove-webhook" aria-label="Remove this webhook entry">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    <path d="M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
                Remove
            </button>
        </div>
    `;
    
    elements.webhookEntries.appendChild(entryDiv);
    
    // Add event listeners
    setupWebhookEntryListeners(entryDiv);
    
    // Focus the DSP code input if it's empty (new entry)
    if (!dspCode) {
        const dspInput = entryDiv.querySelector('.dsp-code');
        if (dspInput) {
            setTimeout(() => {
                dspInput.focus();
                dspInput.select();
            }, 100);
        }
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

// Utility functions
function debounce(func, delay) {
    let timeoutId;
    return function (...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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