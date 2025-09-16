// -------------------------------
// Route Planning Summary Export
// -------------------------------

function extractAndFormatDSPSummariesFromRoutePlanning(targetDSPs = [], paidTimeMinutes = CONFIG.SUMMARY.PAID_TIME_MINUTES) {
    // Guard: only proceed on Route Planning pages
    const isRoutePlanning = /\.route\.planning\.last-mile\.a2z\.com/.test(location.hostname);
    if (!isRoutePlanning) {
        throw new Error('Not on Route Planning page');
    }

    // Find the main data table(s). Route Planning uses generic <table> markup.
    const tables = Array.from(document.querySelectorAll('table'));
    if (!tables || tables.length === 0) {
        throw new Error('No tables found on page');
    }

    // Aggregate rows across all tables; use structure seen in raw.html
    const rows = [];
    tables.forEach(tbl => {
        const bodyRows = tbl.querySelectorAll('tbody > tr');
        bodyRows.forEach(tr => rows.push(tr));
    });

    // Parse rows -> records
    const records = [];
    for (const tr of rows) {
        const tds = tr.querySelectorAll('td');
        if (tds.length < 8) continue;

        const serviceType = (tds[0]?.innerText || '').trim();
        const dsp = (tds[1]?.innerText || '').trim();
        const shiftTime = Utils.parseInteger((tds[2]?.innerText || '').trim());
        const spr = Utils.parseInteger((tds[7]?.innerText || '').trim());

        // Filter: service type must be one of the included; skip empty DSPs
        if (!CONFIG.SUMMARY.INCLUDED_SERVICE_TYPES.includes(serviceType)) continue;
        if (!dsp) continue;
        if (!Number.isFinite(shiftTime) || !Number.isFinite(spr)) continue;

        records.push({ serviceType, dsp, shiftTime, spr });
    }

    // Group by DSP and compute averages
    const agg = new Map(); // dsp -> { totalShift, totalSpr, count }
    for (const r of records) {
        if (!agg.has(r.dsp)) agg.set(r.dsp, { totalShift: 0, totalSpr: 0, count: 0 });
        const a = agg.get(r.dsp);
        a.totalShift += r.shiftTime;
        a.totalSpr += r.spr;
        a.count += 1;
    }

    // If targetDSPs provided, restrict output
    const dspKeys = targetDSPs.length > 0
        ? targetDSPs.filter(d => agg.has(d))
        : Array.from(agg.keys());

    // Format summaries
    const items = {};
    const parts = [];
    // Compute today's date (DD.MM.YYYY) for header context
    const _now = new Date();
    const todayStr = `${String(_now.getDate()).padStart(2, '0')}.${String(_now.getMonth() + 1).padStart(2, '0')}.${_now.getFullYear()}`;
    for (const dsp of dspKeys.sort()) {
        const a = agg.get(dsp);
        if (!a || a.count === 0) continue;
        const avgShift = Math.round(a.totalShift / a.count);
        const avgSpr = Math.round(a.totalSpr / a.count);

        items[dsp] = { avgShift, avgSpr, paid: paidTimeMinutes };

        // Use concise emoji-based format, mirroring popup summary template
        const block = [
            '📋 Daily Route Planning Summary',
            '',
            `🚚 ${dsp} | ${todayStr}`,
            '',
            `📦 SPR: ${avgSpr}`,
            `⏱️ Shift Time: ${avgShift} min`,
            `💰 Paid Time: ${paidTimeMinutes} min`,
        ].join('\n');

        parts.push(block);
    }

    return { items, text: parts.join('\n\n') };
}
