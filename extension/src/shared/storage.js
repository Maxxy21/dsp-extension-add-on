/**
 * Storage abstraction layer for WebExtension storage
 * Provides a consistent interface and error handling for browser.storage.local
 */

import { STORAGE_KEYS, DEFAULT_SETTINGS } from './constants.js';

class StorageService {
    constructor() {
        this.storage = browser.storage.local;
        this.cache = new Map();
        this.cacheExpiry = new Map();
        this.cacheTTL = 5 * 60 * 1000; // 5 minutes cache TTL
    }

    /**
     * Get value from storage with optional fallback
     * @param {string} key - Storage key
     * @param {*} fallback - Fallback value if key doesn't exist
     * @returns {Promise<*>} Retrieved value or fallback
     */
    async get(key, fallback = null) {
        try {
            // Check cache first
            if (this.isCacheValid(key)) {
                return this.cache.get(key);
            }

            const result = await this.storage.get(key);
            const value = result[key] !== undefined ? result[key] : fallback;

            // Cache the result
            this.setCache(key, value);

            return value;
        } catch (error) {
            console.error(`Storage get error for key "${key}":`, error);
            return fallback;
        }
    }

    /**
     * Get multiple values from storage
     * @param {Array<string>} keys - Array of storage keys
     * @returns {Promise<object>} Object with key-value pairs
     */
    async getMultiple(keys) {
        try {
            const result = await this.storage.get(keys);

            // Cache results
            keys.forEach(key => {
                if (result[key] !== undefined) {
                    this.setCache(key, result[key]);
                }
            });

            return result;
        } catch (error) {
            console.error('Storage getMultiple error:', error);
            return {};
        }
    }

    /**
     * Set value in storage
     * @param {string} key - Storage key
     * @param {*} value - Value to store
     * @returns {Promise<boolean>} Success status
     */
    async set(key, value) {
        try {
            await this.storage.set({ [key]: value });

            // Update cache
            this.setCache(key, value);

            return true;
        } catch (error) {
            console.error(`Storage set error for key "${key}":`, error);
            return false;
        }
    }

    /**
     * Set multiple key-value pairs
     * @param {object} items - Object with key-value pairs
     * @returns {Promise<boolean>} Success status
     */
    async setMultiple(items) {
        try {
            await this.storage.set(items);

            // Update cache
            Object.entries(items).forEach(([key, value]) => {
                this.setCache(key, value);
            });

            return true;
        } catch (error) {
            console.error('Storage setMultiple error:', error);
            return false;
        }
    }

    /**
     * Remove key from storage
     * @param {string} key - Storage key to remove
     * @returns {Promise<boolean>} Success status
     */
    async remove(key) {
        try {
            await this.storage.remove(key);

            // Remove from cache
            this.cache.delete(key);
            this.cacheExpiry.delete(key);

            return true;
        } catch (error) {
            console.error(`Storage remove error for key "${key}":`, error);
            return false;
        }
    }

    /**
     * Clear all storage data
     * @returns {Promise<boolean>} Success status
     */
    async clear() {
        try {
            await this.storage.clear();

            // Clear cache
            this.cache.clear();
            this.cacheExpiry.clear();

            return true;
        } catch (error) {
            console.error('Storage clear error:', error);
            return false;
        }
    }

    /**
     * Get all storage data
     * @returns {Promise<object>} All stored data
     */
    async getAll() {
        try {
            return await this.storage.get(null);
        } catch (error) {
            console.error('Storage getAll error:', error);
            return {};
        }
    }

    // Convenience methods for common storage operations

    /**
     * Get webhook URLs
     * @returns {Promise<object>} Webhook configuration
     */
    getWebhooks() {
        return this.get(STORAGE_KEYS.WEBHOOKS, {});
    }

    /**
     * Set webhook URLs
     * @param {object} webhooks - Webhook configuration
     * @returns {Promise<boolean>} Success status
     */
    setWebhooks(webhooks) {
        return this.set(STORAGE_KEYS.WEBHOOKS, webhooks);
    }

