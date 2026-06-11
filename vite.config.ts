import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ command }) => ({
  plugins: [react(), tailwindcss()],
  define: {
    __DEBUG_TOOLS__: JSON.stringify(command === 'serve'),
    'process.env.DRAGGABLE_DEBUG': 'false',
  },
  server: {
    host: true,
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
}))
