// @ts-check

import nextConfig from '@synapse/eslint-config/next';
import { defineConfig } from 'eslint/config';

export default defineConfig([
    ...nextConfig,
    {
        ignores: ['.next/**', 'node_modules/**'],
    },
]);
