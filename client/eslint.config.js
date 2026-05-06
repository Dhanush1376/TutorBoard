import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
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
