// content/content.js - Enhanced with multi-service type support and DSP summary export for Route Planning

// Configuration constants
const CONFIG = {
    SELECTORS: {
        SERVICE_TYPE_EXPANDABLE: 'td span.expandable',
        SERVICE_TYPE_ROW: '.serviceTypeRow',
        PROVIDER_NAME: 'td.providerName',
        CONFIRMED_CELL: 'td span[data-bind*="text: confirmed"]',
        ROSTERED_CELL: 'td[data-bind*="text: totalRostered"]',
        TABLE: 'table',
        TABLE_ROWS: 'tr'
    },
    STYLES: {
        HIGHLIGHT_COLOR: '#ffebee'
    },
    SERVICE_TYPES: {
        STANDARD_PARCEL: 'Standard Parcel',
        STANDARD_PARCEL_MEDIUM_VAN: 'Standard Parcel Medium Van',
        MULTI_USE: 'Multi-Use',
        SAMEDAY_PARCEL: 'Sameday Parcel'
    },
    SUMMARY: {
        INCLUDED_SERVICE_TYPES: ['Standard Parcel', 'Standard Parcel Medium Van'],
        PAID_TIME_MINUTES: 525
    }
};
