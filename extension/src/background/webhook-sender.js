/**
 * Webhook Sender - Handles sending messages to configured webhooks
 */

import { storageService } from '../shared/storage.js';
import { isValidWebhookUrl, isValidDSPCode } from '../shared/utils/validation.js';
import { NetworkError, ValidationError } from '../shared/errors.js';
import { TIMING } from '../shared/constants.js';

export class WebhookSender {
    constructor() {
        this.requestQueue = new Map();
        this.rateLimitMap = new Map();
    }

    /**
     * Send message to specific DSP webhook
     * @param {string} dspCode - DSP code
     * @param {string} message - Message to send
     * @param {object} options - Additional options
     * @returns {Promise<boolean>} Success status
     */
    async sendToDSP(dspCode, message, options = {}) {
        try {
            if (!isValidDSPCode(dspCode)) {
                throw ValidationError.fromFieldValidation(
                    'dspCode',
                    dspCode,
                    'Invalid DSP code format'
                );
            }

            const webhooks = await storageService.getWebhooks();
            const webhookUrl = webhooks[dspCode];

            if (!webhookUrl) {
                console.warn(`No webhook configured for DSP: ${dspCode}`);
                return false;
            }

            if (!isValidWebhookUrl(webhookUrl)) {
                throw ValidationError.fromFieldValidation(
                    'webhookUrl',
                    webhookUrl,
                    'Invalid webhook URL'
                );
            }

            return await this.sendWebhook(webhookUrl, message, {
                ...options,
                dspCode,
            });
        } catch (error) {
            console.error(`Failed to send message to ${dspCode}:`, error);
            throw error;
        }
    }

    /**
     * Send message to multiple DSPs
     * @param {Array<string>} dspCodes - Array of DSP codes
     * @param {string} message - Message to send
     * @param {object} options - Additional options
     * @returns {Promise<object>} Results object with success/failure counts
     */
    async sendToMultipleDSPs(dspCodes, message, options = {}) {
        const results = {
            successful: [],
            failed: [],
            totalSent: 0,
            totalFailed: 0,
        };

        const webhooks = await storageService.getWebhooks();

        // Filter out DSPs without webhooks
        const validDSPs = dspCodes.filter(dsp => {
            const hasWebhook = webhooks[dsp];
            if (!hasWebhook) {
                results.failed.push({
                    dsp,
                    error: 'No webhook configured',
                });
            }
            return hasWebhook;
        });

        // Send to all valid DSPs in parallel (with rate limiting)
        const sendPromises = validDSPs.map(async dspCode => {
            try {
                const success = await this.sendToDSP(dspCode, message, options);
                if (success) {
                    results.successful.push(dspCode);
                    results.totalSent++;
                } else {
                    results.failed.push({
                        dsp: dspCode,
                        error: 'Send failed',
                    });
                    results.totalFailed++;
                }
            } catch (error) {
                results.failed.push({
                    dsp: dspCode,
                    error: error.message,
                });
                results.totalFailed++;
            }
        });

        await Promise.allSettled(sendPromises);

        console.log(
            `📊 Bulk send results: ${results.totalSent} successful, ${results.totalFailed} failed`
        );
        return results;
    }

    /**
     * Send message to all configured DSPs
     * @param {string} message - Message to send
     * @param {object} options - Additional options
     * @returns {Promise<object>} Results object
     */
    async sendToAllDSPs(message, options = {}) {
        const webhooks = await storageService.getWebhooks();
        const allDSPs = Object.keys(webhooks);

        return this.sendToMultipleDSPs(allDSPs, message, options);
    }

    /**
     * Send webhook request
     * @param {string} webhookUrl - Webhook URL
     * @param {string} message - Message to send
     * @param {object} options - Additional options
     * @returns {Promise<boolean>} Success status
     */
    async sendWebhook(webhookUrl, message, options = {}) {
        const { dspCode, title = 'DSP Management Extension', urgent = false } = options;

        // Rate limiting check
        if (this.isRateLimited(webhookUrl)) {
            console.warn(`Rate limited for webhook: ${webhookUrl}`);
            return false;
        }

        try {
            const payload = this.createWebhookPayload(message, {
                title,
                dspCode,
                urgent,
                timestamp: new Date().toISOString(),
            });

            const response = await this.makeWebhookRequest(webhookUrl, payload);

            this.updateRateLimit(webhookUrl);

            if (response.ok) {
                console.log(`✅ Webhook sent successfully to ${dspCode || 'unknown'}`);
                return true;
            } else {
                throw NetworkError.fromWebhookError(
                    webhookUrl,
                    response.status,
                    new Error(response.statusText)
                );
            }
        } catch (error) {
            if (error instanceof NetworkError) {
                throw error;
            }
            throw NetworkError.fromWebhookError(webhookUrl, 'unknown', error);
        }
    }

