async function loadWebhooks() {
    try {
        console.log('📡 Loading webhooks...');
        const result = await browser.storage.local.get(['webhooks']);
        const webhooks = result.webhooks || {};

        if (!elements.webhookEntries) {
            throw new Error('Webhook container not found');
        }

        clearWebhookEntries();
        webhookEntryCount = 0;

        const webhookKeys = Object.keys(webhooks);
        console.log(`Found ${webhookKeys.length} webhooks:`, webhooks);

        if (webhookKeys.length === 0) {
            showEmptyState();
        } else {
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
    while (elements.webhookEntries.firstChild) {
        elements.webhookEntries.removeChild(elements.webhookEntries.firstChild);
    }
}

function showEmptyState() {
    if (!elements.webhookEntries) return;
    const emptyDiv = document.createElement('div');
    emptyDiv.className = 'empty-state';

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

    const title = document.createElement('h3');
    title.textContent = 'No webhooks configured';

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

    const emptyState = elements.webhookEntries.querySelector('.empty-state');
    if (emptyState) {
        emptyState.remove();
    }

    webhookEntryCount++;
    const entryId = `webhook-entry-${webhookEntryCount}`;

    const entryDiv = document.createElement('div');
    entryDiv.className = 'webhook-entry';
    entryDiv.setAttribute('data-entry-id', entryId);

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

    const actionsField = document.createElement('div');
    actionsField.className = 'webhook-actions';

    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.className = 'remove-webhook';
    removeButton.setAttribute('aria-label', 'Remove this webhook entry');

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

    entryDiv.appendChild(dspField);
    entryDiv.appendChild(urlField);
    entryDiv.appendChild(actionsField);

    elements.webhookEntries.appendChild(entryDiv);

    setupWebhookEntryListeners(entryDiv);

    if (!dspCode) {
        setTimeout(() => {
            dspInput.focus();
            dspInput.select();
        }, 100);
    }

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

                entryDiv.style.transition = 'all 300ms ease';
                entryDiv.style.opacity = '0';
                entryDiv.style.transform = 'translateY(-20px)';

                setTimeout(async () => {
                    entryDiv.remove();
                    await saveWebhooks();
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
        input.addEventListener('blur', () => {
            console.log('💾 Input blur event, saving webhooks immediately');
            saveWebhooks();
        });

        input.addEventListener('input', debounce(() => {
            console.log('💾 Input change event, saving webhooks (debounced)');
            saveWebhooks();
        }, 2000));

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                console.log('💾 Enter key pressed, saving webhooks immediately');
                saveWebhooks();
            }
        });

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

        entries.forEach((entry, index) => {
            const dspCodeInput = entry.querySelector('.dsp-code');
            const webhookUrlInput = entry.querySelector('.webhook-url');

            if (!dspCodeInput || !webhookUrlInput) {
                errors.push(`Entry ${index + 1}: Missing input fields`);
                return;
            }

            const dspCode = dspCodeInput.value.trim().toUpperCase();
            const webhookUrl = webhookUrlInput.value.trim();

            const dspField = dspCodeInput.closest('.webhook-field');
            const urlField = webhookUrlInput.closest('.webhook-field');

            if (dspField) dspField.classList.remove('error');
            if (urlField) urlField.classList.remove('error');

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

            if (!dspCode && !webhookUrl) {
                return;
            }

            try {
                new URL(webhookUrl);
            } catch {
                errors.push(`Entry ${index + 1}: Invalid webhook URL`);
                if (urlField) urlField.classList.add('error');
                return;
            }

            webhooks[dspCode] = webhookUrl;
        });

        if (errors.length > 0) {
            showToast(errors[0], 'error');
        }

        await browser.storage.local.set({ webhooks });
        console.log('✅ Webhooks saved successfully');
        showToast('Webhooks saved', 'success');
    } catch (error) {
        console.error('❌ Error saving webhooks:', error);
        showToast('Failed to save webhooks', 'error');
    } finally {
        setLoading(false);
    }
}
