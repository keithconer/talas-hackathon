import { useEffect, useState } from 'react'
import { RouterProvider } from 'react-router-dom'
import { router } from './router'
import './App.css'

function App() {
  const [showSplash, setShowSplash] = useState(true)

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const timer = window.setTimeout(
      () => setShowSplash(false),
      reducedMotion ? 1000 : 2500,
    )

    return () => window.clearTimeout(timer)
  }, [])

  return (
    <>
      <RouterProvider router={router} />
      {showSplash && (
        <div className="talas-splash" role="status" aria-label="TALAS is loading">
          <img src="/imgs/talas-blinking.gif" alt="TALAS" />
        </div>
      )}
    </>
  )
}

export default App
