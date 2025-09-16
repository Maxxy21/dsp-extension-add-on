// -----------------------------
// Failed Reattempts Report
// -----------------------------

function chunkArray(arr, size) {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
}

function reasonIcon(reason) {
    const map = {
        'BUSINESS_CLOSED': '🏢',
        'LOCKER_ISSUE': '🔒',
        'UNABLE_TO_LOCATE_ADDRESS': '🗺️',
        'UNABLE_TO_ACCESS': '🚫',
        'OTP_NOT_AVAILABLE': '🔑',
        'OUT_OF_DELIVERY_TIME': '⏰',
        'ITEMS_MISSING': '❓'
    };
    return map[reason] || '';
}

async function runFailedReattemptReport() {
    const { settings = {} } = await browser.storage.local.get('settings');
    const includeReasons = settings.failedReasons || [
        'BUSINESS_CLOSED', 'LOCKER_ISSUE', 'UNABLE_TO_LOCATE_ADDRESS', 'UNABLE_TO_ACCESS', 'OTP_NOT_AVAILABLE', 'ITEMS_MISSING'
    ];
    const chunkSize = Number.isFinite(settings.failedChunkSize) ? settings.failedChunkSize : 20;
    const backbriefUrl = settings.failedBackbriefUrl || settings.riskDashboardUrl || '';
    const routePlanningBaseUrl = settings.routePlanningBaseUrl || '';
    if (!backbriefUrl) {
        return { sent: 0, dspsNotified: 0, error: 'Backbrief dashboard URL not configured' };
    }

    // First, prefer uploaded backbrief if present
    let rows = [];
    try {
        const { uploadedBackbriefRows } = await browser.storage.local.get('uploadedBackbriefRows');
        if (uploadedBackbriefRows && Array.isArray(uploadedBackbriefRows.rows) && uploadedBackbriefRows.rows.length) {
            rows = uploadedBackbriefRows.rows;
        }
    } catch {}

    if (!rows.length) {
        // Open or reuse dashboard tab and capture live
        const matches = await browser.tabs.query({ url: backbriefUrl.split('#')[0] + '*' });
        let tab;
        if (matches && matches.length > 0) {
            tab = matches[0];
            await browser.tabs.update(tab.id, { url: backbriefUrl, active: false });
        } else {
            tab = await browser.tabs.create({ url: backbriefUrl, active: false });
        }
        await new Promise(r => setTimeout(r, 8000));

        // Prefer CSV capture; fall back to DOM extraction
        try {
            const csvResp = await browser.tabs.sendMessage(tab.id, { action: 'getBackbriefCsv' });
            if (csvResp?.success && csvResp.csv) {
                const parsed = parseBackbriefCsv(csvResp.csv);
                rows = parsed;
            }
        } catch (e) {
            console.warn('CSV parse path failed, will fallback:', e);
        }
        if (!rows.length) {
            try {
                const response = await browser.tabs.sendMessage(tab.id, { action: 'getBackbriefFailedShipments', includeReasons, mapUnableToAccess: true });
                rows = Array.isArray(response?.rows) ? response.rows : [];
            } catch (e) {
                return { sent: 0, dspsNotified: 0, error: 'Content script not ready on Backbrief page' };
            }
        }
    }

    // Normalize/filter rows once
    rows = rows.filter(r => r && r.trackingId).map(r => ({
        trackingId: (r.trackingId || '').toUpperCase(),
        deliveryStation: r.deliveryStation || r.ds || '',
        route: r.route || r.manifestRouteCode || '',
        dspName: (r.dspName || r.latestDSPName || '').toUpperCase(),
        reason: (r.attemptReason === 'UNABLE_TO_ACCESS') ? 'UNABLE_TO_ACCESS' : (r.reason || ''),
        attemptReason: r.attemptReason || '',
        latestAttempt: r.latestAttempt || r.attemptTime || '',
        addressType: r.addressType || ''
    })).filter(r => {
        if (Array.isArray(includeReasons) && includeReasons.length) {
            return includeReasons.includes(r.reason);
        }
        return true;
    });
    if (rows.length === 0) return { sent: 0, dspsNotified: 0 };

    // Try to enrich with manifest address and time window if route planning URL configured
    let manifestMap = {};
    if (routePlanningBaseUrl) {
        try {
            let rtpUrl = routePlanningBaseUrl;
            try {
                const u = new URL(routePlanningBaseUrl);
                // If path looks like /route-planning/STATION/<guid>[/<date>], append /YYYY-MM-DD for today
                const today = new Date();
                const yyyy = today.getFullYear();
                const mm = String(today.getMonth() + 1).padStart(2, '0');
                const dd = String(today.getDate()).padStart(2, '0');
                const dateStr = `${yyyy}-${mm}-${dd}`;
                if (/\/route-planning\/[A-Z0-9]+\/.+/.test(u.pathname) && !/\d{4}-\d{2}-\d{2}$/.test(u.pathname)) {
                    rtpUrl = `${u.origin}${u.pathname}/${dateStr}`;
                }
            } catch {}

            const matchesRP = await browser.tabs.query({ url: rtpUrl.split('#')[0] + '*' });
            let tabRP;
            if (matchesRP && matchesRP.length > 0) {
                tabRP = matchesRP[0];
                await browser.tabs.update(tabRP.id, { url: rtpUrl, active: false });
            } else {
                tabRP = await browser.tabs.create({ url: rtpUrl, active: false });
            }
            await new Promise(r => setTimeout(r, 7000));
            const manResp = await browser.tabs.sendMessage(tabRP.id, { action: 'getManifestTrackingMap' });
            if (manResp?.success && manResp.map) manifestMap = manResp.map;
            // If manifest map is empty, try route-sheets fallback
            if (!manifestMap || Object.keys(manifestMap).length === 0) {
                try {
                    let sheetsUrl = rtpUrl.replace('://eu.route.planning.last-mile.a2z.com/route-planning', '://eu.dispatch.planning.last-mile.a2z.com/route-sheets');
                    const matchesRS = await browser.tabs.query({ url: sheetsUrl.split('#')[0] + '*' });
                    let tabRS;
                    if (matchesRS && matchesRS.length > 0) {
                        tabRS = matchesRS[0];
                        await browser.tabs.update(tabRS.id, { url: sheetsUrl, active: false });
                    } else {
                        tabRS = await browser.tabs.create({ url: sheetsUrl, active: false });
                    }
                    await new Promise(r => setTimeout(r, 7000));
                    const rsResp = await browser.tabs.sendMessage(tabRS.id, { action: 'getSheetsTrackingMap' });
                    if (rsResp?.success && rsResp.map) manifestMap = rsResp.map;
                } catch (e) { console.warn('Route sheets enrichment failed:', e); }
            }
        } catch (e) {
            console.warn('Manifest enrichment skipped:', e);
        }
    }

    // Overlay in-memory manifest map first (if provided from Options upload)
    if (TEMP_MANIFEST_MAP && Object.keys(TEMP_MANIFEST_MAP).length) {
        manifestMap = { ...manifestMap, ...TEMP_MANIFEST_MAP };
    }

    // Overlay uploaded manifest map if present
    try {
        const { uploadedManifestMap } = await browser.storage.local.get('uploadedManifestMap');
        if (uploadedManifestMap && uploadedManifestMap.map && Object.keys(uploadedManifestMap.map).length) {
            manifestMap = { ...manifestMap, ...uploadedManifestMap.map };
        }
    } catch {}

    // Group by DSP
    const byDSP = new Map();
    for (const r of rows) {
        const dsp = (r.dspName || '').trim().toUpperCase();
        if (!dsp) continue;
        if (!byDSP.has(dsp)) byDSP.set(dsp, []);
        byDSP.get(dsp).push(r);
    }

    const { webhooks = {} } = await browser.storage.local.get('webhooks');
    let sent = 0; let dspsNotified = 0;
    const dspsWithFailures = [];

    for (const [dsp, list] of byDSP) {
        if (!webhooks[dsp]) continue; // skip unmapped DSPs
        // Sort: route number if present, then reason
        const parseRouteNum = (s) => {
            const m = String(s || '').match(/(\d+)/);
            return m ? parseInt(m[1], 10) : Number.MAX_SAFE_INTEGER;
        };
        const reasonOrder = ['BUSINESS_CLOSED','LOCKER_ISSUE','UNABLE_TO_LOCATE_ADDRESS','UNABLE_TO_ACCESS','OTP_NOT_AVAILABLE','ITEMS_MISSING'];
        list.sort((a,b) => {
            const ra = parseRouteNum(a.route), rb = parseRouteNum(b.route);
            if (ra !== rb) return ra - rb;
            return reasonOrder.indexOf(a.reason) - reasonOrder.indexOf(b.reason);
        });

        const chunks = chunkArray(list, chunkSize);
        for (let i = 0; i < chunks.length; i++) {
            const part = chunks[i];
            let table = '| 📦 Tracking ID | ❌ Reason | 🚚 Route | 🏠 Address | Type | ⚠️ Attempted | 🕒 Time Window |\n';
            table += '|----------------|-----------|----------|------------|------|-------------|---------------|\n';
            for (const row of part) {
                const icon = reasonIcon(row.reason);
                const reason = `${icon ? icon + ' ' : ''}${row.reason}`;
                const tracking = row.trackingId || '-';
                const route = row.route || '-';
                const mm = manifestMap[tracking] || {};
                const address = mm.address ? (String(mm.address).split(',').slice(0, -1).join(',') || mm.address) : 'No Address';
                const addrType = row.addressType || '-';
                const attemptedRaw = row.latestAttempt || '';
                let attempted = 'N/A';
                try {
                    const timeMatch = String(attemptedRaw).match(/\b(\d{1,2}):(\d{2})\b/);
                    if (timeMatch) {
                        attempted = `${timeMatch[1].padStart(2,'0')}:${timeMatch[2]}`;
                    } else if (/T\d{2}:\d{2}:\d{2}/.test(String(attemptedRaw))) {
                        const d = new Date(attemptedRaw);
                        if (!isNaN(d.getTime())) {
                            const hh = String(d.getHours()).padStart(2,'0');
                            const mm2 = String(d.getMinutes()).padStart(2,'0');
                            attempted = `${hh}:${mm2}`;
                        }
                    }
                } catch {}
                const timeWindow = mm.timeWindow || 'No Time Window';
                table += `| ${tracking} | ${reason} | ${route} | ${address} | ${addrType} | ${attempted} | ${timeWindow} |\n`;
            }
            const partIndicator = chunks.length > 1 ? ` (Part ${i+1}/${chunks.length})` : '';
            const message = `/md\n# Failed Shipments to Reattempt | Fehlgeschlagene Sendungen für erneuten Zustellversuch${partIndicator}\n`+
                `## DSP ${dsp}\n\n`+
                `Hi <@all|All Members>,\n\n`+
                `Here are the Failed Deliveries that need reattempt | Hier sind die fehlgeschlagenen Lieferungen, die einen erneuten Zustellversuch benötigen:\n\n`+
                table + '\n';

            const r = await sendWebhookMessage(dsp, message);
            if (r?.success) { sent++; }
            await new Promise(r => setTimeout(r, 400));
        }
        if (chunks.length > 0) {
            dspsNotified++;
            dspsWithFailures.push(dsp);
        }
    }

    // Send action plan to DSPs that got tables
    if (dspsWithFailures.length > 0) {
        const actionPlan =
`/md\n### Action Guide | Handlungsanleitung\n\n`+
`**🏢 BUSINESS_CLOSED:**\n`+
`- Without Time Window | Ohne Zeitfenster:\n`+
`  → FQA will add the Time Window | FQA fügt das Zeitfenster hinzu\n`+
`- With Time Window (Inside the TW) | Mit Zeitfenster (Innerhalb Zeitfenster):\n`+
`  → DSP: Please provide information about the situation and confirm redelivery attempt\n`+
`  → DSP: Bitte Informationen zur Situation bereitstellen und Zustellversuch bestätigen\n`+
`- With Time Window (Out of the TW) | Mit Zeitfenster (Ausserhalb Zeitfenster):\n`+
`  → On Road team will review the routing | On Road Team überprüft die Route\n`+
`- RESIDENTIAL address | WOHNADRESSE:\n`+
`  → DSP: Please inform if this is an error and if a second attempt will be made\n`+
`  → DSP: Bitte informieren Sie, ob es sich um einen Fehler handelt und ob ein zweiter Versuch unternommen wird\n\n`+
`**🔒 LOCKER_ISSUE:**\n`+
`→ **DSP**: Please provide details about the issue and indicate if urgent intervention is needed for same-day delivery\n`+
`→ **DSP**: Bitte Details zum Problem mitteilen und angeben, ob dringende Intervention für Lieferung am selben Tag erforderlich\n\n`+
`**🗺️ UNABLE_TO_LOCATE ADDRESS / 🚫 UNABLE_TO_ACCESS:**\n`+
`→ **DSL** will verify if it's a genuine case | **DSL** überprüft, ob es sich um einen echten Fall handelt\n`+
`- If genuine: **DSL** will provide correct information for redelivery\n`+
`- If not genuine: **DSP** to arrange redelivery with DA\n`+
`- Falls echt: **DSL** stellt korrekte Informationen für erneute Zustellung bereit\n`+
`- Falls nicht echt: **DSP** organisiert erneute Zustellung mit DA\n\n`+
`**🔑 OTP_NOT_AVAILABLE:**\n`+
`→ **DSL** will review the case and assist the DSP to complete the delivery\n`+
`→ **DSL** überprüft den Fall und unterstützt den DSP bei der Zustellung\n\n`+
`**❓ ITEMS_MISSING:**\n`+
`→ **DSP**: Please provide information about what happened\n`+
`→ **DSP**: Bitte Informationen zum Vorfall bereitstellen\n`;

        for (const dsp of dspsWithFailures) {
            const r = await sendWebhookMessage(dsp, actionPlan);
            if (r?.success) { sent++; }
            await new Promise(r => setTimeout(r, 400));
        }
    }

    // Clear temp manifest to free memory
    TEMP_MANIFEST_MAP = {};
    return { sent, dspsNotified };
}

