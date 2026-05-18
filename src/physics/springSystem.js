// Spring physics constants — tuned for a viscous, suspended, typographic feel.
// Units are pixels per tick (60fps assumed).
const MOUSE_RADIUS    = 130   // px — soft influence zone around cursor
const MOUSE_STRENGTH  = 0.20  // max force magnitude at cursor center
const RESTORE_K       = 0.036 // spring constant pulling node back to origin
const DAMPING         = 0.85  // velocity multiplier per tick (< 1 = energy loss)
const STRUCTURAL_K    = 0.013 // how strongly a node inherits neighbor displacement
const MAX_SPEED       = 2.6   // px/tick hard cap — prevents runaway motion

// Create fresh physics state from a geometry point array.
export function initNodes(points) {
  return points.map((p) => ({
    ox: p.x,  // rest / original x
    oy: p.y,  // rest / original y
    x:  p.x,  // current x
    y:  p.y,  // current y
    vx: 0,    // velocity x
    vy: 0,    // velocity y
  }))
}

// Build a per-node adjacency list from an edge array.
// Bounds-checked: edges referencing indices outside [0, count) are silently ignored.
// This prevents a TypeError crash when the effect that syncs edges fires before
// the effect that initialises nodes (count = 0, edges non-empty on first render).
export function buildAdjacency(count, edges) {
  const adj = Array.from({ length: count }, () => [])
  for (const [i, j] of edges) {
    if (i < count && j < count) {
      adj[i].push(j)
      adj[j].push(i)
    }
  }
  return adj
}

// Advance the simulation one tick.  Mutates `nodes` in-place.
// Three force passes: mouse repulsion → structural coupling → restore + integrate.
export function stepPhysics(nodes, adj, mouse) {
  const N = nodes.length
  if (N === 0 || adj.length === 0) return

  const fx = new Float32Array(N)
  const fy = new Float32Array(N)
  const mx = mouse.x
  const my = mouse.y

  // ── 1. Mouse repulsion: radial push with quadratic falloff ──────────────
  const R2 = MOUSE_RADIUS * MOUSE_RADIUS
  for (let i = 0; i < N; i++) {
    const dx = nodes[i].x - mx
    const dy = nodes[i].y - my
    const d2 = dx * dx + dy * dy
    if (d2 < R2 && d2 > 0.25) {
      const d   = Math.sqrt(d2)
      const t   = 1 - d / MOUSE_RADIUS
      const mag = t * t * MOUSE_STRENGTH
      fx[i] += (dx / d) * mag
      fy[i] += (dy / d) * mag
    }
  }

  // ── 2. Structural coupling: each node partly inherits neighbour displacement ─
  // Creates the elastic-mesh / tension-propagation feel.
  for (let i = 0; i < N; i++) {
    const ni   = nodes[i]
    const dixi = ni.x - ni.ox
    const diyi = ni.y - ni.oy
    const nbrs = adj[i] ?? []   // defensive: adj may be shorter than N during transition
    for (let m = 0; m < nbrs.length; m++) {
      const nj = nodes[nbrs[m]]
      if (!nj) continue          // guard against stale indices
      fx[i] += (nj.x - nj.ox - dixi) * STRUCTURAL_K
      fy[i] += (nj.y - nj.oy - diyi) * STRUCTURAL_K
    }
  }

  // ── 3. Restore spring + velocity damping + Euler integration ───────────
  for (let i = 0; i < N; i++) {
    const n = nodes[i]

    // Spring toward rest position
    fx[i] -= (n.x - n.ox) * RESTORE_K
    fy[i] -= (n.y - n.oy) * RESTORE_K

    // Integrate with velocity damping (implicit energy loss per tick)
    n.vx = (n.vx + fx[i]) * DAMPING
    n.vy = (n.vy + fy[i]) * DAMPING

    // Hard speed cap
    const speed = Math.sqrt(n.vx * n.vx + n.vy * n.vy)
    if (speed > MAX_SPEED) {
      const inv = MAX_SPEED / speed
      n.vx *= inv
      n.vy *= inv
    }

    n.x += n.vx
    n.y += n.vy
  }
}
