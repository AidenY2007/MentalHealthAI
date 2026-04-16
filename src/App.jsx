import { useEffect, useState } from 'react'
import Home from './pages/Home'
import Practice from './pages/Practice'
import './App.css'
import { siteConfig } from './config/site'

function App() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname)

  useEffect(() => {
    document.title = siteConfig.name

    const descriptionTag = document.querySelector('meta[name="description"]')
    if (descriptionTag) {
      descriptionTag.setAttribute('content', siteConfig.description)
    }
  }, [])

  useEffect(() => {
    function handlePopState() {
      setCurrentPath(window.location.pathname)
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  if (currentPath.startsWith('/practice/')) {
    const scenarioId = currentPath.split('/')[2]
    return <Practice scenarioId={scenarioId} />
  }

  return <Home />
}

export default App
