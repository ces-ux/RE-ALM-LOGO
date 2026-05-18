import { useMemo } from 'react'

// Minimum angular gap between accepted neighbors — prevents edge bunching in
// the same direction while allowing natural triangular connectivity.
// 45° (π/4): permissive enough for the staggered-grid's natural ~63° diagonal
// angles to pass through, creating organic triangular flows rather than forced
// 90°-spread square patterns.
const MIN_ANG = Math.PI / 4
const TWO_PI  = Math.PI * 2

// Spatial grid for O(1) bucket lookups — avoids O(n²) exhaustive search.
function buildGrid(points, cellSize) {
  const grid = new Map()
  for (let i = 0; i < points.length; i++) {
    const gx = Math.floor(points[i].x / cellSize)
    const gy = Math.floor(points[i].y / cellSize)
    const key = `${gx},${gy}`
    if (!grid.has(key)) grid.set(key, [])
    grid.get(key).push(i)
  }
  return grid
}

// Returns a deduplicated edge list [i, j] (i < j) for k-nearest neighbors
// within maxDist. Uses a spatial grid so complexity is ~O(n · k).
export function useNeighbors({ points, k, maxDist = Infinity }) {
  return useMemo(() => {
    const n = points.length
    if (n < 2 || k < 1) return []

    const cellSize = maxDist === Infinity ? 200 : maxDist
    const grid = buildGrid(points, cellSize)
    const radius = Math.ceil(maxDist / cellSize)
    const edges = []
    const seen = new Set()

    for (let i = 0; i < n; i++) {
      const px = points[i].x
      const py = points[i].y
      const gcx = Math.floor(px / cellSize)
      const gcy = Math.floor(py / cellSize)

      // Gather candidates from neighboring grid cells
      const candidates = []
      for (let gx = gcx - radius; gx <= gcx + radius; gx++) {
        for (let gy = gcy - radius; gy <= gcy + radius; gy++) {
          const cell = grid.get(`${gx},${gy}`)
          if (!cell) continue
          for (const j of cell) {
            if (j === i) continue
            const dx = px - points[j].x
            const dy = py - points[j].y
            const d = Math.sqrt(dx * dx + dy * dy)
            if (d <= maxDist) candidates.push({ j, d })
          }
        }
      }

      candidates.sort((a, b) => a.d - b.d)

      // Angular-spread selection: only accept a neighbor if its bearing from i
      // is at least MIN_ANG away from every already-accepted neighbor.
      // Result: edges fan around each node, eliminating co-directional clusters
      // and producing larger, more structural geometric patterns.
      const accepted = []  // accepted neighbor angles (radians)
      for (const { j } of candidates) {
        if (accepted.length >= k) break
        const ang = Math.atan2(points[j].y - py, points[j].x - px)
        let blocked = false
        for (const a of accepted) {
          let diff = Math.abs(ang - a)
          if (diff > Math.PI) diff = TWO_PI - diff
          if (diff < MIN_ANG) { blocked = true; break }
        }
        if (blocked) continue
        accepted.push(ang)
        const key = i < j ? `${i},${j}` : `${j},${i}`
        if (!seen.has(key)) {
          seen.add(key)
          edges.push([i, j])
        }
      }
    }

    return edges
  }, [points, k, maxDist])
}
