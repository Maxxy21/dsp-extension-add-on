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

function setupCharacterCounter() {
    updateCharacterCount();
}

function handleMessageInput() {
    updateCharacterCount();
    validateMessageLength();
}

function updateCharacterCount() {
    const message = elements.messageInput?.value || '';
    if (elements.charCount) {
        elements.charCount.textContent = `${message.length} characters`;
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
    if (!elements.messageInput) return;
    if (message.length > 2000) {
        elements.messageInput.style.borderColor = 'var(--error)';
        showToast('Message too long (max 2000 characters)', 'error');
    } else {
        elements.messageInput.style.borderColor = '';
    }
}

function handleKeydown(event) {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault();
        if (elements.sendMessageButton && !elements.sendMessageButton.disabled && !isLoading) {
            handleSendMessage();
        }
    }
}

function handleGlobalKeydown(event) {
    if (event.key === 'Escape') {
        hideToast();
    }
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

    elements.toast.textContent = message;
    elements.toast.className = `toast ${type} show`;

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

const style = document.createElement('style');
style.textContent = `
    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }
`;
document.head.appendChild(style);
