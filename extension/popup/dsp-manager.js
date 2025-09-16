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
    if (elements.dspSelect) {
        while (elements.dspSelect.options.length > 1) {
            elements.dspSelect.remove(1);
        }
    }
    if (elements.checkboxContainer) {
        while (elements.checkboxContainer.firstChild) {
            elements.checkboxContainer.removeChild(elements.checkboxContainer.firstChild);
        }
    }
}

function showEmptyDSPState() {
    if (elements.checkboxContainer) {
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

    if (elements.sendMessageButton) {
        elements.sendMessageButton.disabled = true;
        elements.sendMessageButton.title = 'Configure DSPs in Settings first';
    }
}

function populateDSPOptions(dspCodes) {
    const sortedDspCodes = dspCodes.sort();

    if (elements.dspSelect) {
        sortedDspCodes.forEach(dspCode => {
            const option = document.createElement('option');
            option.value = dspCode;
            option.textContent = dspCode;
            elements.dspSelect.appendChild(option);
        });
    }

    if (elements.checkboxContainer) {
        while (elements.checkboxContainer.firstChild) {
            elements.checkboxContainer.removeChild(elements.checkboxContainer.firstChild);
        }
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

    if (elements.totalDspCount) {
        elements.totalDspCount.textContent = sortedDspCodes.length;
    }

    if (elements.sendMessageButton) {
        elements.sendMessageButton.disabled = false;
        elements.sendMessageButton.title = '';
    }
}

function handleTargetTypeChange(event) {
    const targetType = event.target.value;
    console.log('🎯 Target type changed:', targetType);

    if (elements.individualDspGroup) elements.individualDspGroup.style.display = 'none';
    if (elements.multipleDspGroup) elements.multipleDspGroup.style.display = 'none';
    if (elements.allDspGroup) elements.allDspGroup.style.display = 'none';

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
