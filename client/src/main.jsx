import React from 'react'
import ReactDOM from 'react-dom/client'
import * as Sentry from '@sentry/react'
import { registerSW } from 'virtual:pwa-register'
import App from './App.jsx'
import './index.css'
import { isChunkLoadError, recoverFromChunkError } from './lib/chunkRecovery'

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0
})

registerSW({
  immediate: true,
  onRegisterError(error) {
    console.error('Service worker registration failed:', error)
  },
})

window.addEventListener('unhandledrejection', async (event) => {
  if (!isChunkLoadError(event.reason)) return
  event.preventDefault()
  await recoverFromChunkError()
})

window.addEventListener('error', async (event) => {
  if (!isChunkLoadError(event.error || event.message)) return
  event.preventDefault()
  await recoverFromChunkError()
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
