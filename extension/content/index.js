
// Listen for messages from the background script
browser.runtime.onMessage.addListener(async (request, sender) => {
    console.log('DSP Tool: Content script received message:', request);
    
    if (request.action === "checkMismatches") {
        try {
            console.log('DSP Tool: Starting mismatch check...');
            
            // Get service type from request, default to cycle1
            const serviceType = request.serviceType || 'cycle1';
            console.log(`DSP Tool: Checking mismatches for service type: ${serviceType}`);
            
            // Give the page a moment to fully load
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            const mismatches = await app.dspParser.getFilteredMismatchedData(serviceType);
            console.log(`DSP Tool: Returning mismatches for ${serviceType}:`, mismatches);
            
            return Promise.resolve({ mismatches, serviceType });
        } catch (error) {
            console.error('DSP Tool: Error checking mismatches:', error);
            return Promise.resolve({ mismatches: [], error: error.message, serviceType: request.serviceType });
        }
    }
    
    // Export DSP summaries from Route Planning page (Standard Parcel only)
    if (request.action === 'getDSPSummary') {
        try {
            const dspList = Array.isArray(request.dsps) ? request.dsps : [];
            const { settings = {} } = await browser.storage.local.get('settings');
            const paidTime = Number.isFinite(request.overridePaidTime)
                ? request.overridePaidTime
                : (Number.isFinite(settings.paidTimeMinutes) ? settings.paidTimeMinutes : CONFIG.SUMMARY.PAID_TIME_MINUTES);
            const { items, text } = extractAndFormatDSPSummariesFromRoutePlanning(dspList, paidTime);
            return Promise.resolve({ success: true, text, items, paidTime });
        } catch (error) {
            console.error('DSP Tool: Error generating DSP summary:', error);
            return Promise.resolve({ success: false, error: error.message });
        }
    }

    // Extract Ongoing Risks from Mercury dashboard (c3.amazon.com)
    if (request.action === 'getOngoingRisks') {
        try {
            if (!/c3\.amazon\.com/.test(location.hostname)) {
                throw new Error('Not on Mercury dashboard');
            }
            const rows = extractOngoingRisksFromPage();
            return Promise.resolve({ success: true, rows, url: location.href });
        } catch (error) {
            console.error('Risk extraction failed:', error);
            return Promise.resolve({ success: false, error: error.message, rows: [] });
        }
    }

    // Extract Backbrief failed shipments from Mercury dashboard
    if (request.action === 'getBackbriefFailedShipments') {
        try {
            if (!/c3\.amazon\.com/.test(location.hostname)) {
                throw new Error('Not on Mercury dashboard');
            }
            const { includeReasons = [], mapUnableToAccess = true } = request;
            const rows = extractBackbriefFromPage(includeReasons, mapUnableToAccess);
            return Promise.resolve({ success: true, rows, url: location.href });
        } catch (error) {
            console.error('Backbrief extraction failed:', error);
            return Promise.resolve({ success: false, error: error.message, rows: [] });
        }
    }

    // Try to capture Backbrief CSV download link and return CSV text in-memory
    if (request.action === 'getBackbriefCsv') {
        try {
            if (!/c3\.amazon\.com/.test(location.hostname)) {
                throw new Error('Not on Mercury dashboard');
            }
            const csv = await tryCaptureBackbriefCsv();
            if (!csv) throw new Error('CSV link not found');
            return Promise.resolve({ success: true, csv });
        } catch (error) {
            console.warn('Backbrief CSV capture failed:', error);
            return Promise.resolve({ success: false, error: error.message });
        }
    }

    // Extract Manifest mapping (Tracking ID -> { address, timeWindow }) from Route Planning
    if (request.action === 'getManifestTrackingMap') {
        try {
            if (!/\.route\.planning\.last-mile\.a2z\.com/.test(location.hostname)) {
                throw new Error('Not on Route Planning page');
            }
            const map = extractManifestTrackingMapFromPage();
            return Promise.resolve({ success: true, map, url: location.href });
        } catch (error) {
            console.error('Manifest extraction failed:', error);
            return Promise.resolve({ success: false, error: error.message, map: {} });
        }
    }

    // Extract mapping from Route Sheets page as fallback (Tracking ID -> { address?, timeWindow })
    if (request.action === 'getSheetsTrackingMap') {
        try {
            if (!/\.dispatch\.planning\.last-mile\.a2z\.com/.test(location.hostname)) {
                throw new Error('Not on Route Sheets page');
            }
            const map = extractSheetsTrackingMapFromPage();
            return Promise.resolve({ success: true, map, url: location.href });
        } catch (error) {
            console.error('Sheets extraction failed:', error);
            return Promise.resolve({ success: false, error: error.message, map: {} });
        }
    }

    // Infer Paid Time from Route Constraints page (In Shift Length (mins))
    if (request.action === 'getPaidTimeFromConstraints') {
        try {
            if (!/\.dispatch\.planning\.last-mile\.a2z\.com/.test(location.hostname)) {
                throw new Error('Not on Route Constraints page');
            }
            const minutes = extractPaidTimeFromConstraints();
            if (Number.isFinite(minutes) && minutes > 0) {
                return Promise.resolve({ success: true, minutes });
            }
            return Promise.resolve({ success: false, error: 'Could not infer a consistent value' });
        } catch (error) {
            console.error('Paid time inference failed:', error);
            return Promise.resolve({ success: false, error: error.message });
        }
    }

    return Promise.resolve({ success: true });
});

