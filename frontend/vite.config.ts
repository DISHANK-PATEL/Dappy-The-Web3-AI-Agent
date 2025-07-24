import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
   // frontend/vite.config.ts
   export default defineConfig({
    plugins: [react()],
    server: {
      proxy: {
        '/api': 'http://localhost:3001'
      }
    }
  })