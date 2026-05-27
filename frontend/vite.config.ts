import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  base: './',
  // 强制启用 SPA HTML fallback，确保访问 `/` 能返回入口 `index.html`
  appType: 'spa',
  server: {
    // 与 启动说明.md / .env.local 一致；绑定 127.0.0.1 避免仅监听 [::1] 导致 127.0.0.1:5174 打不开
    host: '127.0.0.1',
    port: 5174,
    strictPort: false,
  },
})

