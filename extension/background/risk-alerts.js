// -----------------------------
// Risk Alerts (every 30 minutes)
// -----------------------------

async function getRiskSettings() {
    const { settings = {} } = await browser.storage.local.get('settings');
    const defaults = { bc: 10, bcResidential: 5, cna: 25, cnaOutlierFactor: 1.5, missing: 1, uta: 5, utl: 5, rejected: 2 };
    const st = settings.riskThresholds || {};
    const coerce = (v, d) => (Number.isFinite(v) ? v : d);
    const thr = {
        bc: coerce(parseInt(st.bc, 10), defaults.bc),
        bcResidential: coerce(parseInt(st.bcResidential, 10), defaults.bcResidential),
        cna: coerce(parseInt(st.cna, 10), defaults.cna),
        cnaOutlierFactor: coerce(parseFloat(st.cnaOutlierFactor), defaults.cnaOutlierFactor),
        missing: coerce(parseInt(st.missing, 10), defaults.missing),
        uta: coerce(parseInt(st.uta, 10), defaults.uta),
        utl: coerce(parseInt(st.utl, 10), defaults.utl),
        rejected: coerce(parseInt(st.rejected, 10), defaults.rejected),
    };
    return {
        enabled: settings.riskAlertsEnabled === true,
        dashboardUrl: settings.riskDashboardUrl || '',
        slackWebhookUrl: settings.slackWebhookUrl || '',
        slackUseChimeMarkdown: settings.slackUseChimeMarkdown === true,
        thresholds: thr,
        renotifyStep: Number.isFinite(settings.riskRenotifyStep) ? settings.riskRenotifyStep : 5
    };
}

async function configureRiskAlarm() {
    try {
        const { enabled, dashboardUrl } = await getRiskSettings();
        // Always clear prior risk alarms
        const alarms = await browser.alarms.getAll();
        await Promise.all(alarms.filter(a => a.name === 'riskScan_30m').map(a => browser.alarms.clear(a.name)));
        if (enabled) {
            await browser.alarms.create('riskScan_30m', { periodInMinutes: 30, when: Date.now() + 5_000 });
            console.log('✅ Risk scan alarm configured (every 30 minutes)');
            // Open dashboard immediately in background
            if (dashboardUrl) {
                try {
                    const matches = await browser.tabs.query({ url: dashboardUrl.split('#')[0] + '*' });
                    if (matches && matches.length > 0) {
                        await browser.tabs.update(matches[0].id, { url: dashboardUrl, active: false });
                    } else {
                        await browser.tabs.create({ url: dashboardUrl, active: false });
                    }
                } catch (e) { console.warn('Could not open risk dashboard:', e); }
            }
        } else {
            console.log('ℹ️ Risk scan disabled');
        }
    } catch (e) {
        console.warn('⚠️ Failed to configure risk alarm:', e);
    }
}

async function configureFailedReattemptsAlarm() {
    try {
        const { settings = {} } = await browser.storage.local.get('settings');
        const enabled = settings.failedAutoEnabled === true;
        // Clear existing alarm first
        const alarms = await browser.alarms.getAll();
        await Promise.all(alarms.filter(a => a.name === 'failedReattempts_daily').map(a => browser.alarms.clear(a.name)));
        if (!enabled) {
            console.log('ℹ️ Failed reattempts auto-send disabled');
            return;
        }
        let time = (settings.failedSendTime || '09:00').trim();
        const [hh, mm] = time.split(':').map(x => parseInt(x, 10));
        const when = getNextAlarmTime(Number.isFinite(hh) ? hh : 9, Number.isFinite(mm) ? mm : 0);
        await browser.alarms.create('failedReattempts_daily', { when, periodInMinutes: 24 * 60 });
        console.log('✅ Failed reattempts daily alarm configured');
    } catch (e) {
        console.warn('⚠️ Failed to configure failed reattempts alarm:', e);
    }
}

browser.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === 'riskScan_30m') {
        await runRiskScan();
    }
    if (alarm.name === 'failedReattempts_daily') {
        await runFailedReattemptReport();
    }
});

async function runRiskScan() {
    const stats = { parsed: 0, flagged: 0, notified: 0 };
    try {
        const risk = await getRiskSettings();
        if (!risk.enabled || !risk.dashboardUrl) {
            console.log('ℹ️ Risk scan skipped (disabled or no URL)');
            return stats;
        }

        await ensureRiskStateForToday();

        // Open or reuse dashboard tab
        const matches = await browser.tabs.query({ url: risk.dashboardUrl.split('#')[0] + '*' });
        let tab;
        if (matches && matches.length > 0) {
            tab = matches[0];
            await browser.tabs.update(tab.id, { url: risk.dashboardUrl, active: false });
        } else {
            tab = await browser.tabs.create({ url: risk.dashboardUrl, active: false });
        }

        // Wait for loading
        await new Promise(r => setTimeout(r, 8000));

        let response;
        try {
            response = await browser.tabs.sendMessage(tab.id, { action: 'getOngoingRisks' });
        } catch (e) {
            console.warn('Content script not ready for risk page:', e);
            return stats;
        }

        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        const todayStr = `${yyyy}-${mm}-${dd}`;

        const rows = (Array.isArray(response?.rows) ? response.rows : []).map(r => ({ ...r, date: todayStr }));
        stats.parsed = rows.length;
        if (rows.length === 0) return stats;

        const flagged = flagRiskRows(rows, risk.thresholds);
        stats.flagged = flagged.length;
        if (flagged.length === 0) return stats;

        const notifyResults = await notifyRiskAlerts(flagged, risk.slackWebhookUrl, risk.renotifyStep);
        stats.notified = notifyResults.filter(r => r.success).length;
        return stats;
    } catch (e) {
        console.error('❌ Risk scan failed:', e);
        return stats;
    }
}

