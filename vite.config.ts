import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  // Publicado no GitHub Pages em /fonolandia/
  base: process.env.GITHUB_PAGES ? '/fonolandia/' : '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Tudo guardado no aparelho: o jogo funciona sem internet depois do primeiro acesso
      workbox: { globPatterns: ['**/*.{js,css,html,svg,woff2}'] },
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Fonolândia',
        short_name: 'Fonolândia',
        description: 'Jogo de fonemas para crianças em alfabetização',
        lang: 'pt-BR',
        theme_color: '#38bdf8',
        background_color: '#e0f2fe',
        display: 'standalone',
        orientation: 'any',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
    }),
  ],
})
