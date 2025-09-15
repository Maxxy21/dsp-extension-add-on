module.exports = {
    env: {
        browser: true,
        es2022: true,
        node: true,
        webextensions: true
    },
    extends: [
        'eslint:recommended',
        'prettier'
    ],
    parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module'
    },
    globals: {
        browser: 'readonly',
        chrome: 'readonly'
    },
    rules: {
        // Code quality
        'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
        'no-console': ['warn', { allow: ['warn', 'error'] }],
        'prefer-const': 'error',
        'no-var': 'error',
        'no-undef': 'error',

        // Modern JavaScript
        'prefer-arrow-callback': 'error',
        'prefer-template': 'error',
        'object-shorthand': 'error',
        'prefer-destructuring': ['error', {
            array: false,
            object: true
        }],


        // Best practices
        'eqeqeq': ['error', 'always'],
        'curly': ['error', 'all'],
        'no-throw-literal': 'error',
        'no-return-await': 'error',

        // Import/Export
        'no-duplicate-imports': 'error',

        // Async/await
        'require-await': 'error',
        'no-async-promise-executor': 'error',

        // Error handling
        'prefer-promise-reject-errors': 'error',

        // Styling (handled by Prettier, but some logic rules)
        'max-len': ['warn', {
            code: 120,
            ignoreUrls: true,
            ignoreComments: true,
            ignoreStrings: true,
            ignoreTemplateLiterals: true
        }],
        'max-depth': ['warn', 4],
        'max-nested-callbacks': ['warn', 3],
        'complexity': ['warn', 10]
    },
    overrides: [
        {
            // Specific rules for test files
            files: ['**/*.test.js', '**/__tests__/**/*.js'],
            env: {
                jest: true
            },
            rules: {
                'no-console': 'off'
            }
        },
        {
            // Specific rules for build scripts
            files: ['scripts/**/*.js', 'rollup.config.js'],
            env: {
                node: true
            },
            rules: {
                'no-console': 'off'
            }
        }
    ]
};
