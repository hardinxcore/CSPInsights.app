import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import type { Plugin } from 'vite'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'

const priceListsDirectory = resolve('price-lists')
const priceListPattern = /^(?:AX|NL)-(January|February|March|April|May|June|July|August|September|October|November|December)-(\d{4})-Newcommerce-Cloud-Reseller-Pricelist\.zip$/i

const getPriceListManifest = () => {
  if (!statExists(priceListsDirectory)) return { items: [] }

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  const items = readdirSync(priceListsDirectory)
    .filter(fileName => priceListPattern.test(fileName))
    .map(fileName => {
      const match = priceListPattern.exec(fileName)
      if (!match) return null
      const month = monthNames.findIndex(name => name.toLowerCase() === match[1].toLowerCase()) + 1
      const year = Number(match[2])
      return {
        id: `${year}-${String(month).padStart(2, '0')}`,
        fileName,
        month,
        year,
        label: `${monthNames[month - 1]} ${year}`,
        url: `/price-lists/${encodeURIComponent(fileName)}`,
      }
    })
    .filter((item): item is {
      id: string; fileName: string; month: number; year: number; label: string; url: string
    } => item !== null)
    .sort((a, b) => b.year - a.year || b.month - a.month)

  return { items }
}

const statExists = (path: string) => {
  try {
    statSync(path)
    return true
  } catch {
    return false
  }
}

const priceListPlugin = (): Plugin => ({
  name: 'price-list-archives',
  configureServer(server: { middlewares: { use: (handler: (request: { url?: string }, response: { statusCode: number; setHeader: (name: string, value: string) => void; end: (body: string | Buffer) => void }, next: () => void) => void) => void } }) {
    server.middlewares.use((request, response, next) => {
      if (!request.url?.startsWith('/price-lists/')) return next()
      const relativePath = decodeURIComponent(request.url.slice('/price-lists/'.length).split('?')[0])
      if (relativePath === 'manifest.json') {
        response.statusCode = 200
        response.setHeader('Content-Type', 'application/json')
        response.end(JSON.stringify(getPriceListManifest()))
        return
      }
      const filePath = join(priceListsDirectory, basename(relativePath))
      if (!filePath.startsWith(priceListsDirectory) || !statExists(filePath)) return next()
      response.statusCode = 200
      response.setHeader('Content-Type', 'application/zip')
      response.end(readFileSync(filePath))
    })
  },
  generateBundle() {
    for (const item of getPriceListManifest().items) {
      this.emitFile({ type: 'asset', fileName: `price-lists/${item.fileName}`, source: readFileSync(join(priceListsDirectory, item.fileName)) })
    }
    this.emitFile({ type: 'asset', fileName: 'price-lists/manifest.json', source: JSON.stringify(getPriceListManifest(), null, 2) })
  },
})

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    priceListPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'apple-touch-icon.png', 'microsoft-logo.svg'],
      manifest: {
        name: 'CSP Insights — Billing & Pricing Toolkit',
        short_name: 'CSP Insights',
        description: 'Local-first billing reconciliation, pricing management, and incentives analytics for Microsoft CSP Direct partners.',
        theme_color: '#6366f1',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        lang: 'en',
        icons: [
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: '/maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // The invoice/PDF chunk exceeds workbox's 2 MB default; the whole app
        // must precache for the local-first offline story to work
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/index.html',
      },
    }),
  ],
})
