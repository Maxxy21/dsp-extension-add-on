/**
 * DSP Manager - Handles DSP selection and management in the popup
 */

import { storageService } from '../shared/storage.js';
import { isValidDSPCode } from '../shared/utils/validation.js';
import { withErrorHandling } from '../shared/errors.js';

export class DSPManager {
    constructor(messageService) {
        this.messageService = messageService;
        this.availableDSPs = {};
        this.selectedDSPs = new Set();
        this.selectionMode = 'individual'; // 'individual', 'multiple', 'all'

        this.elements = {
            dspSelect: null,
            checkboxContainer: null,
            totalDspCount: null,
            individualGroup: null,
            multipleGroup: null,
            allGroup: null,
        };
    }

    /**
     * Initialize the DSP manager with DOM elements
     * @param {object} elements - DOM elements object
     */
    initialize(elements) {
        this.elements = { ...this.elements, ...elements };
        this.setupEventListeners();
        this.loadAvailableDSPs();
    }

    /**
     * Set up event listeners for DSP selection
     */
    setupEventListeners() {
        // Selection mode radio buttons
        const selectionModes = ['individual', 'multiple', 'all'];
        selectionModes.forEach(mode => {
            const radio = document.querySelector(`input[name="targetType"][value="${mode}"]`);
            if (radio) {
                radio.addEventListener(
                    'change',
                    withErrorHandling(
                        () => this.handleSelectionModeChange(mode),
                        'DSPManager.handleSelectionModeChange'
                    )
                );
            }
        });

        // Individual DSP select
        if (this.elements.dspSelect) {
            this.elements.dspSelect.addEventListener(
                'change',
                withErrorHandling(
                    this.handleIndividualSelection.bind(this),
                    'DSPManager.handleIndividualSelection'
                )
            );
        }

        // Multiple DSP checkboxes (handled dynamically)
        if (this.elements.checkboxContainer) {
            this.elements.checkboxContainer.addEventListener(
                'change',
                withErrorHandling(
                    this.handleMultipleSelection.bind(this),
                    'DSPManager.handleMultipleSelection'
                )
            );
        }
    }

    /**
     * Load available DSPs from storage
     * @returns {Promise<void>}
     */
    async loadAvailableDSPs() {
        try {
            console.log('📋 Loading available DSPs...');

            const webhooks = await storageService.getWebhooks();
            this.availableDSPs = webhooks || {};

            this.updateDSPOptions();
            this.updateDSPCheckboxes();
            this.updateDSPCount();

            console.log(`✅ Loaded ${Object.keys(this.availableDSPs).length} DSPs`);
        } catch (error) {
            console.error('Failed to load DSPs:', error);
            this.showError('Failed to load DSP list');
        }
    }

    /**
     * Update the individual DSP select dropdown
     */
    updateDSPOptions() {
        if (!this.elements.dspSelect) {
            return;
        }

        // Clear existing options
        // Reset options safely
        while (this.elements.dspSelect.firstChild) {
            this.elements.dspSelect.removeChild(this.elements.dspSelect.firstChild);
        }
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = 'Select DSP...';
        this.elements.dspSelect.appendChild(placeholder);

        // Add DSP options
        const sortedDSPs = Object.keys(this.availableDSPs).sort();

        for (const dspCode of sortedDSPs) {
            const option = document.createElement('option');
            option.value = dspCode;
            option.textContent = dspCode;
            this.elements.dspSelect.appendChild(option);
        }

        // Update disabled state
        this.elements.dspSelect.disabled = sortedDSPs.length === 0;
    }

