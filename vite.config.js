import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd())
  // General auth used for backend runpod proxy (existing)
  const AUTH = env.VITE_API_AUTHORIZATION || process.env.VITE_API_AUTHORIZATION || ''
  // Dedicated D-ID key (preferred). Fallback to AUTH if not present.
  const DID_KEY = env.VITE_DID_API_KEY 

  return {
    plugins: [react()],
    server: {
      port: 3000,
      proxy: {
        '/api': {
          target: 'https://kwqhnx76ykjrf6.api.runpod.ai',
          changeOrigin: true
        },
        '/ask': {
          target: 'https://kwqhnx76ykjrf6.api.runpod.ai',
          changeOrigin: true
        },
        '/upload': {
          target: 'https://kwqhnx76ykjrf6.api.runpod.ai',
          changeOrigin: true
        },
        '/static': {
          target: 'https://kwqhnx76ykjrf6.api.runpod.ai',
          changeOrigin: true,
          headers: {
            ...(AUTH ? { Authorization: `Bearer ${AUTH}` } : {})
          }
        },
        // Proxy D-ID generated S3 assets in development to avoid CORS issues
        '/s3-did': {
          target: 'https://d-id-talks-prod.s3.us-west-2.amazonaws.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/s3-did/, '')
        },
        // Proxy D-ID API to avoid CORS in development and inject Authorization header from env
        '/d-id': {
          target: 'https://api.d-id.com',
          changeOrigin: true,
          headers: {
            ...(DID_KEY ? { Authorization: `Basic ${DID_KEY}` } : {})
          },
          rewrite: (path) => path.replace(/^\/d-id/, '')
        }
      },
      allowedHosts: [
        'localhost',
        '.trycloudflare.com'
      ]
    }
  }
})
