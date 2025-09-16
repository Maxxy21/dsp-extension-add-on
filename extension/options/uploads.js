async function loadUploadedManifestStatus() {
    try {
        const { uploadedManifestMap } = await browser.storage.local.get('uploadedManifestMap');
        updateManifestStatus(uploadedManifestMap);
    } catch (e) {
        console.warn('Failed to load manifest status');
    }
}

async function loadUploadedBackbriefStatus() {
    try {
        const { uploadedBackbriefRows } = await browser.storage.local.get('uploadedBackbriefRows');
        updateBackbriefStatus(uploadedBackbriefRows);
    } catch (e) {
        console.warn('Failed to load backbrief status');
    }
}

function updateManifestStatus(state) {
    if (!elements.manifestStatus) return;
    while (elements.manifestStatus.firstChild) {
        elements.manifestStatus.removeChild(elements.manifestStatus.firstChild);
    }
    if (!state || !state.count) {
        const span = document.createElement('span');
        span.textContent = 'No manifest uploaded';
        elements.manifestStatus.appendChild(span);
        return;
    }
    const strong = document.createElement('strong');
    strong.textContent = String(state.count);
    const text1 = document.createTextNode(' rows • ');
    const dateSpan = document.createElement('span');
    dateSpan.textContent = state.date || 'Unknown date';
    elements.manifestStatus.appendChild(strong);
    elements.manifestStatus.appendChild(text1);
    elements.manifestStatus.appendChild(dateSpan);
}

function updateBackbriefStatus(state) {
    const el = elements.backbriefStatus;
    if (!el) return;
    while (el.firstChild) el.removeChild(el.firstChild);
    if (!state || !state.count) {
        const span = document.createElement('span');
        span.textContent = 'No backbrief uploaded';
        el.appendChild(span);
        return;
    }
    const strong = document.createElement('strong');
    strong.textContent = String(state.count);
    const text1 = document.createTextNode(' rows • ');
    const dateSpan = document.createElement('span');
    dateSpan.textContent = state.date || 'Unknown date';
    el.appendChild(strong);
    el.appendChild(text1);
    el.appendChild(dateSpan);
}

async function handleManifestUpload(evt) {
    try {
        const file = evt.target.files && evt.target.files[0];
        if (!file) return;
        const name = (file.name || '').toLowerCase();
        let parsed = {};
        if (name.endsWith('.csv')) {
            const text = await file.text();
            parsed = parseManifestCsv(text);
        } else if (name.endsWith('.xls') || name.endsWith('.xlsx')) {
            parsed = await parseManifestExcel(file);
        } else {
            throw new Error('Unsupported file type. Please upload .xls, .xlsx, or .csv');
        }
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        lastParsedManifestMap = parsed;
        const count = Object.keys(parsed).length;
        const state = { date: `${yyyy}-${mm}-${dd}`, count };
        try {
            if (count <= 10000) {
                await browser.storage.local.set({ uploadedManifestMap: { ...state, map: parsed } });
            } else {
                await browser.storage.local.remove('uploadedManifestMap');
            }
        } catch {}
        updateManifestStatus(state);
        showToast(`Loaded ${count} manifest rows${count > 10000 ? ' (in memory only)' : ''}`, 'success');
    } catch (e) {
        console.error('Manifest upload failed:', e);
        showToast('Failed to process manifest CSV', 'error');
    } finally {
        if (elements.manifestUpload) elements.manifestUpload.value = '';
    }
}

async function sendReattemptsUsingManifest() {
    try {
        if (!lastParsedManifestMap || !Object.keys(lastParsedManifestMap).length) {
            showToast('Upload a manifest first', 'error');
            return;
        }
        const entries = Object.entries(lastParsedManifestMap);
        const chunkSize = 5000;
        showToast('Uploading manifest to background...', 'loading');
        for (let i = 0; i < entries.length; i += chunkSize) {
            const slice = entries.slice(i, i + chunkSize);
            const chunk = Object.fromEntries(slice);
            await browser.runtime.sendMessage({ action: 'setTempManifestMapChunk', chunk, done: false });
            await new Promise(r => setTimeout(r, 10));
        }
        await browser.runtime.sendMessage({ action: 'setTempManifestMapChunk', chunk: {}, done: true });
        try {
            const preview = await browser.runtime.sendMessage({ action: 'previewFailedReattemptStats' });
            if (preview?.success) {
                const { totalRows = 0, matchedTimeWindow = 0, matchedAddress = 0 } = preview;
                showToast(`Preview: ${matchedTimeWindow}/${totalRows} TW, ${matchedAddress}/${totalRows} Address. Sending...`, 'loading');
            }
        } catch {}
        showToast('Running reattempts with uploaded manifest...', 'loading');
        const res = await browser.runtime.sendMessage({ action: 'runFailedReattemptReport' });
        if (res?.success) {
            const { sent = 0, dspsNotified = 0 } = res;
            showToast(`Sent ${sent} message(s) across ${dspsNotified} DSP(s)`, 'success');
        } else {
            showToast(res?.error || 'Failed to send reattempts', 'error');
        }
    } catch (e) {
        showToast(e.message || 'Failed to send reattempts', 'error');
    }
}

