// Simplified Mismatch Highlighter (like Tampermonkey script)
class MismatchHighlighter {
    highlightMismatches() {
        try {
            console.log('Highlighter: Starting to highlight mismatched cells...');
            const rows = document.querySelectorAll('tr');
            let highlightCount = 0;

            rows.forEach(row => {
                // Get the confirmed (accepted) and rostered cells
                const confirmedCell = row.querySelector('td span[data-bind*="text: confirmed"]');
                const rosteredCell = row.querySelector('td[data-bind*="text: totalRostered"]');

                if (confirmedCell && rosteredCell) {
                    const confirmedValue = parseInt(confirmedCell.textContent, 10);
                    const rosteredValue = parseInt(rosteredCell.textContent, 10);

                    if (!isNaN(confirmedValue) && !isNaN(rosteredValue) && confirmedValue !== rosteredValue) {
                        // Highlight both cells
                        confirmedCell.parentElement.style.backgroundColor = CONFIG.STYLES.HIGHLIGHT_COLOR;
                        rosteredCell.style.backgroundColor = CONFIG.STYLES.HIGHLIGHT_COLOR;

                        // Add a tooltip showing the mismatch
                        const tooltip = `Mismatch - Confirmed: ${confirmedValue}, Rostered: ${rosteredValue}`;
                        confirmedCell.parentElement.title = tooltip;
                        rosteredCell.title = tooltip;
                        
                        highlightCount++;
                        console.log(`Highlighter: Highlighted mismatch - Confirmed: ${confirmedValue}, Rostered: ${rosteredValue}`);
                    }
                }
            });
            
            console.log(`Highlighter: Highlighted ${highlightCount} mismatched rows`);
        } catch (error) {
            console.error('Highlighter: Error highlighting mismatches:', error);
        }
    }
}
