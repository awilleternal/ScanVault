import js from '@eslint/js';
import security from 'eslint-plugin-security';

export default [
  {
    ignores: [
      'dist/**',
      'frontend/dist/**',
      'backend/dist/**',
      'node_modules/**',
      '*.config.js'
    ]
  },
  js.configs.recommended,
  security.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        global: 'readonly',
        require: 'readonly',
        module: 'readonly',
        exports: 'readonly'
      }
    },
    plugins: {
      security
    },
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'security/detect-eval-with-expression': 'error',
      'security/detect-non-literal-fs-filename': 'warn',
      'security/detect-object-injection': 'warn',
      'security/detect-possible-timing-attacks': 'warn',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'prefer-const': 'error',
      'no-var': 'error',
      'arrow-body-style': ['error', 'as-needed'],
      'object-shorthand': 'error'
    },
    ignores: [
      'dist/**',
      'node_modules/**',
      '*.config.js',
      'frontend/dist/**',
      'backend/dist/**'
    ]
  }
];
