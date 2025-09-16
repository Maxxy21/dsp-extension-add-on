// -------------------------------
// Route Planning Manifest Extraction
// -------------------------------

function extractManifestTrackingMapFromPage() {
    const tables = Array.from(document.querySelectorAll('table'));
    const expectedHeaders = {
        trackingId: ['tracking id', 'tid', 'id'],
        address: ['actual customer address', 'address'],
        timeWindow: ['time window', 'tw'],
        startTime: ['start time', 'start'],
        endTime: ['end time', 'end']
    };

    const out = {};
    for (const table of tables) {
        const rows = Array.from(table.querySelectorAll('tr'));
        if (rows.length < 2) continue;
        let headerRow = null;
        for (const tr of rows.slice(0, 5)) {
            const cells = Array.from(tr.querySelectorAll('th,td')).map(c => (c.innerText || '').trim());
            if (cells.length < 3) continue;
            const hasTid = cells.some(c => headerMatches(c, expectedHeaders.trackingId));
            const hasAddr = cells.some(c => headerMatches(c, expectedHeaders.address));
            if (hasTid && hasAddr) { headerRow = tr; break; }
        }
        if (!headerRow) continue;

        const headers = Array.from(headerRow.querySelectorAll('th,td')).map(c => (c.innerText || '').trim());
        const idx = {};
        headers.forEach((h, i) => {
            Object.entries(expectedHeaders).forEach(([key, pats]) => {
                if (idx[key] == null && headerMatches(h, pats)) idx[key] = i;
            });
        });
        const hasTimeWindow = idx.timeWindow != null || (idx.startTime != null && idx.endTime != null);

        for (const tr of rows.slice(rows.indexOf(headerRow) + 1)) {
            const tds = Array.from(tr.querySelectorAll('td'));
            if (tds.length < 3) continue;
            const val = (k) => {
                const i = idx[k];
                return i != null && tds[i] ? (tds[i].innerText || '').trim() : '';
            };
            const tid = (val('trackingId') || '').toUpperCase();
            if (!tid) continue;
            const address = val('address');
            let timeWindow = '';
            if (idx.timeWindow != null) {
                timeWindow = val('timeWindow');
            } else if (idx.startTime != null && idx.endTime != null) {
                const st = val('startTime');
                const et = val('endTime');
                if (st || et) timeWindow = `${st || ''} - ${et || ''}`.trim();
            }

            if (address) {
                out[tid] = {
                    address,
                    timeWindow: hasTimeWindow ? (timeWindow || 'No Time Window') : 'No Time Window'
                };
            }
        }
    }
    return out;
}

function extractSheetsTrackingMapFromPage() {
    const tables = Array.from(document.querySelectorAll('table'));
    const expectedHeaders = {
        trackingId: ['tracking id', 'tid', 'id'],
        address: ['address', 'customer address', 'actual customer address'],
        timeWindow: ['time window', 'tw']
    };
    const out = {};
    for (const table of tables) {
        const rows = Array.from(table.querySelectorAll('tr'));
        if (rows.length < 2) continue;
        let headerRow = null;
        for (const tr of rows.slice(0, 5)) {
            const cells = Array.from(tr.querySelectorAll('th,td')).map(c => (c.innerText || '').trim());
            if (cells.length < 3) continue;
            const hasTid = cells.some(c => headerMatches(c, expectedHeaders.trackingId));
            const hasTW = cells.some(c => headerMatches(c, expectedHeaders.timeWindow));
            if (hasTid && hasTW) { headerRow = tr; break; }
        }
        if (!headerRow) continue;

        const headers = Array.from(headerRow.querySelectorAll('th,td')).map(c => (c.innerText || '').trim());
        const idx = {};
        headers.forEach((h, i) => {
            Object.entries(expectedHeaders).forEach(([key, pats]) => {
                if (idx[key] == null && headerMatches(h, pats)) idx[key] = i;
            });
        });

        for (const tr of rows.slice(rows.indexOf(headerRow) + 1)) {
            const tds = Array.from(tr.querySelectorAll('td'));
            if (tds.length < 3) continue;
            const val = (k) => {
                const i = idx[k];
                return i != null && tds[i] ? (tds[i].innerText || '').trim() : '';
            };
            const tid = (val('trackingId') || '').toUpperCase();
            if (!tid) continue;
            const address = val('address');
            const timeWindow = val('timeWindow');
            if (timeWindow) {
                out[tid] = { address, timeWindow };
            }
        }
    }
    return out;
}
