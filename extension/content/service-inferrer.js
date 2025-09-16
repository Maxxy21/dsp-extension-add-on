// Service Type Inference Module (similar to amzl-scripts wavegroup inference)
class ServiceTypeInferrer {
    constructor() {
        this.availableServiceTypes = new Set();
        this.currentPageServiceTypes = new Set();
        this.urlParams = null;
    }

    initialize() {
        // Extract URL parameters (similar to amzl-scripts approach)
        this.urlParams = new URLSearchParams(window.location.search);
        this.inferServiceTypesFromPage();
    }

    inferServiceTypesFromPage() {
        try {
            console.log('ServiceTypeInferrer: Analyzing page for available service types...');
            
            // Method 1: Check URL parameters for clues
            this.inferFromURLParams();
            
            // Method 2: Scan DOM for service type indicators (similar to amzl-scripts DOM traversal)
            this.inferFromDOM();
            
            // Method 3: Check table structure for service type rows
            this.inferFromTableStructure();
            
            console.log('ServiceTypeInferrer: Detected service types:', Array.from(this.currentPageServiceTypes));
            return Array.from(this.currentPageServiceTypes);
        } catch (error) {
            console.error('ServiceTypeInferrer: Error during inference:', error);
            return ['cycle1']; // Fallback to default
        }
    }

    inferFromURLParams() {
        // Similar to amzl-scripts line 155-157
        const serviceAreaId = this.urlParams.get('serviceAreaId');
        const date = this.urlParams.get('date');
        
        if (serviceAreaId || date) {
            console.log('ServiceTypeInferrer: Found URL parameters, likely a scheduling page');
            // Default assumption - all service types might be available
            this.availableServiceTypes.add('cycle1');
            this.availableServiceTypes.add('samedayB');
            this.availableServiceTypes.add('samedayC');
        }
    }

    inferFromDOM() {
        try {
            // Similar to amzl-scripts DOM traversal approach (lines 232-242)
            const serviceTypeElements = document.querySelectorAll(CONFIG.SELECTORS.SERVICE_TYPE_EXPANDABLE);
            
            serviceTypeElements.forEach(element => {
                const serviceTypeName = element.textContent.trim();
                console.log('ServiceTypeInferrer: Found service type element:', serviceTypeName);
                
                // Map display names to internal types (similar to amzl-scripts waveType mapping)
                if (serviceTypeName.includes('Standard Parcel') || serviceTypeName.includes('Cycle 1')) {
                    this.currentPageServiceTypes.add('cycle1');
                } else if (serviceTypeName.includes('Multi-Use') || serviceTypeName.includes('Sameday B')) {
                    this.currentPageServiceTypes.add('samedayB');
                } else if (serviceTypeName.includes('Sameday Parcel') || serviceTypeName.includes('Sameday C')) {
                    this.currentPageServiceTypes.add('samedayC');
                }
            });
        } catch (error) {
            console.warn('ServiceTypeInferrer: Error scanning DOM for service types:', error);
        }
    }

    inferFromTableStructure() {
        try {
            // Look for service type rows in the table (similar to amzl-scripts table parsing)
            const rows = document.querySelectorAll(CONFIG.SELECTORS.TABLE_ROWS);
            
            rows.forEach(row => {
                // Check if row contains service type information
                const serviceTypeCell = row.querySelector(CONFIG.SELECTORS.SERVICE_TYPE_EXPANDABLE);
                if (serviceTypeCell) {
                    const text = serviceTypeCell.textContent.trim();
                    
                    // Infer service type from text content
                    if (text.match(/(Standard.*Parcel|Cycle.*1)/i)) {
                        this.currentPageServiceTypes.add('cycle1');
                    } else if (text.match(/(Multi.?Use|Sameday.*B)/i)) {
                        this.currentPageServiceTypes.add('samedayB');
                    } else if (text.match(/(Sameday.*Parcel|Sameday.*C)/i)) {
                        this.currentPageServiceTypes.add('samedayC');
                    }
                }
            });
        } catch (error) {
            console.warn('ServiceTypeInferrer: Error analyzing table structure:', error);
        }
    }

    getDetectedServiceTypes() {
        return Array.from(this.currentPageServiceTypes);
    }

    hasServiceType(serviceType) {
        return this.currentPageServiceTypes.has(serviceType);
    }

    // Auto-update service type settings based on page detection
    async updateStorageWithDetected() {
        try {
            const detectedTypes = this.getDetectedServiceTypes();
            
            if (detectedTypes.length === 0) {
                console.log('ServiceTypeInferrer: No service types detected, keeping current settings');
                return;
            }

            // Get current settings
            const { serviceTypes = {} } = await browser.storage.local.get('serviceTypes');
            
            // Create updated settings based on detection
            const updatedServiceTypes = {
                cycle1: detectedTypes.includes('cycle1'),
                samedayB: detectedTypes.includes('samedayB'),
                samedayC: detectedTypes.includes('samedayC')
            };

            // Only update if different from current
            const hasChanges = Object.keys(updatedServiceTypes).some(
                key => updatedServiceTypes[key] !== serviceTypes[key]
            );

            if (hasChanges) {
                console.log('ServiceTypeInferrer: Auto-updating service type settings:', updatedServiceTypes);
                await browser.storage.local.set({ 
                    serviceTypes: updatedServiceTypes,
                    lastInferredTypes: detectedTypes,
                    inferenceTimestamp: Date.now()
                });

                // Notify background script of the change
                try {
                    browser.runtime.sendMessage({
                        action: 'serviceTypesInferred',
                        detectedTypes: detectedTypes,
                        updatedSettings: updatedServiceTypes
                    });
                } catch (e) {
                    console.warn('ServiceTypeInferrer: Could not notify background script:', e);
                }
            }
        } catch (error) {
            console.error('ServiceTypeInferrer: Error updating storage with detected types:', error);
        }
    }
}
