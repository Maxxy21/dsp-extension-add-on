// -------------------------------
// Mercury Risks Extraction (generic table parser)
// -------------------------------

function headerMatches(cellText, patterns) {
    const t = (cellText || '').trim().toLowerCase();
    return patterns.some(p => t.includes(p));
}

function extractOngoingRisksFromPage() {
    const tables = Array.from(document.querySelectorAll('table'));
    const expectedHeaders = {
        date: ['date'],
        cw: ['cw', 'calendar week'],
        dsp: ['dsp', 'dsp name'],
        transporterId: ['transporter id', 'transporter'],
        routeId: ['route id', 'route', 'routeid'],
        bc: ['bc', 'business closed'],
        cna: ['cna', 'customer not available', 'customer unavailable'],
        utl: ['utl', 'unable to locate'],
        uta: ['uta', 'unable to access'],
        missing: ['missing'],
        // Some dashboards split rejected and delayed columns; match both
        rejectedDelayed: ['rejected/delayed', 'rejected & delayed', 'rejected and delayed'],
        rejected: ['rejected'],
        delayedByDa: ['delayed by da', 'delayed'],
        unknownStop: ['unknown stop', 'unknown'],
        reason: ['reason'],
        dspAction: ['dsp action'],
        comment: ['comment'],
        addressType: ['address type', 'address category']
    };

    const results = [];

    for (const table of tables) {
        const rows = Array.from(table.querySelectorAll('tr'));
        if (rows.length < 2) continue;
        // Find a header-like row
        let headerRow = null;
        for (const tr of rows.slice(0, 5)) {
            const cells = Array.from(tr.querySelectorAll('th,td')).map(c => (c.innerText || '').trim());
            if (cells.length < 5) continue;
            const hasDSP = cells.some(c => headerMatches(c, expectedHeaders.dsp));
            const hasRoute = cells.some(c => headerMatches(c, expectedHeaders.routeId));
            if (hasDSP && hasRoute) { headerRow = tr; break; }
        }
        if (!headerRow) continue;

        const headers = Array.from(headerRow.querySelectorAll('th,td'));
        const idx = {};
        headers.forEach((cell, i) => {
            const text = (cell.innerText || '').trim();
            Object.entries(expectedHeaders).forEach(([key, pats]) => {
                if (idx[key] == null && headerMatches(text, pats)) idx[key] = i;
            });
        });

        const resolveCellValue = (tds, key) => {
            const pats = expectedHeaders[key] || [];
            const index = idx[key];
            if (index != null && tds[index]) {
                return (tds[index].innerText || '').trim();
            }
            // Fallback: look for data attributes or text that matches patterns
            for (const td of tds) {
                const attrText = td.getAttribute('data-title') || td.getAttribute('data-column') || td.getAttribute('title') || '';
                if (headerMatches(attrText, pats)) {
                    return (td.innerText || '').trim();
                }
                const text = (td.innerText || '').trim();
                if (headerMatches(text.split(':')[0] || '', pats)) {
                    return text;
                }
            }
            return '';
        };

        // Parse data rows
        for (const tr of rows.slice(rows.indexOf(headerRow) + 1)) {
            const tds = Array.from(tr.querySelectorAll('td'));
            if (tds.length < 5) continue;
            const val = (k) => resolveCellValue(tds, k);
            const record = {
                date: val('date'),
                cw: val('cw'),
                dsp: val('dsp'),
                transporterId: val('transporterId'),
                routeId: val('routeId'),
                bc: val('bc'),
                cna: val('cna'),
                utl: val('utl'),
                uta: val('uta'),
                missing: val('missing'),
                // Prefer combined column, else pass individual fields for background to sum
                rejectedDelayed: val('rejectedDelayed'),
                rejected: val('rejected'),
                delayedByDa: val('delayedByDa'),
                unknownStop: val('unknownStop'),
                reason: val('reason'),
                dspAction: val('dspAction'),
                comment: val('comment'),
                addressType: val('addressType'),
                pageUrl: location.href
            };

            // Skip empty rows
            if (!record.dsp && !record.routeId) continue;
            results.push(record);
        }
    }

    return results;
}
