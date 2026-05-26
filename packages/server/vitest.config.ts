import { resolve } from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Server tests stub process-global fetch and run real ports; keep file-level
    // execution serial so mocks and runtime servers cannot bleed across files.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      '@openspecui/core': resolve(__dirname, '../core/src'),
      '@openspecui/search': resolve(__dirname, '../search/src'),
      '@openspecui/search/node': resolve(__dirname, '../search/src/node.ts'),
    },
  },
})
