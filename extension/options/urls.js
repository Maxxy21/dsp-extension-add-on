function computeDateParam(serviceType) {
    const now = new Date();
    const date = new Date(now);
    if (serviceType === 'cycle1') {
        date.setDate(date.getDate() + 1);
    }
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

function buildSchedulingUrl(settings, isCycle1, dateStr) {
    const base = settings.schedulingBaseUrl || '';
    if (!base) {
        const serviceAreaId = settings.serviceAreaId || '';
        const params = new URLSearchParams();
        if (serviceAreaId) params.set('serviceAreaId', serviceAreaId);
        params.set('date', dateStr);
        return `https://logistics.amazon.co.uk/internal/scheduling/dsps?${params.toString()}`;
    }
    try {
        const url = new URL(base, 'https://logistics.amazon.co.uk');
        if (isCycle1) {
            const tomorrow = computeDateParam('cycle1');
            url.searchParams.set('date', tomorrow);
        } else {
            url.searchParams.set('date', dateStr);
        }
        return url.toString();
    } catch (e) {
        return base + (base.includes('?') ? `&date=${dateStr}` : `?date=${dateStr}`);
    }
}

function buildRoutePlanningUrl(settings, dateStr) {
    const base = settings.routePlanningBaseUrl || '';
    if (!base) return 'https://eu.route.planning.last-mile.a2z.com/route-planning';
    try {
        const url = new URL(base);
        if (/\/route-planning\/[A-Z0-9]+\/.+/.test(url.pathname)) {
            return `${url.origin}${url.pathname}/${dateStr}`;
        }
        return base;
    } catch (e) {
        return base.endsWith('/') ? base + dateStr : `${base}/${dateStr}`;
    }
}

async function renderUrlPreviews() {
    try {
        const { settings = {} } = await browser.storage.local.get('settings');
        const today = computeDateParam('other');
        const tomorrow = computeDateParam('cycle1');
        const schedCycle1 = buildSchedulingUrl(settings, true, tomorrow);
        const schedToday = buildSchedulingUrl(settings, false, today);
        const routeToday = buildRoutePlanningUrl(settings, today);
        if (!elements.urlPreviews) return;
        while (elements.urlPreviews.firstChild) elements.urlPreviews.removeChild(elements.urlPreviews.firstChild);
        const items = [
            { label: 'Scheduling (Cycle 1 - tomorrow)', url: schedCycle1 },
            { label: 'Scheduling (Today)', url: schedToday },
            { label: 'Route Planning (Today)', url: routeToday }
        ];
        items.forEach(item => {
            const row = document.createElement('div');
            row.className = 'url-preview';

            const label = document.createElement('div');
            label.className = 'url-label';
            label.textContent = item.label;

            const link = document.createElement('a');
            link.className = 'url-link';
            link.href = item.url;
            link.textContent = item.url;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';

            row.appendChild(label);
            row.appendChild(link);
            elements.urlPreviews.appendChild(row);
        });
    } catch (e) {
        console.warn('Failed to render URL previews:', e);
    }
}

function normalizeSchedulingUrl(input, fallbackServiceAreaId) {
    if (!input) {
        return {
            schedulingBaseUrl: fallbackServiceAreaId
                ? `https://logistics.amazon.co.uk/internal/scheduling/dsps?serviceAreaId=${encodeURIComponent(fallbackServiceAreaId)}`
                : '',
            parsedServiceAreaId: fallbackServiceAreaId || ''
        };
    }
    try {
        const url = new URL(input);
        const base = `${url.origin}${url.pathname}`;
        const sa = url.searchParams.get('serviceAreaId') || fallbackServiceAreaId || '';
        const baseParams = new URLSearchParams();
        if (sa) baseParams.set('serviceAreaId', sa);
        return {
            schedulingBaseUrl: sa ? `${base}?${baseParams.toString()}` : base,
            parsedServiceAreaId: sa
        };
    } catch (e) {
        return { schedulingBaseUrl: input, parsedServiceAreaId: fallbackServiceAreaId || '' };
    }
}

function normalizeRoutePlanningUrl(input) {
    if (!input) return { routePlanningBaseUrl: '' };
    try {
        const url = new URL(input);
        const parts = url.pathname.split('/').filter(Boolean);
        const rpIndex = parts.findIndex(p => p === 'route-planning');
        if (rpIndex !== -1 && parts.length >= rpIndex + 3) {
            const station = parts[rpIndex + 1];
            const planId = parts[rpIndex + 2];
            const basePath = `/route-planning/${station}/${planId}`;
            return { routePlanningBaseUrl: `${url.origin}${basePath}` };
        }
        return { routePlanningBaseUrl: input.replace(/\/[0-9]{4}-[0-9]{2}-[0-9]{2}\/?$/, '') };
    } catch (e) {
        return { routePlanningBaseUrl: input.replace(/\/[0-9]{4}-[0-9]{2}-[0-9]{2}\/?$/, '') };
    }
}
