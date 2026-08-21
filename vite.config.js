import vue from '@vitejs/plugin-vue'
import path from 'path'
import UnoCSS from 'unocss/vite'
import { defineConfig } from 'vite'
import cesium from 'vite-plugin-cesium'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    cesium(),
    UnoCSS()
  ],
  resolve: {
    alias: {
      'vue': path.resolve(__dirname, './node_modules/vue'),
      '@vue/shared': path.resolve(__dirname, './node_modules/@vue/shared'),
    }
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8090',
        changeOrigin: true,
        rewrite: requestPath => requestPath.replace(/^\/api/, '')
      }
    }
  }
})
