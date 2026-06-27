import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import '@fontsource-variable/bricolage-grotesque'
import '@fontsource-variable/hanken-grotesk'
import App from './App'
import CustomerDisplay from './pages/CustomerDisplay'
import { SettingsProvider } from './lib/settings'
import { I18nProvider } from './lib/i18n'
import { LicenseProvider } from './lib/license'
import { AuthProvider } from './lib/auth'
import { DialogProvider } from './components/Dialog'
import './index.css'

const root = ReactDOM.createRoot(document.getElementById('root'))

// The customer window loads the same bundle but with a subscribe-only preload; it
// renders the standalone customer display, not the cashier app (no providers/auth).
if (window.posCustomer) {
  root.render(
    <React.StrictMode>
      <CustomerDisplay />
    </React.StrictMode>
  )
} else {
  root.render(
    <React.StrictMode>
      <SettingsProvider>
        <I18nProvider>
          <LicenseProvider>
            <AuthProvider>
              <DialogProvider>
                <HashRouter>
                  <App />
                </HashRouter>
              </DialogProvider>
            </AuthProvider>
          </LicenseProvider>
        </I18nProvider>
      </SettingsProvider>
    </React.StrictMode>
  )
}
