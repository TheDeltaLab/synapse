// @ts-check

import stylistic from '@stylistic/eslint-plugin';
import tseslint from 'typescript-eslint';
import { defineConfig, globalIgnores } from 'eslint/config';
import pluginImport from 'eslint-plugin-import';

export default defineConfig([
    globalIgnores([
        '**/dist/**',
        '**/node_modules/**',
        '**/.nx/**',
        '**/.next/**',
        '**/*.d.ts',
        '**/*.config.js',
        '**/*.config.mjs',
        '**/generated/**',
    ]),
    tseslint.configs.recommended,
    stylistic.configs.customize({
        indent: 4,
        quotes: 'single',
        semi: true,
        braceStyle: '1tbs',
    }),
    {
        settings: { 'import/internal-regex': '^@synapse/' },
        plugins: {
            import: pluginImport,
        },
        rules: {
            '@typescript-eslint/no-namespace': ['off'],
            '@typescript-eslint/no-explicit-any': ['warn'],
            '@stylistic/multiline-ternary': ['off'],
            'import/order': ['error', {
                groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
                alphabetize: { order: 'asc', caseInsensitive: false },
            }],
            '@typescript-eslint/no-unused-vars': ['error', {
                argsIgnorePattern: '^_',
                varsIgnorePattern: '^_',
                caughtErrorsIgnorePattern: '^_',
            }],
        }
    }
]);
