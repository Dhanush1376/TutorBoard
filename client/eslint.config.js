import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: {
        ...globals.browser,
        ...globals.node,
        API: 'readonly',
        applyDelta: 'readonly',
        logout: 'readonly',
      },
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['warn', { varsIgnorePattern: '^[A-Z_]' }],
      'react-hooks/exhaustive-deps': 'warn',
      'react-hooks/rules-of-hooks': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/purity': 'warn',
      'no-empty': 'warn',
      'react-refresh/only-export-components': 'warn',
      'no-useless-escape': 'warn',
      'prefer-const': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-unused-expressions': 'warn',
    },
  },
  // --- Architectural Boundary Enforcement ---
  {
    files: [
      'src/store/slices/artifactSlice.js',
      'src/store/slices/platformMemorySlice.js',
      'src/store/slices/sessionSlice.js',
      'src/engine/systemBoundaries.js'
    ],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          {
            group: ['**/components/canvas/**', '**/renderers/**'],
            message: 'Architectural Violation: Pure logic/persistence modules must not import from the rendering layer (Canvas/Renderers).'
          }
        ]
      }]
    }
  },
  {
    files: ['src/engine/SceneOrchestrator.ts', 'src/engine/SceneGraph.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          {
            group: ['**/services/api/**', '**/services/persistence/**'],
            message: 'Architectural Violation: Rendering engines must be ephemeral and should not import persistence or API services directly.'
          }
        ]
      }]
    }
  }
])
