import globals from 'globals';
import pluginJs from '@eslint/js';
import pluginTypescript from '@typescript-eslint/eslint-plugin';
import parserTypescript from '@typescript-eslint/parser';

/** @type {import('eslint').Linter.Config[]} */
export default [
    {
        files: ['**/*.ts', '**/*.tsx', '**/*.js'],
        languageOptions: {
            parser: parserTypescript,
            sourceType: 'module',
            globals: {
                ...globals.node,
            },
        },
        plugins: {
            '@typescript-eslint': pluginTypescript,
        },
        rules: {
            '@typescript-eslint/no-unused-vars': ['error'],
            '@typescript-eslint/explicit-module-boundary-types': 'off',
        },
    },
    pluginJs.configs.recommended,
];
