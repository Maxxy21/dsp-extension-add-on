// Enhanced Main Application Class
class DSPManagementTool {
    constructor() {
        this.dspParser = new DSPDataParser();
        this.highlighter = new MismatchHighlighter();
        this.initialized = false;
        this.highlightTimeout = null;
        this._isRoutePlanning = /\.route\.planning\.last-mile\.a2z\.com/.test(location.hostname);
    }

    initialize() {
        if (this.initialized) {
            console.log('DSP Tool: Already initialized');
            return;
        }
        
        try {
            console.log('DSP Tool: Initializing...');
            
            // Wait for page to be loaded
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this.setupTool());
            } else {
                this.setupTool();
            }
            
            this.initialized = true;
            console.log('DSP Tool: Initialized successfully');
        } catch (error) {
            console.error('DSP Tool: Error during initialization:', error);
        }
    }

    async setupTool() {
        console.log('DSP Tool: Setting up tool...');
        
        // On Scheduling page, enable mismatch highlighting + inference
        if (!this._isRoutePlanning) {
            this.dspParser.serviceInferrer.initialize();
            await this.dspParser.serviceInferrer.updateStorageWithDetected();
            this.setupHighlighting();
            this.setupTableObserver();
        }
    }

    async setupHighlighting() {
        try {
            console.log('DSP Tool: Setting up highlighting for all service types');
            
            // Run highlighting with progressive delays to catch dynamic content
            const delays = [2000, 5000, 8000];
            
            delays.forEach(delay => {
                setTimeout(() => {
                    console.log(`DSP Tool: Running highlighting after ${delay}ms for all service types`);
                    this.highlighter.highlightMismatches();
                }, delay);
            });
        } catch (error) {
            console.error('DSP Tool: Error setting up highlighting:', error);
            // Fallback to basic highlighting
            const delays = [2000, 5000, 8000];
            delays.forEach(delay => {
                setTimeout(() => {
                    this.highlighter.highlightMismatches();
                }, delay);
            });
        }
    }

    setupTableObserver() {
        try {
            // Try to find table immediately (like Tampermonkey script)
            let table = document.querySelector('table');
            
            if (!table) {
                console.log('DSP Tool: Table not found immediately, setting up observer to wait for it');
                
                // Set up observer to wait for table
                const observer = new MutationObserver((mutations) => {
                    table = document.querySelector('table');
                    if (table) {
                        console.log('DSP Tool: Table found, setting up table observer');
                        observer.disconnect();
                        this.observeTable(table);
                    }
                });
                
                observer.observe(document.body, {
                    childList: true,
                    subtree: true
                });
                
                // Stop looking after 30 seconds
                setTimeout(() => {
                    observer.disconnect();
                    console.log('DSP Tool: Stopped waiting for table after 30 seconds');
                }, 30000);
            } else {
                this.observeTable(table);
            }
        } catch (error) {
            console.error('DSP Tool: Error setting up table observer:', error);
        }
    }

    observeTable(table) {
        try {
            console.log('DSP Tool: Setting up mutation observer on table');
            
            const observer = new MutationObserver((mutations) => {
                if (this.shouldUpdateHighlights(mutations)) {
                    // Debounce the highlighting to avoid excessive calls
                    clearTimeout(this.highlightTimeout);
                    this.highlightTimeout = setTimeout(async () => {
                        console.log('DSP Tool: Table changed, updating highlights');
                        
                        try {
                            console.log('DSP Tool: Updating highlights for all service types');
                            this.highlighter.highlightMismatches();
                        } catch (error) {
                            console.error('DSP Tool: Error updating highlights:', error);
                            this.highlighter.highlightMismatches();
                        }
                    }, 1000);
                }
            });

            observer.observe(table, {
                childList: true,
                subtree: true,
                characterData: true,
                attributes: true,
                attributeFilter: ['data-bind', 'class']
            });
            
            console.log('DSP Tool: Table observer set up successfully');
        } catch (error) {
            console.error('DSP Tool: Error setting up table mutation observer:', error);
        }
    }

    shouldUpdateHighlights(mutations) {
        return mutations.some(mutation => {
            // Check for content changes that might affect data
            return mutation.type === 'childList' || 
                   mutation.type === 'characterData' ||
                   (mutation.type === 'attributes' && 
                    ['data-bind', 'class'].includes(mutation.attributeName));
        });
    }
}

// Initialize the application
console.log('DSP Management Tool: Enhanced content script loaded');
const app = new DSPManagementTool();

// Wait a bit for the page to start loading, then initialize
setTimeout(() => {
    app.initialize();
}, 1000);
