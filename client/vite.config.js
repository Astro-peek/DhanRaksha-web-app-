import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import compression from 'vite-plugin-compression'
import { visualizer } from 'rollup-plugin-visualizer'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/.*\.supabase\.co\/.*/,
              handler: 'NetworkFirst',
              options: { cacheName: 'supabase-cache', networkTimeoutSeconds: 3 }
            },
            {
              urlPattern: /^http:\/\/localhost:3000\/api\/lending\/lenders/,
              handler: 'StaleWhileRevalidate',
              options: { cacheName: 'lenders-cache', expiration: { maxAgeSeconds: 3600 } }
            }
          ]
        },
        manifest: {
          name: 'SafeKosh',
          short_name: 'SafeKosh',
          theme_color: '#028090',
          background_color: '#F0F4F8',
          display: 'standalone',
          icons: [
            { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
          ]
        }
      }),
      compression({
        algorithm: 'gzip',
        ext: '.gz',
        threshold: 1024, // only compress assets larger than 1kb
        deleteOriginFile: false
      }),
      mode === 'analyze' && visualizer({
        open: true,
        filename: 'dist/stats.html',
        gzipSize: true,
        brotliSize: true
      })
    ].filter(Boolean),
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('@supabase') || id.includes('supabase')) {
                return 'vendor-supabase';
              }
              if (id.includes('recharts') || id.includes('d3') || id.includes('chart.js')) {
                return 'vendor-charts';
              }
              if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
                return 'vendor-react-core';
              }
              return 'vendor-others';
            }
          }
        }
      }
    },
    test: {
      globals: true,
      environment: 'jsdom',
      pool: 'threads',
      threads: {
        singleThread: true,
        execArgv: ['--max-old-space-size=4096']
      }
    }
  }
})
