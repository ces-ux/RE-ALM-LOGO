import { useState, useEffect } from 'react'

// Full CSS font stack — Canvas falls through to Helvetica then Arial if needed.
const FONT_FAMILY = '"Helvetica Neue", Helvetica, Arial, sans-serif'

// Probe string used with document.fonts.load() to trigger and verify loading.
const LOAD_PROBE = '72px "Helvetica Neue"'

export function useFont() {
  const [fontReady, setFontReady] = useState(false)

  useEffect(() => {
    let cancelled = false

    document.fonts
      .load(LOAD_PROBE)
      .then((loaded) => {
        if (cancelled) return
        if (loaded.length === 0) {
          // Font is not installed on this system — Canvas will silently use Arial.
          // To fix: install Helvetica Neue, or add a @font-face / FontFace entry
          // pointing at a bundled .ttf/.otf file in public/fonts/.
          console.warn(
            '[useFont] "Helvetica Neue" not found — Canvas will fall back to Arial. ' +
              'To use true Helvetica Neue outlines, place a font file at ' +
              'public/fonts/HelveticaNeue.ttf and load it via FontFace.'
          )
        }
        setFontReady(true)
      })
      .catch(() => {
        if (!cancelled) setFontReady(true) // proceed with whatever fallback is available
      })

    return () => {
      cancelled = true
    }
  }, [])

  return { fontFamily: FONT_FAMILY, fontReady }
}
