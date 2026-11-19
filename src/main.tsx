import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@mantine/core/styles.css'
import { App } from './app/App'
import { initializeAppearance } from './features/appearance-settings/model/useAppearanceSettings'
import './app/styles/global.scss'

initializeAppearance()

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Root element "#root" was not found.')
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
