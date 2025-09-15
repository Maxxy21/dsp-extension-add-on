/**
 * Shared constants for the DSP Management Extension
 */

// Service type configuration
export const SERVICE_TYPE_CONFIG = {
    cycle1: {
        name: 'Standard Parcel',
        displayName: 'Cycle 1 (Standard Parcel)',
        alarms: [
            { name: 'checkDSP_cycle1_14', hour: 14, minute: 0 },
            { name: 'checkDSP_cycle1_1530', hour: 15, minute: 30 },
        ],
    },
    samedayB: {
        name: 'Multi-Use',
        displayName: 'Sameday B (Multi-Use)',
        alarms: [{ name: 'checkDSP_samedayB_10', hour: 10, minute: 0 }],
    },
    samedayC: {
        name: 'Sameday Parcel',
        displayName: 'Sameday C (Sameday Parcel)',
        alarms: [{ name: 'checkDSP_samedayC_1415', hour: 14, minute: 15 }],
    },
};

// CSS selectors for DOM manipulation
export const SELECTORS = {
    // Table and row selectors
    TABLE_ROWS: 'tr',
    TABLE_HEADER: 'thead tr',
    TABLE_BODY: 'tbody',

    // Service type related
    SERVICE_TYPE_EXPANDABLE: 'td span.expandable',
    SERVICE_TYPE_CELL: 'td.serviceType',

    // DSP information
    PROVIDER_NAME: 'td.providerName',
    DSP_CODE_CELL: 'td.dspCode',

    // Roster data
    CONFIRMED_CELL: 'td span[data-bind*="text: confirmed"]',
    ROSTERED_CELL: 'td[data-bind*="text: totalRostered"]',
    PLANNED_CELL: 'td span[data-bind*="text: planned"]',

    // Navigation and controls
    NEXT_BUTTON: 'button[data-bind*="click: next"]',
    PREV_BUTTON: 'button[data-bind*="click: previous"]',
    REFRESH_BUTTON: 'button[data-bind*="click: refresh"]',

    // Filters and search
    DATE_PICKER: 'input[type="date"]',
    SERVICE_FILTER: 'select.serviceTypeFilter',
    DSP_SEARCH: 'input.dspSearch',
};

// Default settings
export const DEFAULT_SETTINGS = {
    serviceTypes: {
        cycle1: true,
        samedayB: false,
        samedayC: false,
    },
    notificationsEnabled: true,
    webhooks: {},
    schedulingBaseUrl: '',
    serviceAreaId: '',
};

// Validation rules
export const VALIDATION_RULES = {
    DSP_CODE: /^[A-Za-z0-9]{3,6}$/,
    MAX_MESSAGE_LENGTH: 2000,
    WEBHOOK_URL_REQUIRED: true,
    MIN_DSP_CODE_LENGTH: 3,
    MAX_DSP_CODE_LENGTH: 6,
};

// Timing constants
export const TIMING = {
    MINUTES_PER_DAY: 24 * 60,
    ALARM_CHECK_INTERVAL: 5 * 60 * 1000, // 5 minutes in milliseconds
    STORAGE_RETRY_DELAY: 1000, // 1 second
    NETWORK_TIMEOUT: 30000, // 30 seconds
    DOM_WAIT_TIMEOUT: 10000, // 10 seconds
};

// URL patterns and constants
export const URL_PATTERNS = {
    AMAZON_LOGISTICS: /^https:\/\/logistics\.amazon\.co\.uk/,
    ROUTE_PLANNING: /^https:\/\/.*\.route\.planning\.last-mile\.a2z\.com/,
    C3_AMAZON: /^https:\/\/c3\.amazon\.com/,
    CHIME_WEBHOOK: /^https:\/\/hooks\.chime\.aws/,
};

// Default URLs
export const DEFAULT_URLS = {
    SCHEDULING_BASE: 'https://logistics.amazon.co.uk/internal/scheduling/dsps',
    ROUTE_PLANNING_BASE: 'https://logistics.amazon.co.uk/route-planning/',
    C3_BASE: 'https://c3.amazon.com',
};

// Message types for internal communication
export const MESSAGE_TYPES = {
    MANUAL_CHECK: 'manualCheck',
    SEND_MESSAGE: 'sendMessage',
    UPDATE_NOTIFICATION_SETTINGS: 'updateNotificationSettings',
    GET_SETTINGS: 'getSettings',
    SAVE_SETTINGS: 'saveSettings',
    UPLOAD_FILE: 'uploadFile',
    SEND_SUMMARY: 'sendSummary',
    SCAN_RISKS: 'scanRisks',
};

// Storage keys
export const STORAGE_KEYS = {
    WEBHOOKS: 'webhooks',
    NOTIFICATIONS_ENABLED: 'notificationsEnabled',
    SERVICE_TYPES: 'serviceTypes',
    SCHEDULING_BASE_URL: 'schedulingBaseUrl',
    SERVICE_AREA_ID: 'serviceAreaId',
    MANIFEST_DATA: 'manifestData',
    BACKBRIEF_DATA: 'backbriefData',
    TEMP_MANIFEST_MAP: 'tempManifestMap',
};

// File types and extensions
export const FILE_CONFIG = {
    ALLOWED_EXTENSIONS: ['.csv', '.xlsx', '.xls'],
    CSV_DELIMITER: ',',
    MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
    ENCODING: 'utf-8',
};

// Error codes for consistent error handling
export const ERROR_CODES = {
    STORAGE_ERROR: 'STORAGE_ERROR',
    NETWORK_ERROR: 'NETWORK_ERROR',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    PARSING_ERROR: 'PARSING_ERROR',
    ALARM_ERROR: 'ALARM_ERROR',
    DOM_ERROR: 'DOM_ERROR',
    FILE_ERROR: 'FILE_ERROR',
};

// Risk scanning configuration
export const RISK_CONFIG = {
    HIGH_RISK_THRESHOLD: 80,
    MEDIUM_RISK_THRESHOLD: 50,
    SCAN_INTERVAL: 15 * 60 * 1000, // 15 minutes
    MAX_RISKS_TO_REPORT: 10,
};

// Notification configuration
export const NOTIFICATION_CONFIG = {
    DEFAULT_TITLE: 'DSP Management Extension',
    ICON_URL: 'icons/icon.svg',
    TIMEOUT: 5000, // 5 seconds
};
