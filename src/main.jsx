import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.jsx'
import { VARIANT } from './config/variant'

// Sem cabecalhos HTTP no GitHub Pages nao da para usar frame-ancestors;
// impede que outro site carregue o app dentro de um iframe (clickjacking).
if (window.top !== window.self) {
  window.top.location.replace(window.self.location.href)
} else {
  document.documentElement.setAttribute('data-variant', VARIANT)
  registerSW({ immediate: true })
  // Pede ao navegador para nao apagar os dados locais quando faltar espaco.
  navigator.storage?.persist?.().catch(() => {})

  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
