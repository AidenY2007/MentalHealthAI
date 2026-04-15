import { useEffect } from 'react'
import Home from './pages/Home'
import './App.css'
import { siteConfig } from './config/site'

function App() {
  useEffect(() => {
    document.title = siteConfig.name

    const descriptionTag = document.querySelector('meta[name="description"]')

    if (descriptionTag) {
      descriptionTag.setAttribute('content', siteConfig.description)
    }
  }, [])

  return <Home />
}

export default App
