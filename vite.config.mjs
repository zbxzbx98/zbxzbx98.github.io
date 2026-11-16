import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
  ],
  build: {
    // 本分支把全部界面打进同一个 chunk（github.io 多页面站点），
    // 体积集中在外置 js 属正常，关闭 500kB 提示
    chunkSizeWarningLimit: 2000000,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server:{
    port: 7000, // 设置服务启动端口号
  }
})
