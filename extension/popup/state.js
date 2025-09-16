if (typeof browser === 'undefined' && typeof chrome !== 'undefined') {
    var browser = chrome;
}

let availableDSPs = {};
let isLoading = false;
let elements = {};
