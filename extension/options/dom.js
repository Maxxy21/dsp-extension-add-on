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
        clearManifestMap: document.getElementById('clearManifestMap'),
        backbriefUpload: document.getElementById('backbriefUpload'),
        backbriefStatus: document.getElementById('backbriefStatus'),
        sendBackbriefBtn: document.getElementById('sendBackbrief'),
        sendManifestBtn: document.getElementById('sendManifest')
    };

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

function debounce(func, delay) {
    let timeoutId;
    return function(...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
}

function showToast(message, type = 'success') {
    if (!elements.toast) return;
    elements.toast.textContent = message;
    elements.toast.className = `toast ${type} show`;
    setTimeout(() => {
        if (elements.toast) {
            elements.toast.className = 'toast';
        }
    }, type === 'error' || type === 'warning' ? 5000 : 3000);
}

function hideToast() {
    if (!elements.toast) return;
    elements.toast.className = 'toast';
}
