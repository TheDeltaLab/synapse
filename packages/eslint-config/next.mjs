// @ts-check

import baseConfig from './base.mjs';
import { defineConfig } from 'eslint/config';

export default defineConfig([
    ...baseConfig,
    {
        rules: {
            // Next.js specific rules
            '@typescript-eslint/no-explicit-any': ['off'], // Next.js uses any in some APIs
        }
    }
]);
