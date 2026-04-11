import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['src/**/*.ts', 'src/**/*.tsx', '!src/**/*.test.ts'],
    format: ['cjs', 'esm'],
    dts: true,
    clean: true,
    sourcemap: true,
    tsconfig: 'tsconfig.json',
    bundle: false,
    splitting: false,
    outDir: 'dist',
    esbuildOptions(options) {
        options.outbase = 'src';
    },
});
