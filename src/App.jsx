import { useEffect, useRef, useState } from 'react'
import Home from './pages/Home'
import Practice from './pages/Practice'
import Admin from './pages/Admin'
import './App.css'
import { siteConfig } from './config/site'

function App() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname)
  const hasTrackedInitialPageView = useRef(false)

  useEffect(() => {
    document.title = siteConfig.name

    const descriptionTag = document.querySelector('meta[name="description"]')
    if (descriptionTag) {
      descriptionTag.setAttribute('content', siteConfig.description)
    }
  }, [currentPath])

  useEffect(() => {
    if (!hasTrackedInitialPageView.current) {
      hasTrackedInitialPageView.current = true
      return
    }

    if (typeof window.gtag !== 'function') {
      return
    }

    window.gtag('event', 'page_view', {
      page_path: currentPath,
      page_location: window.location.href,
      page_title: document.title,
    })
  }, [currentPath])

  useEffect(() => {
    function handlePopState() {
      setCurrentPath(window.location.pathname)
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  if (currentPath === '/admin') {
    return <Admin />
  }

  if (currentPath.startsWith('/practice/')) {
    const scenarioId = currentPath.split('/')[2]
    return <Practice scenarioId={scenarioId} />
  }

  return <Home />
}

export default App