    /**
     * Create webhook payload based on webhook type
     * @param {string} message - Message content
     * @param {object} metadata - Additional metadata
     * @returns {object} Webhook payload
     */
    createWebhookPayload(message, metadata = {}) {
        const { title, dspCode, urgent, timestamp } = metadata;

        // Amazon Chime format (most common)
        if (metadata.webhookUrl?.includes('hooks.chime.aws')) {
            return {
                Content: `**${title}**\n\n${message}\n\n---\n*DSP: ${
                    dspCode || 'N/A'
                } | ${timestamp}*`,
            };
        }

        // Slack format
        if (metadata.webhookUrl?.includes('slack.com')) {
            return {
                text: title,
                attachments: [
                    {
                        color: urgent ? 'danger' : 'good',
                        fields: [
                            {
                                title: 'Message',
                                value: message,
                                short: false,
                            },
                            {
                                title: 'DSP Code',
                                value: dspCode || 'N/A',
                                short: true,
                            },
                            {
                                title: 'Timestamp',
                                value: timestamp,
                                short: true,
                            },
                        ],
                    },
                ],
            };
        }

        // Discord format
        if (metadata.webhookUrl?.includes('discord.com')) {
            return {
                content: `**${title}**`,
                embeds: [
                    {
                        description: message,
                        color: urgent ? 15158332 : 3066993, // Red or green
                        fields: [
                            {
                                name: 'DSP Code',
                                value: dspCode || 'N/A',
                                inline: true,
                            },
                            {
                                name: 'Timestamp',
                                value: timestamp,
                                inline: true,
                            },
                        ],
                    },
                ],
            };
        }

        // Generic format (fallback)
        return {
            text: `${title}\n\n${message}\n\nDSP: ${dspCode || 'N/A'}\nTime: ${timestamp}`,
        };
    }

    /**
     * Make the actual webhook HTTP request
     * @param {string} webhookUrl - Webhook URL
     * @param {object} payload - Payload to send
     * @returns {Promise<Response>} Fetch response
     */
    async makeWebhookRequest(webhookUrl, payload) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), TIMING.NETWORK_TIMEOUT);

        try {
            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
                signal: controller.signal,
            });

            clearTimeout(timeoutId);
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    }

    /**
     * Check if webhook is rate limited
     * @param {string} webhookUrl - Webhook URL to check
     * @returns {boolean} Whether the webhook is rate limited
     */
    isRateLimited(webhookUrl) {
        const lastSent = this.rateLimitMap.get(webhookUrl);
        if (!lastSent) {
            return false;
        }

        const timeSinceLastSent = Date.now() - lastSent;
        const rateLimitWindow = 5000; // 5 seconds between requests

        return timeSinceLastSent < rateLimitWindow;
    }

    /**
     * Update rate limit tracking for webhook
     * @param {string} webhookUrl - Webhook URL
     */
    updateRateLimit(webhookUrl) {
        this.rateLimitMap.set(webhookUrl, Date.now());

        // Clean up old entries after 1 hour
        setTimeout(() => {
            this.rateLimitMap.delete(webhookUrl);
        }, 60 * 60 * 1000);
    }

    /**
     * Test webhook configuration
     * @param {string} dspCode - DSP code to test
     * @returns {Promise<boolean>} Test result
     */
    async testWebhook(dspCode) {
        const testMessage = `🧪 Test message from DSP Management Extension\n\nThis is a test to verify your webhook configuration is working correctly.`;

        try {
            const result = await this.sendToDSP(dspCode, testMessage, {
                title: 'Webhook Test',
                urgent: false,
            });

            if (result) {
                console.log(`✅ Webhook test successful for ${dspCode}`);
            } else {
                console.warn(`⚠️ Webhook test failed for ${dspCode}`);
            }

            return result;
        } catch (error) {
            console.error(`❌ Webhook test error for ${dspCode}:`, error);
            return false;
        }
    }

    /**
     * Get webhook statistics
     * @returns {object} Statistics about webhook usage
     */
    getStatistics() {
        return {
            rateLimitedWebhooks: this.rateLimitMap.size,
            queuedRequests: this.requestQueue.size,
        };
    }
}
