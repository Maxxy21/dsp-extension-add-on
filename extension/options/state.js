if (typeof browser === 'undefined' && typeof chrome !== 'undefined') {
    var browser = chrome;
}

// Shared application state
let isLoading = false;
let webhookEntryCount = 0;
let lastParsedManifestMap = null;

// DOM cache
let elements = {};

// Service type configuration
const SERVICE_TYPES = {
    cycle1: {
        name: 'Cycle 1 (Standard Parcel)',
        times: ['14:00', '15:00'],
        elementId: 'enableCycle1',
        timingId: 'cycle1Timing'
    },
    samedayB: {
        name: 'Sameday B (Multi-Use)',
        times: ['10:00'],
        elementId: 'enableSamedayB',
        timingId: 'samedayBTiming'
    },
    samedayC: {
        name: 'Sameday C (Sameday Parcel)',
        times: ['14:15'],
        elementId: 'enableSamedayC',
        timingId: 'samedayCTiming'
    }
};
