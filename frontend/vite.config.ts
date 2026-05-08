import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  // 强制启用 SPA HTML fallback，确保访问 `/` 能返回入口 `index.html`
  appType: 'spa',
  server: {
    port: 5173,
  },
})

