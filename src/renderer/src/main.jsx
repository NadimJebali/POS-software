import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import '@fontsource-variable/bricolage-grotesque'
import '@fontsource-variable/hanken-grotesk'
import App from './App'
import { SettingsProvider } from './lib/settings'
import { LicenseProvider } from './lib/license'
import { AuthProvider } from './lib/auth'
import { DialogProvider } from './components/Dialog'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <SettingsProvider>
      <LicenseProvider>
        <AuthProvider>
          <DialogProvider>
            <HashRouter>
              <App />
            </HashRouter>
          </DialogProvider>
        </AuthProvider>
      </LicenseProvider>
    </SettingsProvider>
  </React.StrictMode>
)
