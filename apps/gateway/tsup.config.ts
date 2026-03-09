import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['src/index.ts'],
    format: ['esm'],
    dts: false,
    splitting: false,
    sourcemap: true,
    clean: true,
    target: 'node20',
    outDir: 'dist',
    // Bundle workspace packages since they export TypeScript directly
    noExternal: ['@synapse/shared', '@synapse/dal', '@synapse/config'],
    // Keep packages with native bindings or CommonJS dynamic requires external
    external: [
        'bcrypt',
        'ioredis',
        '@prisma/client',
        'pg',
        'pg-native',
    ],
});
