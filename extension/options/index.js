document.addEventListener('DOMContentLoaded', async () => {
    console.log('🎉 Enhanced options page initializing...');
    try {
        cacheElements();
        setLoading(true);
        await loadSettings();
        setupTabs();
        await restoreActiveTab();
        setupEventListeners();
        setLoading(false);
        console.log('✅ Options page initialized successfully');
    } catch (error) {
        console.error('❌ Error during initialization:', error);
        showToast('Failed to initialize settings: ' + (error.message || 'unknown error'), 'error');
        setLoading(false);
    }
});