// Minimal CSV parser tolerant to quotes and commas
function parseBackbriefCsv(text) {
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
            } else {
                field += ch;
            }
        } else {
            if (ch === '"') { inQuotes = true; }
            else if (ch === ',') { pushField(); }
            else if (ch === '\n') { pushField(); pushRow(); }
            else if (ch === '\r') { /* ignore */ }
            else { field += ch; }
        }
        i++;
    }
    if (field.length || row.length) { pushField(); pushRow(); }
    if (rows.length === 0) return [];
    const header = rows[0].map(h => normalizeHeader(h));
    const out = [];
    for (let r = 1; r < rows.length; r++) {
        const obj = {};
        const cols = rows[r];
        for (let c = 0; c < header.length; c++) {
            const key = header[c];
            if (!key) continue;
            obj[key] = (cols[c] || '').trim();
        }
        const mapped = mapCsvRow(obj);
        out.push(mapped);
    }
    return out;
}

function normalizeHeader(h) {
    return String(h || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function mapCsvRow(o) {
    // Try a variety of likely fields from Backbrief export
    const get = (...keys) => keys.find(k => o[k] != null);
    const trackingId = o[get('tracking_id','trackingid','tid','tracking')] || '';
    const deliveryStation = o[get('delivery_station','ds','station')] || '';
    const route = o[get('route','route_id','manifestroutecode','compLastScanInOrder_manifestRouteCode'.toLowerCase())] || '';
    const dspName = o[get('dsp_name','dsp','compdadata_latestdspname','latestdspname')] || '';
    const reason = o[get('reason','internal_reason_code','compattemptdata_complatestattemptevent_internalreasoncode')] || o[get('comp_last_scan_in_order_internal_reason_code')] || '';
    const attemptReason = o[get('attempt_reason','compattemptdata_complatestattemptevent_internalreasoncode')] || '';
    const latestAttempt = o[get('latest_attempt','attempt_time','compattemptdata_complatestattemptevent_timestamp')] || '';
    const addressType = o[get('address_type')] || '';
    return { trackingId, deliveryStation, route, dspName, reason, attemptReason, latestAttempt, addressType };
}

// Preview stats for reattempts: counts of total rows and how many have enrichment
async function previewFailedReattemptStats() {
    const prepared = await prepareReattemptData();
    if (prepared.error) return { error: prepared.error };
    const { rows, manifestMap } = prepared;
    const totalRows = rows.length;
    let matchedTimeWindow = 0, matchedAddress = 0, matchedEither = 0;
    for (const r of rows) {
        const m = manifestMap[r.trackingId];
        if (!m) continue;
        const hasTW = !!m.timeWindow && m.timeWindow !== 'No Time Window';
        const hasAddr = !!m.address && m.address !== 'No Address';
        if (hasTW) matchedTimeWindow++;
        if (hasAddr) matchedAddress++;
        if (hasTW || hasAddr) matchedEither++;
    }
    return { totalRows, matchedTimeWindow, matchedAddress, matchedEither };
}

// Prepare rows + manifest map used in reattempts flow (without sending)
async function prepareReattemptData() {
    try {
        const { settings = {} } = await browser.storage.local.get('settings');
        const includeReasons = settings.failedReasons || [
            'BUSINESS_CLOSED', 'LOCKER_ISSUE', 'UNABLE_TO_LOCATE_ADDRESS', 'UNABLE_TO_ACCESS', 'OTP_NOT_AVAILABLE', 'ITEMS_MISSING'
        ];
        const backbriefUrl = settings.failedBackbriefUrl || settings.riskDashboardUrl || '';
        const routePlanningBaseUrl = settings.routePlanningBaseUrl || '';
        if (!backbriefUrl) {
            return { rows: [], manifestMap: {}, error: 'Backbrief dashboard URL not configured' };
        }

        // Acquire rows: prefer uploaded backbrief
        let rows = [];
        try {
            const { uploadedBackbriefRows } = await browser.storage.local.get('uploadedBackbriefRows');
            if (uploadedBackbriefRows && Array.isArray(uploadedBackbriefRows.rows) && uploadedBackbriefRows.rows.length) {
                rows = uploadedBackbriefRows.rows;
            }
        } catch {}
        if (!rows.length) {
            // Open or reuse dashboard tab and capture live
            const matches = await browser.tabs.query({ url: backbriefUrl.split('#')[0] + '*' });
            let tab;
            if (matches && matches.length > 0) {
                tab = matches[0];
                await browser.tabs.update(tab.id, { url: backbriefUrl, active: false });
            } else {
                tab = await browser.tabs.create({ url: backbriefUrl, active: false });
            }
            await new Promise(r => setTimeout(r, 8000));
            try {
                const csvResp = await browser.tabs.sendMessage(tab.id, { action: 'getBackbriefCsv' });
                if (csvResp?.success && csvResp.csv) {
                    const parsed = parseBackbriefCsv(csvResp.csv);
                    rows = parsed;
                }
            } catch (e) { console.warn('CSV parse path failed, will fallback:', e); }
            if (!rows.length) {
                try {
                    const response = await browser.tabs.sendMessage(tab.id, { action: 'getBackbriefFailedShipments', includeReasons, mapUnableToAccess: true });
                    rows = Array.isArray(response?.rows) ? response.rows : [];
                } catch (e) {
                    return { rows: [], manifestMap: {}, error: 'Content script not ready on Backbrief page' };
                }
            }
        }
        // Normalize
        rows = rows.filter(r => r && r.trackingId).map(r => ({
            trackingId: (r.trackingId || '').toUpperCase(),
            deliveryStation: r.deliveryStation || r.ds || '',
            route: r.route || r.manifestRouteCode || '',
            dspName: (r.dspName || r.latestDSPName || '').toUpperCase(),
            reason: (r.attemptReason === 'UNABLE_TO_ACCESS') ? 'UNABLE_TO_ACCESS' : (r.reason || ''),
            attemptReason: r.attemptReason || '',
            latestAttempt: r.latestAttempt || r.attemptTime || '',
            addressType: r.addressType || ''
        }));

        // Build manifest map
        let manifestMap = {};
        if (routePlanningBaseUrl) {
            try {
                let rtpUrl = routePlanningBaseUrl;
                try {
                    const u = new URL(routePlanningBaseUrl);
                    const today = new Date();
                    const yyyy = today.getFullYear();
                    const mm = String(today.getMonth() + 1).padStart(2, '0');
                    const dd = String(today.getDate()).padStart(2, '0');
                    const dateStr = `${yyyy}-${mm}-${dd}`;
                    if (/\/route-planning\/[A-Z0-9]+\/.+/.test(u.pathname) && !/\d{4}-\d{2}-\d{2}$/.test(u.pathname)) {
                        rtpUrl = `${u.origin}${u.pathname}/${dateStr}`;
                    }
                } catch {}
                const matchesRP = await browser.tabs.query({ url: rtpUrl.split('#')[0] + '*' });
                let tabRP;
                if (matchesRP && matchesRP.length > 0) {
                    tabRP = matchesRP[0];
                    await browser.tabs.update(tabRP.id, { url: rtpUrl, active: false });
                } else {
                    tabRP = await browser.tabs.create({ url: rtpUrl, active: false });
                }
                await new Promise(r => setTimeout(r, 7000));
                const manResp = await browser.tabs.sendMessage(tabRP.id, { action: 'getManifestTrackingMap' });
                if (manResp?.success && manResp.map) manifestMap = manResp.map;
                if (!manifestMap || Object.keys(manifestMap).length === 0) {
                    try {
                        let sheetsUrl = rtpUrl.replace('://eu.route.planning.last-mile.a2z.com/route-planning', '://eu.dispatch.planning.last-mile.a2z.com/route-sheets');
                        const matchesRS = await browser.tabs.query({ url: sheetsUrl.split('#')[0] + '*' });
                        let tabRS;
                        if (matchesRS && matchesRS.length > 0) {
                            tabRS = matchesRS[0];
                            await browser.tabs.update(tabRS.id, { url: sheetsUrl, active: false });
                        } else {
                            tabRS = await browser.tabs.create({ url: sheetsUrl, active: false });
                        }
                        await new Promise(r => setTimeout(r, 7000));
                        const rsResp = await browser.tabs.sendMessage(tabRS.id, { action: 'getSheetsTrackingMap' });
                        if (rsResp?.success && rsResp.map) manifestMap = rsResp.map;
                    } catch (e) { console.warn('Route sheets enrichment failed:', e); }
                }
            } catch (e) { console.warn('Manifest enrichment skipped:', e); }
        }
        if (TEMP_MANIFEST_MAP && Object.keys(TEMP_MANIFEST_MAP).length) {
            manifestMap = { ...manifestMap, ...TEMP_MANIFEST_MAP };
        }
        try {
            const { uploadedManifestMap } = await browser.storage.local.get('uploadedManifestMap');
            if (uploadedManifestMap && uploadedManifestMap.map && Object.keys(uploadedManifestMap.map).length) {
                manifestMap = { ...manifestMap, ...uploadedManifestMap.map };
            }
        } catch {}

        return { rows, manifestMap };
    } catch (e) {
        return { rows: [], manifestMap: {}, error: e.message };
    }
}
