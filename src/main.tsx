import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import DesignProvider from './design/DesignProvider'
import '@fontsource-variable/dm-sans'
import '@fontsource-variable/manrope'
import './styles.css'
import './design/designer.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DesignProvider>
      <App />
    </DesignProvider>
  </StrictMode>,
)
