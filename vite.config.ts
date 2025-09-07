import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: { host: true },
  build: {
    target: 'es2020'
  },
  worker: {
    // why: some CI/CD hosts choke on classic format; ES is broadly compatible
    format: 'es'
  }
})