    /**
     * Update the multiple DSP checkboxes
     */
    updateDSPCheckboxes() {
        if (!this.elements.checkboxContainer) {
            return;
        }

        // Clear existing checkboxes
        // Clear checkbox container safely
        this.elements.checkboxContainer.textContent = '';

        const sortedDSPs = Object.keys(this.availableDSPs).sort();

        if (sortedDSPs.length === 0) {
            const p = document.createElement('p');
            p.className = 'no-dsps';
            p.textContent = 'No DSPs configured';
            this.elements.checkboxContainer.appendChild(p);
            return;
        }

        // Create checkboxes
        for (const dspCode of sortedDSPs) {
            const checkboxWrapper = document.createElement('div');
            checkboxWrapper.className = 'checkbox-wrapper';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `dsp_${dspCode}`;
            checkbox.value = dspCode;
            checkbox.className = 'dsp-checkbox';

            const label = document.createElement('label');
            label.htmlFor = `dsp_${dspCode}`;
            label.textContent = dspCode;
            label.className = 'dsp-label';

            checkboxWrapper.appendChild(checkbox);
            checkboxWrapper.appendChild(label);
            this.elements.checkboxContainer.appendChild(checkboxWrapper);
        }

        // Add select all/none controls
        this.addSelectAllControls();
    }

    /**
     * Add select all/none controls to checkbox container
     */
    addSelectAllControls() {
        if (!this.elements.checkboxContainer) {
            return;
        }

        const controlsWrapper = document.createElement('div');
        controlsWrapper.className = 'selection-controls';

        const selectAllBtn = document.createElement('button');
        selectAllBtn.type = 'button';
        selectAllBtn.textContent = 'Select All';
        selectAllBtn.className = 'btn btn-small';
        selectAllBtn.addEventListener('click', () => this.selectAllDSPs(true));

        const selectNoneBtn = document.createElement('button');
        selectNoneBtn.type = 'button';
        selectNoneBtn.textContent = 'Select None';
        selectNoneBtn.className = 'btn btn-small';
        selectNoneBtn.addEventListener('click', () => this.selectAllDSPs(false));

        controlsWrapper.appendChild(selectAllBtn);
        controlsWrapper.appendChild(selectNoneBtn);

        this.elements.checkboxContainer.appendChild(controlsWrapper);
    }

    /**
     * Handle selection mode change
     * @param {string} mode - New selection mode
     */
    handleSelectionModeChange(mode) {
        this.selectionMode = mode;
        this.selectedDSPs.clear();

        // Update UI visibility
        this.updateGroupVisibility();

        // Clear previous selections
        this.clearSelections();

        console.log(`📋 Selection mode changed to: ${mode}`);
    }

    /**
     * Update visibility of selection groups
     */
    updateGroupVisibility() {
        const groups = {
            individual: this.elements.individualGroup,
            multiple: this.elements.multipleGroup,
            all: this.elements.allGroup,
        };

        Object.entries(groups).forEach(([mode, element]) => {
            if (element) {
                element.style.display = mode === this.selectionMode ? 'block' : 'none';
            }
        });
    }

    /**
     * Handle individual DSP selection
     * @param {Event} event - Change event
     */
    handleIndividualSelection(event) {
        const selectedDSP = event.target.value;

        this.selectedDSPs.clear();

        if (selectedDSP && isValidDSPCode(selectedDSP)) {
            this.selectedDSPs.add(selectedDSP);
            console.log(`📋 Selected individual DSP: ${selectedDSP}`);
        }

        this.updateSendButtonText();
    }

    /**
     * Handle multiple DSP selection via checkboxes
     * @param {Event} event - Change event
     */
    handleMultipleSelection(event) {
        if (!event.target.classList.contains('dsp-checkbox')) {
            return;
        }

        const dspCode = event.target.value;

        if (event.target.checked) {
            this.selectedDSPs.add(dspCode);
        } else {
            this.selectedDSPs.delete(dspCode);
        }

        console.log(`📋 Multiple selection updated: ${Array.from(this.selectedDSPs).join(', ')}`);
        this.updateSendButtonText();
    }

    /**
     * Select or deselect all DSPs
     * @param {boolean} selectAll - Whether to select all or none
     */
    selectAllDSPs(selectAll) {
        const checkboxes = this.elements.checkboxContainer?.querySelectorAll('.dsp-checkbox') || [];

        this.selectedDSPs.clear();

        checkboxes.forEach(checkbox => {
            checkbox.checked = selectAll;
            if (selectAll) {
                this.selectedDSPs.add(checkbox.value);
            }
        });

        console.log(`📋 ${selectAll ? 'Selected all' : 'Deselected all'} DSPs`);
        this.updateSendButtonText();
    }

