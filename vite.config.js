import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const VARIANTS = {
  default: {
    name: 'TaskFlow - Organizador Kanban',
    shortName: 'TaskFlow',
    themeColor: '#0b0f1a',
    background: '#0b0f1a',
    icons: 'icons',
  },
  rosa: {
    name: 'TaskFlow Rosa - Organizador Kanban',
    shortName: 'TaskFlow Rosa',
    themeColor: '#fdf2f8',
    background: '#fdf2f8',
    icons: 'icons-rosa',
  },
}

// GitHub Pages nao permite cabecalhos HTTP proprios, entao a politica de
// seguranca vai como <meta>. Lista minima de origens: o proprio site, Google
// (login, Agenda, Drive, fontes) e Firebase.
function contentSecurityPolicy(useEmulator) {
  const local = useEmulator ? ' http://127.0.0.1:9099 http://127.0.0.1:8080 ws://127.0.0.1:8080' : ''
  return [
    "default-src 'self'",
    "script-src 'self' https://apis.google.com https://accounts.google.com https://www.gstatic.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https://*.googleusercontent.com https://www.gstatic.com",
    `connect-src 'self' https://*.googleapis.com https://accounts.google.com https://apis.google.com${local}`,
    "frame-src https://accounts.google.com https://content.googleapis.com https://apis.google.com https://*.firebaseapp.com" + (useEmulator ? ' http://127.0.0.1:9099' : ''),
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')
}

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const variant = VARIANTS[env.VITE_VARIANT === 'rosa' ? 'rosa' : 'default']
  const useEmulator = env.VITE_FIREBASE_EMULATOR === 'true'

  const htmlPlugin = {
    name: 'taskflow-variant-html',
    transformIndexHtml(html) {
      let out = html
        .replaceAll('%APP_NAME%', variant.shortName)
        .replaceAll('%APP_TITLE%', variant.name)
        .replaceAll('%THEME_COLOR%', variant.themeColor)
        .replaceAll('%ICONS%', variant.icons)
      // Em dev o Vite injeta scripts inline (HMR), incompativeis com a CSP.
      const csp = command === 'build' ? `<meta http-equiv="Content-Security-Policy" content="${contentSecurityPolicy(useEmulator)}" />` : ''
      return out.replace('<!--SECURITY_META-->', csp)
    },
  }

  return {
    base: './',
    plugins: [
      react(),
      htmlPlugin,
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: [`${variant.icons}/favicon-64.png`, `${variant.icons}/apple-touch-icon.png`],
        manifest: {
          name: variant.name,
          short_name: variant.shortName,
          description: 'Organizador de tarefas estilo Kanban com calendario, lembretes e Google Agenda',
          lang: 'pt-BR',
          theme_color: variant.themeColor,
          background_color: variant.background,
          display: 'standalone',
          orientation: 'any',
          start_url: './',
          scope: './',
          icons: [
            { src: `${variant.icons}/icon-192.png`, sizes: '192x192', type: 'image/png' },
            { src: `${variant.icons}/icon-512.png`, sizes: '512x512', type: 'image/png' },
            { src: `${variant.icons}/icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
          globIgnores: [variant.icons === 'icons' ? 'icons-rosa/**' : 'icons/**'],
          navigateFallbackDenylist: [/^\/__\//],
        },
      }),
    ],
    server: {
      host: true,
      port: 5173,
    },
    test: {
      include: ['src/**/*.test.js'],
    },
  }
})
