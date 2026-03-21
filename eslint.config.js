import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import unicornPlugin from 'eslint-plugin-unicorn';
import prettierConfig from 'eslint-config-prettier';
import globals from 'globals';
import localRules from 'eslint-plugin-local-rules';

// Common rules shared between source and test files
const commonRules = {
    // ===== Import/Export Rules =====
    'no-restricted-imports': [
        'error',
        {
            patterns: ['../*'],
        },
    ],
    'simple-import-sort/exports': 'error',
    'simple-import-sort/imports': 'error',

    // ===== Code Quality Rules =====
    'array-callback-return': ['error', { allowImplicit: false, checkForEach: false }],
    curly: ['error', 'all'],
    eqeqeq: ['error', 'always'],
    'no-else-return': 'error',
    'no-var': 'error',
    'prefer-const': 'error',
    'prefer-template': 'error',

    // ===== Function Style Rules =====
    'func-style': ['error', 'expression'],
    'no-restricted-syntax': [
        'error',
        {
            selector: 'ForStatement',
            message: 'for loops are not allowed. Use array methods like .forEach(), .map(), .filter(), etc.',
        },
        {
            selector: 'ForInStatement',
            message: 'for...in loops are not allowed. Use Object.keys(), Object.entries(), or Object.values().',
        },
        {
            selector: 'ForOfStatement',
            message: 'for...of loops are not allowed. Use array methods like .forEach(), .map(), .filter(), etc.',
        },
    ],
    'prefer-arrow-callback': ['error'],

    // ===== Unicorn Rules =====
    // Array/iteration improvements
    'unicorn/prefer-array-find': 'error',
    'unicorn/prefer-array-flat-map': 'error',
    'unicorn/prefer-array-index-of': 'error',
    'unicorn/prefer-array-some': 'error',

    // Modern JavaScript features
    'unicorn/prefer-at': 'error',
    'unicorn/prefer-object-from-entries': 'error',
    'unicorn/prefer-spread': 'error',
    'unicorn/prefer-string-replace-all': 'error',
    'unicorn/prefer-string-starts-ends-with': 'error',
    'unicorn/prefer-string-trim-start-end': 'error',

    // Error handling
    'unicorn/error-message': 'error',
    'unicorn/throw-new-error': 'error',

    // Code quality
    'unicorn/better-regex': 'error',
    'unicorn/no-instanceof-array': 'error',
    'unicorn/prefer-number-properties': 'error',
    'unicorn/prefer-ternary': 'error',

    // ===== TypeScript Rules =====
    '@typescript-eslint/explicit-function-return-type': [
        'error',
        {
            allowExpressions: true,
            allowTypedFunctionExpressions: true,
            allowHigherOrderFunctions: true,
        },
    ],
    '@typescript-eslint/naming-convention': [
        'error',
        {
            selector: 'default',
            format: ['camelCase'],
            leadingUnderscore: 'allow',
            trailingUnderscore: 'allow',
        },
        {
            selector: 'import',
            format: ['camelCase', 'PascalCase'], // Allow PascalCase for imports like React
        },
        {
            selector: 'variable',
            format: ['camelCase', 'UPPER_CASE', 'PascalCase'],
            leadingUnderscore: 'allow',
            trailingUnderscore: 'allow',
        },
        {
            selector: 'property',
            format: ['camelCase', 'snake_case', 'PascalCase', 'UPPER_CASE'],
            leadingUnderscore: 'allow',
            trailingUnderscore: 'allow',
        },
        {
            selector: 'typeLike',
            format: ['PascalCase'],
        },
        {
            selector: 'enumMember',
            format: ['PascalCase', 'UPPER_CASE'],
        },
    ],
    '@typescript-eslint/no-explicit-any': 'error',
};

export default [
    js.configs.recommended,

    // ===== Source Files Configuration =====
    {
        files: [
            'app/src/**/*.ts',
            'app/src/**/*.tsx',
            '.claude/**/*.ts',
            'app/lib/**/*.ts',
            'dev/**/*.ts',
            'dev/**/*.tsx',
        ],
        ignores: ['**/*.test.ts', '**/*.test.tsx'],
        languageOptions: {
            parser: tsparser,
            parserOptions: {
                ecmaVersion: 'latest',
                sourceType: 'module',
                ecmaFeatures: {
                    jsx: true,
                },
                project: './tsconfig.json',
            },
            globals: {
                ...globals.node,
            },
        },
        plugins: {
            '@typescript-eslint': tseslint,
            react: reactPlugin,
            'react-hooks': reactHooksPlugin,
            'simple-import-sort': simpleImportSort,
            unicorn: unicornPlugin,
        },
        rules: {
            // Base configs
            ...tseslint.configs.recommended.rules,
            ...tseslint.configs['recommended-requiring-type-checking'].rules,
            ...reactPlugin.configs.recommended.rules,
            ...reactHooksPlugin.configs.recommended.rules,

            // Common rules
            ...commonRules,

            // Source-specific TypeScript rules (requires type info)

            // React rules
            'react/jsx-no-bind': 'error',
            'react/self-closing-comp': 'error',
        },
        settings: {
            react: {
                version: '18.3',
            },
        },
    },

    // ===== Test Files Configuration =====
    {
        files: [
            'app/test-utils/**/*.ts',
            'app/test-utils/**/*.tsx',
            '**/*.test.ts',
            '**/*.test.tsx',
            'app/tests/**/*.ts',
            'app/tests/**/*.tsx',
        ],
        languageOptions: {
            parser: tsparser,
            parserOptions: {
                ecmaVersion: 'latest',
                sourceType: 'module',
                ecmaFeatures: {
                    jsx: true,
                },
            },
            globals: {
                ...globals.node,
                Bun: 'readonly',
                Response: 'readonly',
            },
        },
        plugins: {
            '@typescript-eslint': tseslint,
            'simple-import-sort': simpleImportSort,
            unicorn: unicornPlugin,
            'local-rules': localRules,
        },
        rules: {
            // Base config
            ...tseslint.configs.recommended.rules,

            // Common rules
            ...commonRules,

            // Test-specific overrides
            '@typescript-eslint/no-unused-vars': [
                'error',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                },
            ],
            // Relax rules for test files
            '@typescript-eslint/explicit-function-return-type': 'off',
            '@typescript-eslint/no-explicit-any': 'off',
            // Allow relative imports in tests (need to import from src/ at different depths)
            'no-restricted-imports': 'off',
            // Allow control characters in regex for ANSI code stripping in tests
            'no-control-regex': 'off',

            // Custom local rules
            'local-rules/test-single-describe': 'error',
            'local-rules/test-describe-matches-filename': 'error',
        },
    },

    // ===== CLI Entry Point Override =====
    // app/src/cli.ts and app/src/commands/upgrade.ts legitimately import from outside app/src/ (package.json)
    {
        files: ['app/src/cli.ts', 'app/src/commands/upgrade.ts'],
        rules: {
            'no-restricted-imports': 'off',
        },
    },

    // ===== Prettier Config =====
    prettierConfig,

    // ===== Ignored Patterns =====
    {
        ignores: ['node_modules', '.planderson', 'logs', 'dist', 'build', '.worktrees'],
    },
];
