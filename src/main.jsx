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
// this build's own favicon + iOS home-screen icon
const favicon = document.querySelector('link[rel="icon"]')
if (favicon) { favicon.setAttribute('type', 'image/png'); favicon.setAttribute('href', `/icons/favicon-${CONFIG.id}.png`) }
let apple = document.querySelector('link[rel="apple-touch-icon"]')
if (!apple) { apple = document.createElement('link'); apple.setAttribute('rel', 'apple-touch-icon'); document.head.appendChild(apple) }
apple.setAttribute('href', `/apple-touch-icon-${CONFIG.id}.png`)

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)