async function parseManifestExcel(file) {
    if (typeof XLSX === 'undefined' || !XLSX || !XLSX.read) {
        throw new Error('Excel parser not available. Please upload CSV or include xlsx.min.js');
    }
    const ab = await file.arrayBuffer();
    const wb = XLSX.read(new Uint8Array(ab), { type: 'array' });
    const out = {};
    const norm = (s) => String(s ?? '').trim();
    const normalizeKey = (h) => String(h ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    const likely = {
        trackingId: ['tracking_id','trackingid','tracking','tid','id'],
        address: ['actual_customer_address','customer_address','address'],
        tw: ['time_window','timewindow','tw'],
        start: ['start_time','start','tw_start','time_window_start','starttime'],
        end: ['end_time','end','tw_end','time_window_end','endtime']
    };
    const pickByHeader = (rowObj, keys) => {
        for (const k of keys) {
            if (rowObj[k] != null && String(rowObj[k]).length) return norm(rowObj[k]);
        }
        return '';
    };
    const headerHas = (hdr, pats) => pats.some(p => hdr.includes(p));
    const findHeaderRow = (rows) => {
        const maxScan = Math.min(rows.length, 15);
        for (let r = 0; r < maxScan; r++) {
            const raw = rows[r] || [];
            const hdr = raw.map(normalizeKey).map(h => h.replace(/^unnamed_.*$/, ''));
            if (!hdr.length) continue;
            const hasTracking = hdr.some(h => headerHas(h, likely.trackingId));
            const hasTW = hdr.some(h => headerHas(h, likely.tw)) || (hdr.some(h => headerHas(h, likely.start)) && hdr.some(h => headerHas(h, likely.end)));
            if (hasTracking && hasTW) return { index: r, header: hdr };
        }
        for (let r = 0; r < maxScan; r++) {
            const raw = rows[r] || [];
            const hdr = raw.map(normalizeKey);
            if (hdr.some(Boolean)) return { index: r, header: hdr };
        }
        return { index: 0, header: (rows[0] || []).map(normalizeKey) };
    };
    for (const sheetName of wb.SheetNames) {
        const ws = wb.Sheets[sheetName];
        if (!ws) continue;
        const grid = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });
        if (!grid || grid.length < 2) continue;
        const { index: hdrIdx, header } = findHeaderRow(grid);
        const data = grid.slice(hdrIdx + 1);
        for (const arr of data) {
            if (!arr || !arr.length) continue;
            const rowObj = {};
            header.forEach((h, i) => { if (h) rowObj[h] = arr[i]; });
            const trackingId = norm(pickByHeader(rowObj, likely.trackingId)).toUpperCase();
            if (!trackingId) continue;
            const address = pickByHeader(rowObj, likely.address);
            let timeWindow = pickByHeader(rowObj, likely.tw);
            if (!timeWindow) {
                const st = pickByHeader(rowObj, likely.start);
                const et = pickByHeader(rowObj, likely.end);
                if (st || et) timeWindow = `${st || ''} - ${et || ''}`.trim();
            }
            if (address || timeWindow) out[trackingId] = { address, timeWindow: timeWindow || 'No Time Window' };
        }
    }
    return out;
}

function parseManifestCsv(text) {
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
            } else field += ch;
        } else {
            if (ch === '"') inQuotes = true;
            else if (ch === ',') pushField();
            else if (ch === '\n') { pushField(); pushRow(); }
            else if (ch === '\r') {}
            else field += ch;
        }
        i++;
    }
    if (field.length || row.length) { pushField(); pushRow(); }
    if (rows.length === 0) return {};
    const header = rows[0].map(h => normalizeKey(h));
    const idx = {};
    header.forEach((h, i) => { idx[h] = i; });
    const pick = (r, keys) => {
        for (const k of keys) {
            const i = idx[k];
            if (i != null && r[i] != null) return (r[i] || '').trim();
        }
        return '';
    };
    const out = {};
    for (let r = 1; r < rows.length; r++) {
        const cols = rows[r];
        const trackingId = (pick(cols, ['tracking_id','trackingid','tracking','tid','id']) || '').toUpperCase();
        if (!trackingId) continue;
        const address = pick(cols, ['actual_customer_address','customer_address','address']);
        let timeWindow = pick(cols, ['time_window','timewindow','tw']);
        if (!timeWindow) {
            const st = pick(cols, ['start_time','start']);
            const et = pick(cols, ['end_time','end']);
            if (st || et) timeWindow = `${st || ''} - ${et || ''}`.trim();
        }
        if (address || timeWindow) out[trackingId] = { address, timeWindow: timeWindow || 'No Time Window' };
    }
    return out;
}