    /**
     * Get notification settings
     * @returns {Promise<boolean>} Notifications enabled status
     */
    getNotificationsEnabled() {
        return this.get(STORAGE_KEYS.NOTIFICATIONS_ENABLED, DEFAULT_SETTINGS.notificationsEnabled);
    }

    /**
     * Set notification settings
     * @param {boolean} enabled - Notifications enabled status
     * @returns {Promise<boolean>} Success status
     */
    setNotificationsEnabled(enabled) {
        return this.set(STORAGE_KEYS.NOTIFICATIONS_ENABLED, enabled);
    }

    /**
     * Get service type settings
     * @returns {Promise<object>} Service type configuration
     */
    getServiceTypes() {
        return this.get(STORAGE_KEYS.SERVICE_TYPES, DEFAULT_SETTINGS.serviceTypes);
    }

    /**
     * Set service type settings
     * @param {object} serviceTypes - Service type configuration
     * @returns {Promise<boolean>} Success status
     */
    setServiceTypes(serviceTypes) {
        return this.set(STORAGE_KEYS.SERVICE_TYPES, serviceTypes);
    }

    /**
     * Get scheduling base URL
     * @returns {Promise<string>} Scheduling base URL
     */
    getSchedulingBaseUrl() {
        return this.get(STORAGE_KEYS.SCHEDULING_BASE_URL, DEFAULT_SETTINGS.schedulingBaseUrl);
    }

    /**
     * Set scheduling base URL
     * @param {string} url - Scheduling base URL
     * @returns {Promise<boolean>} Success status
     */
    setSchedulingBaseUrl(url) {
        return this.set(STORAGE_KEYS.SCHEDULING_BASE_URL, url);
    }

    /**
     * Get service area ID
     * @returns {Promise<string>} Service area ID
     */
    getServiceAreaId() {
        return this.get(STORAGE_KEYS.SERVICE_AREA_ID, DEFAULT_SETTINGS.serviceAreaId);
    }

    /**
     * Set service area ID
     * @param {string} serviceAreaId - Service area ID
     * @returns {Promise<boolean>} Success status
     */
    setServiceAreaId(serviceAreaId) {
        return this.set(STORAGE_KEYS.SERVICE_AREA_ID, serviceAreaId);
    }

    // Cache management methods

    /**
     * Set cache value with expiry
     * @param {string} key - Cache key
     * @param {*} value - Value to cache
     */
    setCache(key, value) {
        this.cache.set(key, value);
        this.cacheExpiry.set(key, Date.now() + this.cacheTTL);
    }

    /**
     * Check if cache entry is valid
     * @param {string} key - Cache key
     * @returns {boolean} Whether cache entry is valid
     */
    isCacheValid(key) {
        if (!this.cache.has(key) || !this.cacheExpiry.has(key)) {
            return false;
        }

        return Date.now() < this.cacheExpiry.get(key);
    }

    /**
     * Clear expired cache entries
     */
    clearExpiredCache() {
        const now = Date.now();

        for (const [key, expiry] of this.cacheExpiry.entries()) {
            if (now >= expiry) {
                this.cache.delete(key);
                this.cacheExpiry.delete(key);
            }
        }
    }

    /**
     * Initialize storage with default values if needed
     * @returns {Promise<void>}
     */
    async initialize() {
        try {
            const existingData = await this.getAll();
            const updates = {};

            // Set defaults for missing keys
            Object.entries(DEFAULT_SETTINGS).forEach(([key, defaultValue]) => {
                const storageKey = STORAGE_KEYS[key.toUpperCase()] || key;
                if (existingData[storageKey] === undefined) {
                    updates[storageKey] = defaultValue;
                }
            });

            if (Object.keys(updates).length > 0) {
                await this.setMultiple(updates);
                console.log('Storage initialized with default values:', updates);
            }

            // Set up cache cleanup interval
            setInterval(() => this.clearExpiredCache(), this.cacheTTL);
        } catch (error) {
            console.error('Storage initialization error:', error);
        }
    }
}

// Create singleton instance
export const storageService = new StorageService();

// Export class for testing purposes
export { StorageService };
