/**
 * File Upload Manager - Handles file uploads and processing in options
 */

import { parseCSV } from '../shared/utils/parser-utils.js';
import { isValidFileExtension } from '../shared/utils/validation.js';
import { FILE_CONFIG } from '../shared/constants.js';
import { FileError, ParsingError, withErrorHandling } from '../shared/errors.js';

export class FileUploadManager {
    constructor() {
        this.uploadHistory = [];
        this.isProcessing = false;
        this.elements = {};
    }

    /**
     * Initialize file upload manager
     * @param {object} elements - DOM elements
     */
    initialize(elements) {
        this.elements = elements;
        this.setupEventListeners();
        this.setupDropZones();
    }

    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // File input change events
        const fileInputs = ['manifestFileInput', 'backbriefFileInput', 'batchFileInput'];

        fileInputs.forEach(inputId => {
            const input = document.getElementById(inputId);
            if (input) {
                input.addEventListener(
                    'change',
                    withErrorHandling(
                        event => this.handleFileSelect(event, inputId),
                        'FileUploadManager.handleFileSelect'
                    )
                );
            }
        });

        // Upload buttons
        const uploadButtons = ['uploadManifestBtn', 'uploadBackbriefBtn', 'uploadBatchBtn'];

        uploadButtons.forEach(buttonId => {
            const button = document.getElementById(buttonId);
            if (button) {
                button.addEventListener(
                    'click',
                    withErrorHandling(
                        () => this.triggerFileSelect(buttonId),
                        'FileUploadManager.triggerFileSelect'
                    )
                );
            }
        });

        // Clear buttons
        const clearButtons = ['clearManifestBtn', 'clearBackbriefBtn', 'clearBatchBtn'];

