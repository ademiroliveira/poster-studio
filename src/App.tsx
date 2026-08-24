import { useEffect, useRef, useState } from 'react'
import { waitForFonts } from './export/fonts'
import { Poster } from './poster/render/Poster'
import { clearMeasureCache } from './poster/text'
import { usePosterStore } from './state/store'
import { Sidebar } from './ui/Sidebar'

export default function App() {
  const store = usePosterStore()
  const svgRef = useRef<SVGSVGElement>(null)

  /**
   * Layout is driven by text measurement, and measuring against a fallback font
   * gives the wrong answer. The first paint happens with whatever is available;
   * once the real families load, the cache is dropped and the poster is
   * measured again. `fontEpoch` exists purely to force that second pass.
   */
  const [fontEpoch, setFontEpoch] = useState(0)

  useEffect(() => {
    let cancelled = false
    void waitForFonts().then(() => {
      if (cancelled) return
      clearMeasureCache()
      setFontEpoch((n) => n + 1)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="flex h-full w-full">
      <main
        className="relative flex flex-1 items-center justify-center overflow-hidden p-10"
        style={{ backgroundImage: 'radial-gradient(circle at center, #1a1a1a 0%, #050505 100%)' }}
      >
        <div className="flex h-full w-full items-center justify-center drop-shadow-[0_40px_100px_rgba(0,0,0,0.9)]">
          <Poster
            key={fontEpoch}
            ref={svgRef}
            state={store.state}
            className="h-auto max-h-full w-auto max-w-full"
          />
        </div>
      </main>

      <Sidebar store={store} svgRef={svgRef} />
    </div>
  )
}
