import { useMemo } from 'react'

// Fast, deterministic PRNG (xorshift32) seeded from an integer.
function makeRng(seed) {
  let s = (seed | 0) || 1
  return () => {
    s ^= s << 13
    s ^= s >> 17
    s ^= s << 5
    return (s >>> 0) / 0xffffffff
  }
}

// Sample interior points of the rendered text using an offscreen canvas pixel test.
// Only points whose pixel location is solidly inside a glyph are returned.
// This produces an interior-only topology: no outline traces, letters implied by density.
export function useTypography({ text, fontFamily, fontReady, width, height, spacing }) {
  return useMemo(() => {
    if (!fontReady || !text.trim() || width === 0 || height === 0) return []

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return []

    const padding = 72

    // Measure text at a reference size, then scale to fit the padded viewport.
    const refSize = height * 0.8
    ctx.font = `${refSize}px ${fontFamily}`
    const m = ctx.measureText(text)
    const renderedW = m.width
    const renderedH =
      (m.actualBoundingBoxAscent ?? refSize * 0.72) +
      (m.actualBoundingBoxDescent ?? refSize * 0.1)

    const scaleW = (width - padding * 2) / renderedW
    const scaleH = (height - padding * 2) / renderedH
    const fontSize = refSize * Math.min(scaleW, scaleH)

    // Render white text on black — the pixel test reads red-channel brightness.
    ctx.clearRect(0, 0, width, height)
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, width, height)
    ctx.fillStyle = '#fff'
    ctx.font = `${fontSize}px ${fontFamily}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, width / 2, height / 2)

    const { data } = ctx.getImageData(0, 0, width, height)

    const isInside = (x, y) => {
      const px = Math.round(x)
      const py = Math.round(y)
      if (px < 0 || px >= width || py < 0 || py >= height) return false
      // Threshold 160: comfortably inside, well away from the anti-aliased fringe.
      return data[(py * width + px) * 4] > 160
    }

    // Returns true if the point sits near a glyph boundary (curved/edge region).
    // Samples 4 cardinal neighbours at ~spacing*0.55 — if any neighbour is outside
    // the glyph, this point is adjacent to a boundary and should always be kept.
    const nearBoundary = (x, y) => {
      const r = Math.round(spacing * 0.55)
      const px = Math.round(x)
      const py = Math.round(y)
      const nx0 = px + r, nx1 = px - r, ny0 = py + r, ny1 = py - r
      if (nx0 < width  && data[(py  * width + nx0) * 4] < 80) return true
      if (nx1 >= 0     && data[(py  * width + nx1) * 4] < 80) return true
      if (ny0 < height && data[(ny0 * width + px)  * 4] < 80) return true
      if (ny1 >= 0     && data[(ny1 * width + px)  * 4] < 80) return true
      return false
    }

    // Seed is deterministic from all layout params.
    const seed =
      text.split('').reduce((a, c) => a + c.charCodeAt(0), 0) +
      width * 13 +
      height * 7 +
      spacing * 31
    const rand = makeRng(seed)

    const points = []
    let row = 0

    for (let y = spacing / 2; y < height; y += spacing, row++) {
      // Stagger alternating rows by half-spacing — converts the square grid into a
      // triangular base. This single change is the primary organic-feel improvement:
      // natural neighbor angles shift from 0°/90° to ~0°/63°/117°, exactly matching
      // the angular-spread filter in useNeighbors and breaking all horizontal/vertical
      // alignment patterns.
      const xOff = (row & 1) ? spacing * 0.5 : 0

      for (let x = spacing / 2 + xOff; x < width; x += spacing) {
        // Higher jitter (0.55 vs 0.42): enough organic irregularity to break any
        // residual lattice feel without producing noisy randomness.
        const jx = x + (rand() - 0.5) * spacing * 0.55
        const jy = y + (rand() - 0.5) * spacing * 0.55

        if (!isInside(jx, jy)) continue

        // Boundary-aware density variation: points near glyph edges (curves, corners)
        // are always kept. Deep interior points have a ~13% chance of dropout, producing
        // subtle density gradients — denser at curves, slightly more open in flat strokes.
        if (!nearBoundary(jx, jy) && rand() < 0.13) continue

        points.push({ x: jx, y: jy })
      }
    }

    return points
  }, [text, fontFamily, fontReady, width, height, spacing])
}