    /**
     * Clear all selections
     */
    clearSelections() {
        this.selectedDSPs.clear();

        // Clear individual select
        if (this.elements.dspSelect) {
            this.elements.dspSelect.value = '';
        }

        // Clear checkboxes
        const checkboxes = this.elements.checkboxContainer?.querySelectorAll('.dsp-checkbox') || [];
        checkboxes.forEach(checkbox => {
            checkbox.checked = false;
        });

        this.updateSendButtonText();
    }

    /**
     * Update DSP count display
     */
    updateDSPCount() {
        if (!this.elements.totalDspCount) {
            return;
        }

        const count = Object.keys(this.availableDSPs).length;
        this.elements.totalDspCount.textContent = count;
    }

    /**
     * Update send button text based on selection
     */
    updateSendButtonText() {
        const sendButtonText = document.getElementById('sendButtonText');
        if (!sendButtonText) {
            return;
        }

        let text = 'Send Message';

        switch (this.selectionMode) {
            case 'individual':
                if (this.selectedDSPs.size === 1) {
                    text = `Send to ${Array.from(this.selectedDSPs)[0]}`;
                }
                break;

            case 'multiple':
                if (this.selectedDSPs.size > 0) {
                    text = `Send to ${this.selectedDSPs.size} DSPs`;
                }
                break;

            case 'all': {
                const totalDSPs = Object.keys(this.availableDSPs).length;
                text = `Send to All (${totalDSPs} DSPs)`;
                break;
            }
        }

        sendButtonText.textContent = text;
    }

    /**
     * Get selected DSPs based on current mode
     * @returns {Array<string>} Array of selected DSP codes
     */
    getSelectedDSPs() {
        switch (this.selectionMode) {
            case 'individual':
                return Array.from(this.selectedDSPs);

            case 'multiple':
                return Array.from(this.selectedDSPs);

            case 'all':
                return Object.keys(this.availableDSPs);

            default:
                return [];
        }
    }

    /**
     * Get selection info for messaging
     * @returns {object} Selection information
     */
    getSelectionInfo() {
        const selectedDSPs = this.getSelectedDSPs();

        return {
            mode: this.selectionMode,
            dsps: selectedDSPs,
            count: selectedDSPs.length,
            isValid: selectedDSPs.length > 0,
        };
    }

    /**
     * Validate current selection
     * @returns {object} Validation result
     */
    validateSelection() {
        const selectedDSPs = this.getSelectedDSPs();

        if (selectedDSPs.length === 0) {
            return {
                isValid: false,
                error: 'No DSPs selected',
            };
        }

        // Validate DSP codes
        const invalidDSPs = selectedDSPs.filter(dsp => !isValidDSPCode(dsp));
        if (invalidDSPs.length > 0) {
            return {
                isValid: false,
                error: `Invalid DSP codes: ${invalidDSPs.join(', ')}`,
            };
        }

        return {
            isValid: true,
            dsps: selectedDSPs,
        };
    }

    /**
     * Refresh DSP list from storage
     * @returns {Promise<void>}
     */
    async refresh() {
        await this.loadAvailableDSPs();
        this.clearSelections();
    }

    /**
     * Show error message
     * @param {string} message - Error message
     */
    showError(message) {
        // This would integrate with the popup's toast system
        console.error('DSP Manager Error:', message);

        // Find toast element and show error
        const toast = document.getElementById('status');
        if (toast) {
            toast.textContent = message;
            toast.className = 'toast error show';
            setTimeout(() => {
                toast.className = 'toast';
            }, 3000);
        }
    }

    /**
     * Get statistics about DSP management
     * @returns {object} Statistics
     */
    getStatistics() {
        return {
            totalDSPs: Object.keys(this.availableDSPs).length,
            selectedCount: this.selectedDSPs.size,
            selectionMode: this.selectionMode,
            hasValidSelection: this.validateSelection().isValid,
        };
    }
}
