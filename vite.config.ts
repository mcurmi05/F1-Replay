import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ command }) => ({
  plugins: [react(), tailwindcss()],
  define: {
    __DEBUG_TOOLS__: JSON.stringify(command === 'serve'),
    // Hosted (public webapp) build hides the operator-only F1TV auth controls.
    // Set via `HOSTED=true npm run build`; the desktop build leaves it false.
    __HOSTED__: JSON.stringify(process.env.HOSTED === 'true'),
    'process.env.DRAGGABLE_DEBUG': 'false',
  },
  server: {
    host: true,
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
}))
