import { resolve } from 'path'
import { readFileSync, existsSync } from 'fs'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

// The production license public key, baked into the main bundle at build time so
// releases verify real (production-signed) licenses without editing source. Resolved
// from, in order: the LICENSE_PUBLIC_KEY env var (the GitHub variable / CI secret;
// literal or \n-escaped PEM), then a license-public.pem in the project root. When
// neither is set (local dev / tests) this returns '' and license.js keeps its dev key.
function resolveLicensePublicKey() {
  const fromEnv = process.env.LICENSE_PUBLIC_KEY
  if (fromEnv && fromEnv.includes('BEGIN PUBLIC KEY')) return fromEnv.replace(/\\n/g, '\n')
  const pem = resolve(__dirname, 'license-public.pem')
  if (existsSync(pem)) return readFileSync(pem, 'utf8')
  return ''
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    define: {
      __LICENSE_PUBLIC_KEY__: JSON.stringify(resolveLicensePublicKey())
    },
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/main/index.js') }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/preload/index.js'),
          customer: resolve(__dirname, 'src/preload/customer.js')
        }
      }
    }
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/renderer/index.html') }
      }
    },
    plugins: [react()]
  }
})
