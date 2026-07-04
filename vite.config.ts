import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base: './' 讓打包後的資源用相對路徑，GitHub Pages 放在任何子路徑都能運作
export default defineConfig({
  plugins: [react()],
  base: './',
})
