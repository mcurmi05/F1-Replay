import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ command }) => ({
  plugins: [react(), tailwindcss()],
  define: {
    __DEBUG_TOOLS__: JSON.stringify(command === 'serve'),
  },
  server: {
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
}))