function parseIntSafe(v) {
    const n = parseInt(String(v || '').replace(/[^\d-]/g, ''), 10);
    return Number.isFinite(n) ? n : 0;
}

function flagRiskRows(rows, thresholds) {
    // Group by date to compute median for CNA outlier
    const arr = rows.map(x => parseIntSafe(x.cna)).filter(n => n >= 0).sort((a,b)=>a-b);
    const mid = Math.floor(arr.length/2);
    const cnaMedian = arr.length === 0 ? 0 : (arr.length % 2 ? arr[mid] : Math.round((arr[mid-1]+arr[mid])/2));

    const flagged = [];
    for (const r of rows) {
        const bc = parseIntSafe(r.bc);
        const cna = parseIntSafe(r.cna);
        const missing = parseIntSafe(r.missing);
        const uta = parseIntSafe(r.uta);
        const utl = parseIntSafe(r.utl);
        // Sum separate columns if present
        const rej = parseIntSafe(r.rejectedDelayed) + parseIntSafe(r.rejected) + parseIntSafe(r.delayedByDa);

        // Threshold rules
        if (bc >= thresholds.bc) flagged.push({ ...r, type: 'BC', count: bc, reason: `Business Closed >= ${thresholds.bc}` });
        // Address type check
        if (bc >= thresholds.bcResidential && (r.addressType || '').toLowerCase().includes('residential')) {
            flagged.push({ ...r, type: 'BC', count: bc, reason: `BC >= ${thresholds.bcResidential} at Residential` });
        }
        if (cna >= thresholds.cna && (cnaMedian === 0 || cna >= Math.max(thresholds.cna, Math.round(cnaMedian * (thresholds.cnaOutlierFactor || 1.5))))) {
            flagged.push({ ...r, type: 'CNA', count: cna, reason: `CNA outlier (>=${thresholds.cna} and >=${thresholds.cnaOutlierFactor || 1.5}x median ${cnaMedian})` });
        }
        if (missing >= thresholds.missing) flagged.push({ ...r, type: 'MISSING', count: missing, reason: `Missing >= ${thresholds.missing}` });
        if (uta >= thresholds.uta) flagged.push({ ...r, type: 'UTA', count: uta, reason: `Unable To Access >= ${thresholds.uta}` });
        if (utl >= thresholds.utl) flagged.push({ ...r, type: 'UTL', count: utl, reason: `Unable To Locate >= ${thresholds.utl}` });
        if (rej >= thresholds.rejected) flagged.push({ ...r, type: 'REJECTED_DELAYED', count: rej, reason: `Rejected/Delayed by DA >= ${thresholds.rejected}` });
    }
    return flagged;
}

function buildRiskKey(item) {
    const parts = [item.dsp || item.dspCode || '', item.routeId || '', item.type];
    return parts.join('|');
}

async function dedupeRisks(items, renotifyStep = 5) {
    const { riskAlertState = {} } = await browser.storage.local.get('riskAlertState');
    const out = [];
    for (const it of items) {
        const key = buildRiskKey(it);
        const prev = riskAlertState[key];
        if (!prev || parseIntSafe(it.count) >= parseIntSafe(prev.count) + renotifyStep) {
            out.push(it);
            riskAlertState[key] = { count: parseIntSafe(it.count), notifiedAt: Date.now() };
        }
    }
    await browser.storage.local.set({ riskAlertState });
    return out;
}

async function ensureRiskStateForToday() {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const todayStr = `${yyyy}-${mm}-${dd}`;
    const { lastRiskDay } = await browser.storage.local.get('lastRiskDay');
    if (lastRiskDay !== todayStr) {
        await browser.storage.local.set({ riskAlertState: {}, lastRiskDay: todayStr });
    }
}

async function notifyRiskAlerts(items, slackWebhookUrl, renotifyStep) {
    const results = [];
    const { webhooks = {} } = await browser.storage.local.get('webhooks');

    // Dedupe based on last notified counts
    items = await dedupeRisks(items, renotifyStep);

    for (const it of items) {
        const dsp = (it.dsp || '').trim().toUpperCase();
        const dspWebhook = webhooks[dsp];
        const header = `🚨 Risk Alert: ${it.type}`;
        const details = `Date: ${it.date}\nDSP: ${dsp}\nRoute: ${it.routeId || '-'}\nTransporter: ${it.transporterId || '-'}\nCount: ${it.count}\nReason: ${it.reason || it.reasonText || '-'}`;
        const pageHint = (it.pageUrl || '') ? `\n\nLink: ${it.pageUrl}` : '';
        const chimeMsg = `/md ${header}\n\n${details}${pageHint}`;

        if (dspWebhook) {
            const r = await sendWebhookMessage(dsp, chimeMsg);
            results.push({ dsp, success: r.success, error: r.error });
            await new Promise(r => setTimeout(r, 400));
        } else {
            results.push({ dsp, success: false, error: 'No DSP webhook' });
        }

        if (slackWebhookUrl) {
            const { slackUseChimeMarkdown } = await getRiskSettings();
            const slackMsg = slackUseChimeMarkdown ? chimeMsg : stripChimePrefix(chimeMsg);
            const sr = await sendSlackMessage(slackWebhookUrl, slackMsg);
            results.push({ dsp: 'slack', success: sr.success, error: sr.error });
        }
    }

    return results;
}

async function sendSlackMessage(webhookUrl, text) {
    try {
        const resp = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text })
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        return { success: true };
    } catch (e) {
        console.warn('Slack webhook failed:', e);
        return { success: false, error: e.message };
    }
}

function stripChimePrefix(message) {
    try {
        return message.replace(/^\s*\/md\s+/, '');
    } catch {
        return message;
    }
}
