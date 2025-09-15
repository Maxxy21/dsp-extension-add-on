import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';
import copy from 'rollup-plugin-copy';

const production = process.env.NODE_ENV === 'production';

// Shared Rollup utilities to keep config DRY
const basePlugins = () => [
    nodeResolve({ browser: true, preferBuiltins: false }),
    commonjs(),
    production && terser({
        mangle: { reserved: ['browser', 'chrome'] },
        compress: {
            pure_funcs: ['console.log', 'console.debug'],
            drop_console: false,
            drop_debugger: true
        }
    })
].filter(Boolean);

const onwarn = (warning, warn) => {
    if (warning.code === 'MISSING_GLOBAL_NAME') return;
    if (warning.message && warning.message.includes('browser')) return;
    warn(warning);
};

const bundle = (input, file) => ({
    input,
    output: { file, format: 'iife', sourcemap: !production },
    plugins: basePlugins(),
    external: ['browser-polyfill'],
    onwarn
});

export default [
    bundle('extension/src/background/index.js', 'extension/dist/background.js'),
    bundle('extension/src/content/index.js', 'extension/dist/content.js'),
    bundle('extension/src/popup/index.js', 'extension/dist/popup/popup.js'),
    bundle('extension/src/options/index.js', 'extension/dist/options/options.js'),
    {
        input: 'extension/src/options/index.js',
        plugins: [
            copy({
                targets: [
                    // Copy existing files that don't need bundling
                    { src: 'extension/manifest.json', dest: 'extension/dist' },
                    { src: 'extension/manifest-v3.json', dest: 'extension/dist' },
                    { src: 'extension/browser-polyfill.js', dest: 'extension/dist' },
                    { src: 'extension/icons/**/*', dest: 'extension/dist/icons' },
                    { src: 'extension/popup/popup.html', dest: 'extension/dist/popup' },
                    { src: 'extension/popup/popup.css', dest: 'extension/dist/popup' },
                    { src: 'extension/options/options.html', dest: 'extension/dist/options' },
                    { src: 'extension/options/options.css', dest: 'extension/dist/options' },
                    { src: 'extension/options/vendor/**/*', dest: 'extension/dist/options/vendor' },
                    { src: 'extension/.amo-upload-uuid', dest: 'extension/dist' }
                ]
            })
        ],
        external: () => true,
        output: {
            file: 'extension/dist/.temp',
            format: 'es'
        }
    }
];
