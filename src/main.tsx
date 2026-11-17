import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/nunito/wght.css'
import './styles/tokens.css'
import './styles/base.css'
import './styles/animations.css'
import './styles/components.css'
import './styles/screens.css'
import './styles/teacher.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
