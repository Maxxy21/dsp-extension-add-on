function setupEventListeners() {
    document.querySelectorAll('input[name="targetType"]').forEach(radio => {
        radio.addEventListener('change', handleTargetTypeChange);
    });

    if (elements.checkNowButton) {
        elements.checkNowButton.addEventListener('click', handleCheckNow);
    }

    if (elements.sendMessageButton) {
        elements.sendMessageButton.addEventListener('click', handleSendMessage);
    }

    if (elements.sendSummaryButton) {
        elements.sendSummaryButton.addEventListener('click', handleSendSummary);
    }

    if (elements.sendReattemptsButton) {
        elements.sendReattemptsButton.addEventListener('click', handleSendReattempts);
    }

    if (elements.openSettingsButton) {
        elements.openSettingsButton.addEventListener('click', handleOpenSettings);
    }

    if (elements.messageInput) {
        elements.messageInput.addEventListener('input', handleMessageInput);
        elements.messageInput.addEventListener('keydown', handleKeydown);
    }

    document.addEventListener('keydown', handleGlobalKeydown);

    console.log('✅ Popup event listeners attached');
}
