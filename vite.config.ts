import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { designerServer } from './src/design/server.ts'

export default defineConfig({
  // Keep the same build portable between the site root and any hosting subfolder.
  base: './',
  plugins: [react(), designerServer()],
  test: { include: ['src/**/*.test.{ts,js}'] },
})