function normalizeKey(h) {
    return String(h || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

async function handleBackbriefUpload(evt) {
    try {
        const file = evt.target.files && evt.target.files[0];
        if (!file) return;
        const text = await file.text();
        const rows = parseBackbriefCsv(text);
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        const state = { date: `${yyyy}-${mm}-${dd}`, count: rows.length, rows };
        await browser.storage.local.set({ uploadedBackbriefRows: state });
        updateBackbriefStatus(state);
        showToast(`Uploaded ${state.count} backbrief rows`, 'success');
    } catch (e) {
        console.error('Backbrief upload failed:', e);
        showToast('Failed to process backbrief CSV', 'error');
    } finally {
        if (elements.backbriefUpload) elements.backbriefUpload.value = '';
    }
}

function parseBackbriefCsv(text) {
    const rows = [];
    let i = 0, field = '', inQuotes = false, row = [];
    const pushField = () => { row.push(field); field = ''; };
    const pushRow = () => { if (row.length) rows.push(row); row = []; };
    while (i < text.length) {
        const ch = text[i];
        if (inQuotes) {
            if (ch === '"') { if (text[i+1] === '"') { field += '"'; i++; } else inQuotes = false; }
            else field += ch;
        } else {
            if (ch === '"') inQuotes = true;
            else if (ch === ',') pushField();
            else if (ch === '\n') { pushField(); pushRow(); }
            else if (ch === '\r') {}
            else field += ch;
        }
        i++;
    }
    if (field.length || row.length) { pushField(); pushRow(); }
    if (rows.length === 0) return [];
    const header = rows[0].map(h => normalizeKey(h));
    const idx = {};
    header.forEach((h, i) => { idx[h] = i; });
    const pick = (r, keys) => {
        for (const k of keys) {
            const i = idx[k];
            if (i != null && r[i] != null) return (r[i] || '').trim();
        }
        return '';
    };
    const out = [];
    for (let r = 1; r < rows.length; r++) {
        const cols = rows[r];
        const trackingId = (pick(cols, ['tracking_id','trackingid','tracking','tid','id']) || '').toUpperCase();
        if (!trackingId) continue;
        const deliveryStation = pick(cols, ['delivery_station','ds','station']);
        const route = pick(cols, ['route','route_id','manifestroutecode']);
        const dspName = (pick(cols, ['dsp_name','dsp','latestdspname','compdadata_latestdspname']) || '').toUpperCase();
        const reason = pick(cols, ['reason','internal_reason_code']);
        const attemptReason = pick(cols, ['attempt_reason','compattemptdata_complatestattemptevent_internalreasoncode']);
        const latestAttempt = pick(cols, ['latest_attempt','attempt_time','compattemptdata_complatestattemptevent_timestamp']);
        const addressType = pick(cols, ['address_type']);
        out.push({ trackingId, deliveryStation, route, dspName, reason, attemptReason, latestAttempt, addressType });
    }
    return out;
}

async function sendReattemptsUsingBackbrief() {
    try {
        const { uploadedBackbriefRows } = await browser.storage.local.get('uploadedBackbriefRows');
        if (!uploadedBackbriefRows || !Array.isArray(uploadedBackbriefRows.rows) || uploadedBackbriefRows.rows.length === 0) {
            showToast('Upload a Backbrief CSV first', 'error');
            return;
        }
        try {
            const preview = await browser.runtime.sendMessage({ action: 'previewFailedReattemptStats' });
            if (preview?.success) {
                const { totalRows = 0, matchedTimeWindow = 0, matchedAddress = 0 } = preview;
                showToast(`Preview: ${matchedTimeWindow}/${totalRows} TW, ${matchedAddress}/${totalRows} Address. Sending...`, 'loading');
            }
        } catch {}
        showToast('Running reattempts with uploaded Backbrief...', 'loading');
        const res = await browser.runtime.sendMessage({ action: 'runFailedReattemptReport' });
        if (res?.success) {
            const { sent = 0, dspsNotified = 0 } = res;
            showToast(`Sent ${sent} message(s) across ${dspsNotified} DSP(s)`, 'success');
        } else {
            showToast(res?.error || 'Failed to send reattempts', 'error');
        }
    } catch (e) {
        showToast(e.message || 'Failed to send reattempts', 'error');
    }
}
