// -------------------------------
// Backbrief Extraction (Mercury)
// -------------------------------

function extractBackbriefFromPage(includeReasons = [], mapUnableToAccess = true) {
    const tables = Array.from(document.querySelectorAll('table'));
    const expectedHeaders = {
        trackingId: ['tracking id', 'tid', 'id'],
        deliveryStation: ['delivery station', 'ds'],
        route: ['route'],
        dspName: ['dsp name', 'dsp'],
        reason: ['reason'],
        attemptReason: ['attempt reason'],
        latestAttempt: ['latest attempt', 'attempt time', 'time'],
        addressType: ['address type']
    };

    const results = [];

    for (const table of tables) {
        const rows = Array.from(table.querySelectorAll('tr'));
        if (rows.length < 2) continue;
        // Find a header-like row containing Tracking ID and DSP columns
        let headerRow = null;
        for (const tr of rows.slice(0, 5)) {
            const cells = Array.from(tr.querySelectorAll('th,td')).map(c => (c.innerText || '').trim());
            if (cells.length < 5) continue;
            const hasTid = cells.some(c => headerMatches(c, expectedHeaders.trackingId));
            const hasDsp = cells.some(c => headerMatches(c, expectedHeaders.dspName));
            if (hasTid && hasDsp) { headerRow = tr; break; }
        }
        if (!headerRow) continue;

        const headers = Array.from(headerRow.querySelectorAll('th,td')).map(c => (c.innerText || '').trim());
        const idx = {};
        headers.forEach((h, i) => {
            Object.entries(expectedHeaders).forEach(([key, pats]) => {
                if (idx[key] == null && headerMatches(h, pats)) idx[key] = i;
            });
        });

        // Parse data rows
        for (const tr of rows.slice(rows.indexOf(headerRow) + 1)) {
            const tds = Array.from(tr.querySelectorAll('td'));
            if (tds.length < 5) continue;
            const val = (k) => {
                const i = idx[k];
                return i != null && tds[i] ? (tds[i].innerText || '').trim() : '';
            };

            let reason = val('reason');
            const attemptReason = val('attemptReason');
            if (mapUnableToAccess && attemptReason === 'UNABLE_TO_ACCESS') {
                reason = 'UNABLE_TO_ACCESS';
            }

            if (Array.isArray(includeReasons) && includeReasons.length > 0) {
                if (!includeReasons.includes(reason)) continue;
            }

            const record = {
                trackingId: val('trackingId').toUpperCase(),
                deliveryStation: val('deliveryStation'),
                route: val('route'),
                dspName: val('dspName').toUpperCase(),
                reason,
                attemptReason,
                latestAttempt: val('latestAttempt'),
                addressType: val('addressType')
            };

            // Skip if no tracking id
            if (!record.trackingId) continue;
            results.push(record);
        }
    }

    return results;
}

function extractPaidTimeFromConstraints() {
    const tables = Array.from(document.querySelectorAll('table'));
    const headerMatch = (t) => /shift\s*length/i.test(t) || /in\s*shift/i.test(t);
    for (const table of tables) {
        const rows = Array.from(table.querySelectorAll('tr'));
        if (rows.length < 2) continue;
        // find header row
        let headerRow = null;
        for (const tr of rows.slice(0, 5)) {
            const cells = Array.from(tr.querySelectorAll('th,td')).map(c => (c.innerText || '').trim());
            if (cells.length < 3) continue;
            if (cells.some(headerMatch)) { headerRow = tr; break; }
        }
        if (!headerRow) continue;
        const headers = Array.from(headerRow.querySelectorAll('th,td')).map(c => (c.innerText || '').trim().toLowerCase());
        const colIndex = headers.findIndex(h => /shift\s*length/.test(h));
        const minutes = [];
        for (const tr of rows.slice(rows.indexOf(headerRow) + 1)) {
            const tds = Array.from(tr.querySelectorAll('td'));
            if (tds.length === 0) continue;
            let val = '';
            if (colIndex >= 0 && tds[colIndex]) val = (tds[colIndex].innerText || '').trim();
            else {
                // Try to guess column by finding a pure integer cell commonly used
                const candidate = Array.from(tds).map(td => (td.innerText || '').trim()).find(x => /^\d{2,4}$/.test(x));
                val = candidate || '';
            }
            const n = parseInt((val || '').replace(/[^\d-]/g, ''), 10);
            if (Number.isFinite(n)) minutes.push(n);
        }
        if (minutes.length > 0 && minutes.every(m => m === minutes[0])) {
            return minutes[0];
        }
    }
    return 0;
}

async function tryCaptureBackbriefCsv() {
    // Heuristic: look for anchors likely pointing to CSV (blob: or data:) anywhere in the document
    const anchors = Array.from(document.querySelectorAll('a'));
    let csvLink = anchors.find(a => {
        const href = a.getAttribute('href') || '';
        const dl = a.getAttribute('download') || '';
        const txt = (a.textContent || '').trim();
        const looksCsv = /csv/i.test(dl) || /download\.csv/i.test(txt) || /csv/i.test(txt);
        const looksHref = /^blob:/.test(href) || /^data:text\/csv/i.test(href);
        return looksCsv && looksHref;
    });
    if (!csvLink) return '';
    try {
        const href = csvLink.getAttribute('href');
        const resp = await fetch(href);
        const blob = await resp.blob();
        const text = await blob.text();
        return text;
    } catch (e) {
        console.warn('Failed to fetch CSV link:', e);
        return '';
    }
}
