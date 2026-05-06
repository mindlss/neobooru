import globals from 'globals';
import pluginJs from '@eslint/js';
import pluginTypescript from '@typescript-eslint/eslint-plugin';

export default [
    {
        ignores: [
            'dist/**',
            'coverage/**',
            'docker/data/**',
            'logs/**',
            'node_modules/**',
            'src/generated/**',
        ],
    },
    pluginJs.configs.recommended,
    ...pluginTypescript.configs['flat/recommended'],
    {
        files: ['**/*.{js,cjs,mjs,ts,cts,mts,tsx}'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: {
                ...globals.node,
            },
        },
        rules: {
            'no-console': ['warn', { allow: ['warn', 'error'] }],
            'no-undef': 'off',
            'preserve-caught-error': 'off',
            '@typescript-eslint/consistent-type-imports': 'off',
            '@typescript-eslint/explicit-module-boundary-types': 'off',
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-require-imports': 'off',
            '@typescript-eslint/no-unused-vars': [
                'error',
                {
                    argsIgnorePattern: '^_',
                    caughtErrorsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                },
            ],
        },
    },
    {
        files: ['src/tests/**/*.ts'],
        languageOptions: {
            globals: {
                ...globals.node,
                ...globals.vitest,
            },
        },
    },
    {
        files: ['prisma/seed.ts'],
        rules: {
            'no-console': 'off',
        },
    },
];
