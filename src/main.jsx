import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { CONFIG } from './appConfig.js'
import './index.css'

// Match the tab, the OS chrome and the install prompt to this build's identity.
document.title = CONFIG.manifest.name
document.documentElement.style.background = CONFIG.background
const themeMeta = document.querySelector('meta[name="theme-color"]')
if (themeMeta) themeMeta.setAttribute('content', CONFIG.theme)
const descMeta = document.querySelector('meta[name="description"]')
if (descMeta) descMeta.setAttribute('content', CONFIG.manifest.description)
// point at this build's own manifest (vite-plugin-pwa emits manifest-<app>.webmanifest)
const manifestLink = document.querySelector('link[rel="manifest"]')
if (manifestLink) manifestLink.setAttribute('href', `/manifest-${CONFIG.id}.webmanifest`)

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)
