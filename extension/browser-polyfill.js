// Browser polyfill for Chrome and Firefox extension APIs
(function() {
    'use strict';

    if (typeof browser !== 'undefined') {
        // Firefox already has the browser API
        return;
    }

    if (typeof chrome === 'undefined') {
        // No extension API available
        return;
    }

    // Create browser namespace based on chrome API
    window.browser = {
        action: chrome.action,
        alarms: chrome.alarms,
        bookmarks: chrome.bookmarks,
        browserAction: chrome.browserAction,
        contextMenus: chrome.contextMenus,
        cookies: chrome.cookies,
        downloads: chrome.downloads,
        extension: chrome.extension,
        history: chrome.history,
        i18n: chrome.i18n,
        identity: chrome.identity,
        idle: chrome.idle,
        management: chrome.management,
        notifications: chrome.notifications,
        pageAction: chrome.pageAction,
        permissions: chrome.permissions,
        runtime: chrome.runtime,
        scripting: chrome.scripting,
        search: chrome.search,
        sessions: chrome.sessions,
        storage: chrome.storage,
        tabs: chrome.tabs,
        topSites: chrome.topSites,
        webNavigation: chrome.webNavigation,
        webRequest: chrome.webRequest,
        windows: chrome.windows
    };

    // Promisify chrome APIs that use callbacks
    const promisifyApi = (api, methods) => {
        methods.forEach(method => {
            if (api && api[method]) {
                const originalMethod = api[method];
                api[method] = function(...args) {
                    return new Promise((resolve, reject) => {
                        args.push((result) => {
                            if (chrome.runtime.lastError) {
                                reject(new Error(chrome.runtime.lastError.message));
                            } else {
                                resolve(result);
                            }
                        });
                        originalMethod.apply(api, args);
                    });
                };
            }
        });
    };

    // Promisify common APIs
    if (browser.tabs) {
        promisifyApi(browser.tabs, ['query', 'get', 'create', 'update', 'remove', 'sendMessage']);
    }
    
    if (browser.storage && browser.storage.local) {
        promisifyApi(browser.storage.local, ['get', 'set', 'remove', 'clear']);
    }
    
    if (browser.storage && browser.storage.sync) {
        promisifyApi(browser.storage.sync, ['get', 'set', 'remove', 'clear']);
    }

    if (browser.runtime) {
        promisifyApi(browser.runtime, ['sendMessage', 'sendNativeMessage']);
    }

})();