        clearButtons.forEach(buttonId => {
            const button = document.getElementById(buttonId);
            if (button) {
                button.addEventListener(
                    'click',
                    withErrorHandling(
                        () => this.clearUploadedData(buttonId),
                        'FileUploadManager.clearUploadedData'
                    )
                );
            }
        });
    }

    /**
     * Set up drag and drop zones
     */
    setupDropZones() {
        const dropZones = document.querySelectorAll('.file-drop-zone');

        dropZones.forEach(zone => {
            zone.addEventListener('dragover', event => {
                event.preventDefault();
                zone.classList.add('drag-over');
            });

            zone.addEventListener('dragleave', () => {
                zone.classList.remove('drag-over');
            });

            zone.addEventListener(
                'drop',
                withErrorHandling(
                    event => this.handleFileDrop(event, zone),
                    'FileUploadManager.handleFileDrop'
                )
            );
        });
    }

    /**
     * Handle file selection
     * @param {Event} event - Change event
     * @param {string} inputId - Input element ID
     */
    async handleFileSelect(event, inputId) {
        const file = event.target.files[0];
        if (!file) {
            return;
        }

        const uploadType = this.getUploadTypeFromInputId(inputId);
        await this.processFile(file, uploadType);
    }

    /**
     * Handle file drop
     * @param {DragEvent} event - Drop event
     * @param {Element} dropZone - Drop zone element
     */
    async handleFileDrop(event, dropZone) {
        event.preventDefault();
        dropZone.classList.remove('drag-over');

        const files = Array.from(event.dataTransfer.files);
        if (files.length === 0) {
            return;
        }

        const file = files[0]; // Process only the first file
        const uploadType = dropZone.getAttribute('data-upload-type');

        if (uploadType) {
            await this.processFile(file, uploadType);
        }
    }

    /**
     * Trigger file selection for upload button
     * @param {string} buttonId - Button ID
     */
    triggerFileSelect(buttonId) {
        const inputMap = {
            uploadManifestBtn: 'manifestFileInput',
            uploadBackbriefBtn: 'backbriefFileInput',
            uploadBatchBtn: 'batchFileInput',
        };

        const inputId = inputMap[buttonId];
        const input = document.getElementById(inputId);

        if (input) {
            input.click();
        }
    }

    /**
     * Process uploaded file
     * @param {File} file - File to process
     * @param {string} uploadType - Type of upload
     * @returns {Promise<object>} Processing result
     */
    async processFile(file, uploadType) {
        if (this.isProcessing) {
            throw new Error('File processing already in progress');
        }

        try {
            this.isProcessing = true;
            console.log(`📁 Processing ${uploadType} file: ${file.name}`);

            // Validate file
            this.validateFile(file);

            // Show processing status
            this.updateUploadStatus(uploadType, 'Processing file...', 'info');

            // Parse file based on type
            const data = await this.parseFile(file, uploadType);

            // Save to storage
            await this.saveUploadedData(uploadType, data, file.name);

            // Update UI
            this.updateUploadStatus(
                uploadType,
                `File processed: ${data.length || Object.keys(data).length} records`,
                'success'
            );
            this.updateFileInfo(uploadType, file, data);

            // Add to history
            this.addToHistory(uploadType, file.name, data);

            console.log(`✅ File processing complete: ${file.name}`);

            return {
                success: true,
                data,
                fileName: file.name,
                uploadType,
                recordCount: Array.isArray(data) ? data.length : Object.keys(data).length,
            };
        } catch (error) {
            console.error('File processing failed:', error);
            this.updateUploadStatus(uploadType, `Error: ${error.message}`, 'error');
            throw error;
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * Validate uploaded file
     * @param {File} file - File to validate
     */
    validateFile(file) {
        // Check file size
        if (file.size > FILE_CONFIG.MAX_FILE_SIZE) {
            throw FileError.fromFileSize(file.name, file.size, FILE_CONFIG.MAX_FILE_SIZE);
        }

        // Check file type
        if (!isValidFileExtension(file.name, FILE_CONFIG.ALLOWED_EXTENSIONS)) {
            const extension = file.name.substring(file.name.lastIndexOf('.'));
            throw FileError.fromFileType(file.name, extension, FILE_CONFIG.ALLOWED_EXTENSIONS);
        }
    }

    /**
     * Parse file based on type and format
     * @param {File} file - File to parse
     * @param {string} uploadType - Upload type
     * @returns {Promise<*>} Parsed data
     */
    async parseFile(file, uploadType) {
        const extension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));

        try {
            if (extension === '.csv') {
                return await this.parseCSVFile(file, uploadType);
            } else if (extension === '.xlsx' || extension === '.xls') {
                return await this.parseExcelFile(file, uploadType);
            } else {
                throw new Error(`Unsupported file format: ${extension}`);
            }
        } catch (error) {
            throw new ParsingError(`Failed to parse ${extension} file`, {
                fileName: file.name,
                uploadType,
                originalError: error.message,
            });
        }
    }

    /**
     * Parse CSV file
     * @param {File} file - CSV file
     * @param {string} uploadType - Upload type
     * @returns {Promise<*>} Parsed data
     */
    async parseCSVFile(file, uploadType) {
        const text = await this.readFileAsText(file);

        if (!text.trim()) {
            throw new Error('File is empty');
        }

        const data = parseCSV(text, {
            delimiter: FILE_CONFIG.CSV_DELIMITER,
            headers: true,
            skipEmptyLines: true,
        });

        return this.processUploadData(data, uploadType);
    }

    /**
     * Parse Excel file
     * @param {File} file - Excel file
     * @param {string} uploadType - Upload type
     * @returns {Promise<*>} Parsed data
     */
    parseExcelFile(_file, _uploadType) {
        // This would require the XLSX library which is already included
        // For now, we'll indicate that Excel parsing is not yet implemented
        throw new Error('Excel file parsing not yet implemented in refactored version');
    }

    /**
     * Process uploaded data based on type
     * @param {Array} data - Raw parsed data
     * @param {string} uploadType - Upload type
     * @returns {*} Processed data
     */
    processUploadData(data, uploadType) {
        switch (uploadType) {
            case 'manifest':
                return this.processManifestData(data);

            case 'backbrief':
                return this.processBackbriefData(data);

            case 'batch':
                return this.processBatchData(data);

            default:
                throw new Error(`Unknown upload type: ${uploadType}`);
        }
    }

    /**
     * Process manifest data
     * @param {Array} data - Raw manifest data
     * @returns {object} Processed manifest data
     */
    processManifestData(data) {
        const manifestMap = {};

        for (const row of data) {
            const trackingId = row.tracking || row['Tracking ID'] || row['Package ID'];
            const dspCode = row.dsp || row['DSP'] || row['DSP Code'];

            if (trackingId && dspCode) {
                manifestMap[trackingId] = {
                    dsp: dspCode,
                    route: row.route || row['Route'],
                    driver: row.driver || row['Driver'],
                    status: row.status || row['Status'] || 'Pending',
                    uploadedAt: new Date().toISOString(),
                };
            }
        }

        if (Object.keys(manifestMap).length === 0) {
            throw new Error('No valid manifest entries found. Expected columns: tracking, dsp');
        }

        return manifestMap;
    }

    /**
     * Process backbrief data
     * @param {Array} data - Raw backbrief data
     * @returns {Array} Processed backbrief data
     */
    processBackbriefData(data) {
        const processed = [];

        for (const row of data) {
            const trackingId = row.tracking || row['Tracking ID'] || row['Package ID'];
            const reason = row.reason || row['Reason'] || row['Failure Reason'];

            if (trackingId || reason) {
                processed.push({
                    tracking: trackingId || 'Unknown',
                    dsp: row.dsp || row['DSP'] || 'Unknown',
                    reason: reason || 'Unknown',
                    status: row.status || row['Status'] || 'Failed',
                    attempt: parseInt(row.attempt || row['Attempt'] || '1', 10),
                    uploadedAt: new Date().toISOString(),
                });
            }
        }

        if (processed.length === 0) {
            throw new Error('No valid backbrief entries found. Expected columns: tracking, reason');
        }

        return processed;
    }

    /**
     * Process batch data
     * @param {Array} data - Raw batch data
     * @returns {Array} Processed batch data
     */
    processBatchData(data) {
        const processed = [];

        for (const row of data) {
            const dspCode = row.dsp || row['DSP'] || row['DSP Code'];
            const message = row.message || row['Message'];

            if (dspCode) {
                processed.push({
                    dsp: dspCode,
                    message: message || 'Default message',
                    uploadedAt: new Date().toISOString(),
                });
            }
        }

        if (processed.length === 0) {
            throw new Error('No valid batch entries found. Expected columns: dsp');
        }

        return processed;
    }

    /**
     * Save uploaded data to storage
     * @param {string} uploadType - Upload type
     * @param {*} data - Data to save
     * @param {string} fileName - Original file name
     */
    async saveUploadedData(uploadType, data, fileName) {
        const storageKey = this.getStorageKeyForUploadType(uploadType);

        const uploadRecord = {
            data,
            fileName,
            uploadedAt: new Date().toISOString(),
            recordCount: Array.isArray(data) ? data.length : Object.keys(data).length,
        };

        await browser.storage.local.set({ [storageKey]: uploadRecord });

        console.log(`💾 Saved ${uploadType} data to storage: ${uploadRecord.recordCount} records`);
    }

    /**
     * Clear uploaded data
     * @param {string} buttonId - Clear button ID
     */
    async clearUploadedData(buttonId) {
        const typeMap = {
            clearManifestBtn: 'manifest',
            clearBackbriefBtn: 'backbrief',
            clearBatchBtn: 'batch',
        };

        const uploadType = typeMap[buttonId];
        if (!uploadType) {
            return;
        }

        try {
            const storageKey = this.getStorageKeyForUploadType(uploadType);
            await browser.storage.local.remove(storageKey);

            this.updateUploadStatus(uploadType, 'Data cleared', 'info');
            this.clearFileInfo(uploadType);

            console.log(`🧹 Cleared ${uploadType} data`);
        } catch (error) {
            console.error(`Failed to clear ${uploadType} data:`, error);
            this.updateUploadStatus(uploadType, 'Failed to clear data', 'error');
        }
    }

    /**
     * Get upload type from input ID
     * @param {string} inputId - Input element ID
     * @returns {string} Upload type
     */
    getUploadTypeFromInputId(inputId) {
        const typeMap = {
            manifestFileInput: 'manifest',
            backbriefFileInput: 'backbrief',
            batchFileInput: 'batch',
        };

        return typeMap[inputId] || 'unknown';
    }

    /**
     * Get storage key for upload type
     * @param {string} uploadType - Upload type
     * @returns {string} Storage key
     */
    getStorageKeyForUploadType(uploadType) {
        const keyMap = {
            manifest: 'manifestData',
            backbrief: 'backbriefData',
            batch: 'batchData',
        };

        return keyMap[uploadType] || `${uploadType}Data`;
    }

    /**
     * Update upload status display
     * @param {string} uploadType - Upload type
     * @param {string} message - Status message
     * @param {string} type - Status type
     */
    updateUploadStatus(uploadType, message, type = 'info') {
        const statusElement = document.getElementById(`${uploadType}Status`);
        if (statusElement) {
            statusElement.textContent = message;
            statusElement.className = `upload-status ${type}`;
        }
    }

    /**
     * Update file info display
     * @param {string} uploadType - Upload type
     * @param {File} file - Uploaded file
     * @param {*} data - Parsed data
     */
    updateFileInfo(uploadType, file, data) {
        const infoElement = document.getElementById(`${uploadType}Info`);
        if (infoElement) {
            const recordCount = Array.isArray(data) ? data.length : Object.keys(data).length;

            // Clear existing content
            infoElement.textContent = '';

            const wrap = document.createElement('div');
            wrap.className = 'file-info';

            const nameStrong = document.createElement('strong');
            nameStrong.textContent = file.name;
            wrap.appendChild(nameStrong);
            wrap.appendChild(document.createElement('br'));

            const sizeText = document.createTextNode(`Size: ${this.formatFileSize(file.size)}`);
            wrap.appendChild(sizeText);
            wrap.appendChild(document.createElement('br'));

            const recText = document.createTextNode(`Records: ${recordCount}`);
            wrap.appendChild(recText);
            wrap.appendChild(document.createElement('br'));

            const uploadedText = document.createTextNode(
                `Uploaded: ${new Date().toLocaleString()}`
            );
            wrap.appendChild(uploadedText);

            infoElement.appendChild(wrap);
        }
    }

    /**
     * Clear file info display
     * @param {string} uploadType - Upload type
     */
    clearFileInfo(uploadType) {
        const infoElement = document.getElementById(`${uploadType}Info`);
        if (infoElement) {
            infoElement.textContent = '';
        }
    }

    /**
     * Format file size for display
     * @param {number} bytes - File size in bytes
     * @returns {string} Formatted size
     */
    formatFileSize(bytes) {
        if (bytes === 0) {
            return '0 Bytes';
        }

        const k = 1024;
        const units = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        const value = (bytes / Math.pow(k, i)).toFixed(2);

        return `${parseFloat(value)} ${units[i]}`;
    }

    /**
     * Read file as text
     * @param {File} file - File to read
     * @returns {Promise<string>} File content
     */
    readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(FileError.fromFileRead(file.name, reader.error));
            reader.readAsText(file, FILE_CONFIG.ENCODING);
        });
    }

    /**
     * Add upload to history
     * @param {string} uploadType - Upload type
     * @param {string} fileName - File name
     * @param {*} data - Processed data
     */
    addToHistory(uploadType, fileName, data) {
        const recordCount = Array.isArray(data) ? data.length : Object.keys(data).length;

        this.uploadHistory.unshift({
            uploadType,
            fileName,
            recordCount,
            timestamp: new Date().toISOString(),
        });

        // Keep only last 10 uploads
        this.uploadHistory = this.uploadHistory.slice(0, 10);
    }

    /**
     * Get upload statistics
     * @returns {object} Upload statistics
     */
    getStatistics() {
        return {
            uploadHistory: this.uploadHistory,
            isProcessing: this.isProcessing,
            totalUploads: this.uploadHistory.length,
            lastUpload: this.uploadHistory[0] || null,
        };
    }
}
