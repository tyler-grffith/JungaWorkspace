import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { designerServer } from './src/design/server.ts'

export default defineConfig({
  plugins: [react(), designerServer()],
  test: { include: ['src/**/*.test.ts'] },
})
