import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// On GitHub Pages a project site is served from /<repo>/, so the asset base has
// to match. The Actions workflow sets BASE_PATH; local dev and preview use '/'.
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [react(), tailwindcss()],
  build: {
    // Font files get inlined into the JS bundle if they fall under the default
    // 4kb threshold, which breaks the export path's ability to fetch them as
    // standalone URLs. Force every asset to stay a real file.
    assetsInlineLimit: 0,
  },
})
