module.exports = {
    // Basic formatting
    semi: true,
    trailingComma: 'es5',
    singleQuote: true,
    quoteProps: 'as-needed',
    tabWidth: 4,
    useTabs: false,

    // Line length
    printWidth: 100,

    // Bracket spacing
    bracketSpacing: true,
    bracketSameLine: false,

    // Arrow functions
    arrowParens: 'avoid',

    // Prose
    proseWrap: 'preserve',

    // HTML/CSS (for HTML files in the extension)
    htmlWhitespaceSensitivity: 'css',

    // End of line
    endOfLine: 'lf',

    // Override for specific file types
    overrides: [
        {
            files: '*.json',
            options: {
                tabWidth: 2
            }
        },
        {
            files: ['*.yml', '*.yaml'],
            options: {
                tabWidth: 2
            }
        },
        {
            files: '*.md',
            options: {
                tabWidth: 2,
                proseWrap: 'always'
            }
        }
    ]
};