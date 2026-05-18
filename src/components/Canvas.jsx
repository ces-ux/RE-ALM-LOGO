import { useRef, useEffect, useMemo } from 'react'
import { initNodes, buildAdjacency, stepPhysics } from '../physics/springSystem'

// ── Colour palette ───────────────────────────────────────────────────────────
const LINE_RGB      = '220, 168, 62'
const LINE_OPACITY  = 0.28
const LINE_BOOST    = 0.06
const LINE_WIDTH    = 0.35

const EDGE_ENERGY   = 0.20

const CORE_RGB      = '255, 250, 232'
const CORE_OPACITY  = 0.68
const CORE_RADIUS   = 1.0

const GLOW_RGB      = '248, 210, 92'
const FRESNEL_RGB   = '200, 160, 255'
const GLOW_RADIUS   = 3.0

const INTERACT_R    = 110

// ── Animation timing ──────────────────────────────────────────────────────────
const NODE_REVEAL_DELAY_MAX = 1800   // ms — stagger window; last node starts here
const NODE_REVEAL_DURATION  = 600    // ms — per-node fade-in
const NODE_FADE_SPEED       = 0.06   // per-frame exponential decay for old nodes

const NODE_EDGE_OFFSET = 1600        // ms — edges don't begin until after this
const REVEAL_DELAY_MAX = 2200        // ms — edge stagger window (after offset)
const REVEAL_DURATION  = 650         // ms — per-edge fade-in

const SEC_MAX_ALPHA  = 0.44
const SEC_INTERACT_R = 90
const SEC_LERP_IN    = 0.055
const SEC_LERP_OUT   = 0.030

const N_EDGE_BUCKETS = 8
const N_NODE_BUCKETS = 6

// ── Glow sprite factory ──────────────────────────────────────────────────────
function buildGlowSprite() {
  const margin = 1
  const size   = Math.ceil((GLOW_RADIUS + margin) * 2)
  const cx     = size / 2
  const oc     = document.createElement('canvas')
  oc.width = oc.height = size
  const g      = oc.getContext('2d')

  const warm = g.createRadialGradient(cx, cx, 0, cx, cx, GLOW_RADIUS)
  warm.addColorStop(0.00, `rgba(${GLOW_RGB}, 0.010)`)
  warm.addColorStop(0.28, `rgba(${GLOW_RGB}, 0.092)`)
  warm.addColorStop(0.38, `rgba(${GLOW_RGB}, 0.200)`)
  warm.addColorStop(0.56, `rgba(${GLOW_RGB}, 0.058)`)
  warm.addColorStop(0.78, `rgba(${GLOW_RGB}, 0.008)`)
  warm.addColorStop(1.00, `rgba(${GLOW_RGB}, 0)`)
  g.fillStyle = warm
  g.fillRect(0, 0, size, size)

  const purple = g.createRadialGradient(cx, cx, 0, cx, cx, GLOW_RADIUS * 0.72)
  purple.addColorStop(0.00, `rgba(${FRESNEL_RGB}, 0)`)
  purple.addColorStop(0.32, `rgba(${FRESNEL_RGB}, 0.028)`)
  purple.addColorStop(0.46, `rgba(${FRESNEL_RGB}, 0.042)`)
  purple.addColorStop(0.65, `rgba(${FRESNEL_RGB}, 0.014)`)
  purple.addColorStop(0.88, `rgba(${FRESNEL_RGB}, 0)`)
  g.fillStyle = purple
  g.fillRect(0, 0, size, size)

  return { canvas: oc, half: cx }
}

// ── Deterministic hashes — three independent phases ──────────────────────────
const pseudoRand = (i) => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453123
  return x - Math.floor(x)
}
const revealHash = (i) => {
  const x = Math.sin(i * 93.7 + 419.3) * 28451.7612
  return x - Math.floor(x)
}
const nodeHash = (i) => {
  const x = Math.sin(i * 53.7 + 271.3) * 31847.2891
  return x - Math.floor(x)
}

const TWO_PI = Math.PI * 2

export function Canvas({ points, edges, secondaryEdges, removalPct, width, height }) {
  const canvasRef = useRef(null)

  // Physics
  const nodesRef = useRef([])
  const adjRef   = useRef([])
  const edgesRef = useRef(edges)
  const visRef   = useRef([])
  const mouseRef = useRef({ x: -9999, y: -9999 })

  // Shared reveal clock — both node and edge reveal read from this
  const revealStartRef = useRef(null)

  // Edge reveal state
  const revealDelayRef = useRef([])
  const revealAlphaRef = useRef(null)

  // New-node reveal state
  const nodeOpacityRef = useRef(null)  // Float32Array [0..1] per node
  const nodeDelayRef   = useRef([])    // normalised delay [0..1] per node

  // Old-node fade-out state (previous topology, static/frozen)
  const oldNodePosRef = useRef(null)   // Float32Array [x,y,x,y,...] frozen positions
  const oldOpacityRef = useRef(null)   // Float32Array fading-out opacities

  // Secondary edges
  const secEdgesRef = useRef([])
  const secAlphaRef = useRef(null)

  const visibility = useMemo(
    () => edges.map((_, i) => pseudoRand(i) >= removalPct / 100),
    [edges, removalPct]
  )

  // Sync edges + visibility + adjacency; reset edge reveal clock
  useEffect(() => {
    edgesRef.current  = edges
    visRef.current    = visibility
    adjRef.current    = buildAdjacency(nodesRef.current.length, edges)

    revealStartRef.current = performance.now()
    revealDelayRef.current = edges.map((_, i) => revealHash(i))
    revealAlphaRef.current = new Float32Array(edges.length)
  }, [edges, visibility])

  // Sync secondary edges
  useEffect(() => {
    secEdgesRef.current = secondaryEdges
    secAlphaRef.current = new Float32Array(secondaryEdges.length)
  }, [secondaryEdges])

  // Points change: snapshot old nodes for fade-out, init new physics, start node reveal
  useEffect(() => {
    const prev   = nodesRef.current
    const prevOp = nodeOpacityRef.current

    if (prev.length > 0 && prevOp) {
      // Freeze old positions — old nodes are static during fade-out (no physics)
      const snap = new Float32Array(prev.length * 2)
      for (let i = 0; i < prev.length; i++) {
        snap[i * 2]     = isFinite(prev[i].x) ? prev[i].x : 0
        snap[i * 2 + 1] = isFinite(prev[i].y) ? prev[i].y : 0
      }
      oldNodePosRef.current = snap
      oldOpacityRef.current = new Float32Array(prevOp)
    } else {
      oldNodePosRef.current = null
      oldOpacityRef.current = null
    }

    nodesRef.current = initNodes(points)
    adjRef.current   = buildAdjacency(points.length, edges)

    // Reset reveal clock (edges effect also sets this — both fire same render)
    revealStartRef.current = performance.now()
    nodeDelayRef.current   = points.map((_, i) => nodeHash(i))
    nodeOpacityRef.current = new Float32Array(points.length)  // all start at 0
  }, [points]) // eslint-disable-line react-hooks/exhaustive-deps

  // Mouse tracking
  useEffect(() => {
    const onMove = (e) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    }
    const onLeave = () => { mouseRef.current = { x: -9999, y: -9999 } }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseleave', onLeave)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseleave', onLeave)
    }
  }, [])

  // ── Core rAF loop ─────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let raf

    const glow = buildGlowSprite()

    // Pre-allocated reusable bucket arrays
    const edgeBuckets = Array.from({ length: N_EDGE_BUCKETS }, () => [])
    const nodeBuckets = Array.from({ length: N_NODE_BUCKETS }, () => [])

    const tick = () => {
      raf = requestAnimationFrame(tick)

      try {
        const nodes    = nodesRef.current
        const adj      = adjRef.current
        const edgeList = edgesRef.current
        const vis      = visRef.current
        const mouse    = mouseRef.current
        const N        = nodes.length

        // Safety reset — guards against stale globalAlpha from a mid-frame throw
        ctx.globalAlpha = 1.0

        if (N > 0) stepPhysics(nodes, adj, mouse)

        ctx.clearRect(0, 0, canvas.width, canvas.height)

        // Mouse coords (used by energy pre-pass and secondary edges)
        const mx  = mouse.x
        const my  = mouse.y
        const IR2 = INTERACT_R * INTERACT_R

        // Energy pre-pass — sparse array, only nodes within INTERACT_R
        const nodeEnergy = []
        let mouseActivity = 0
        for (let i = 0; i < N; i++) {
          const dx = nodes[i].x - mx
          const dy = nodes[i].y - my
          const d2 = dx * dx + dy * dy
          if (d2 < IR2) {
            const t = (1 - Math.sqrt(d2) / INTERACT_R) ** 2
            nodeEnergy[i] = t
            if (t > mouseActivity) mouseActivity = t
          }
        }

        const now     = performance.now()
        const elapsed = revealStartRef.current !== null ? now - revealStartRef.current : 0

        // ── A. Old-node fade-out — drawn behind new topology ──────────────
        const oldOp  = oldOpacityRef.current
        const oldPos = oldNodePosRef.current
        if (oldOp && oldPos) {
          const oldN = oldOp.length
          let anyVisible = false

          for (let i = 0; i < oldN; i++) {
            if (oldOp[i] > 0.005) {
              oldOp[i] *= (1 - NODE_FADE_SPEED)
              anyVisible = true
            } else {
              oldOp[i] = 0
            }
          }

          // Old glows — per-node globalAlpha (already one drawImage per node)
          for (let i = 0; i < oldN; i++) {
            const op = oldOp[i]
            if (op < 0.005) continue
            const x = oldPos[i * 2], y = oldPos[i * 2 + 1]
            if (!isFinite(x) || !isFinite(y)) continue
            ctx.globalAlpha = op
            ctx.drawImage(glow.canvas, x - glow.half, y - glow.half)
          }
          ctx.globalAlpha = 1.0

          // Old cores — bucketed
          for (let b = 0; b < N_NODE_BUCKETS; b++) nodeBuckets[b].length = 0
          for (let i = 0; i < oldN; i++) {
            const op = oldOp[i]
            if (op < 0.005) continue
            nodeBuckets[Math.min(N_NODE_BUCKETS - 1, (op * N_NODE_BUCKETS) | 0)].push(i)
          }
          for (let b = 0; b < N_NODE_BUCKETS; b++) {
            if (nodeBuckets[b].length === 0) continue
            ctx.fillStyle = `rgba(${CORE_RGB}, ${(((b + 0.5) / N_NODE_BUCKETS) * CORE_OPACITY).toFixed(3)})`
            ctx.beginPath()
            for (const i of nodeBuckets[b]) {
              const x = oldPos[i * 2], y = oldPos[i * 2 + 1]
              if (!isFinite(x) || !isFinite(y)) continue
              ctx.moveTo(x + CORE_RADIUS, y)
              ctx.arc(x, y, CORE_RADIUS, 0, TWO_PI)
            }
            ctx.fill()
          }

          if (!anyVisible) {
            oldOpacityRef.current = null
            oldNodePosRef.current = null
          }
        }

        if (!N) return

        const lineOp = LINE_OPACITY + mouseActivity * LINE_BOOST

        // ── B. Update new-node reveal opacities ───────────────────────────
        const nodeOp  = nodeOpacityRef.current
        const nDelays = nodeDelayRef.current
        if (nodeOp) {
          for (let i = 0; i < N; i++) {
            const d = nDelays[i] * NODE_REVEAL_DELAY_MAX
            const t = Math.min(1, Math.max(0, (elapsed - d) / NODE_REVEAL_DURATION))
            nodeOp[i] = t * t * (3 - 2 * t)  // smoothstep
          }
        }

        // ── C. Update edge reveal alphas (offset so edges follow nodes) ───
        const revAlpha = revealAlphaRef.current
        const delays   = revealDelayRef.current
        if (revAlpha) {
          for (let idx = 0; idx < edgeList.length; idx++) {
            if (!vis[idx]) continue
            const d = NODE_EDGE_OFFSET + delays[idx] * REVEAL_DELAY_MAX
            const t = Math.min(1, Math.max(0, (elapsed - d) / REVEAL_DURATION))
            revAlpha[idx] = t * t * (3 - 2 * t)
          }
        }

        // ── D. Lines: fully revealed batch ────────────────────────────────
        ctx.strokeStyle = `rgba(${LINE_RGB}, ${lineOp.toFixed(3)})`
        ctx.lineWidth   = LINE_WIDTH
        ctx.beginPath()
        for (let idx = 0; idx < edgeList.length; idx++) {
          if (!vis[idx] || !revAlpha || revAlpha[idx] < 0.99) continue
          const [i, j] = edgeList[idx]
          const ni = nodes[i]; const nj = nodes[j]
          if (!ni || !nj) continue
          if (!isFinite(ni.x) || !isFinite(ni.y) || !isFinite(nj.x) || !isFinite(nj.y)) continue
          ctx.moveTo(ni.x, ni.y)
          ctx.lineTo(nj.x, nj.y)
        }
        ctx.stroke()

        // ── E. Transitioning edges — bucketed single pass ─────────────────
        if (revAlpha) {
          for (let b = 0; b < N_EDGE_BUCKETS; b++) edgeBuckets[b].length = 0
          for (let idx = 0; idx < edgeList.length; idx++) {
            if (!vis[idx]) continue
            const a = revAlpha[idx]
            if (a >= 0.99 || a < 0.005) continue
            edgeBuckets[Math.min(N_EDGE_BUCKETS - 1, (a * N_EDGE_BUCKETS) | 0)].push(idx)
          }
          for (let b = 0; b < N_EDGE_BUCKETS; b++) {
            if (edgeBuckets[b].length === 0) continue
            const bucketOp = ((b + 0.5) / N_EDGE_BUCKETS) * lineOp
            ctx.strokeStyle = `rgba(${LINE_RGB}, ${bucketOp.toFixed(3)})`
            ctx.lineWidth   = LINE_WIDTH
            ctx.beginPath()
            for (const idx of edgeBuckets[b]) {
              const [i, j] = edgeList[idx]
              const ni = nodes[i]; const nj = nodes[j]
              if (!ni || !nj) continue
              if (!isFinite(ni.x) || !isFinite(ni.y) || !isFinite(nj.x) || !isFinite(nj.y)) continue
              ctx.moveTo(ni.x, ni.y)
              ctx.lineTo(nj.x, nj.y)
            }
            ctx.stroke()
          }
        }

        // ── F. Edge energy propagation — revealed edges only ──────────────
        if (mouseActivity > 0.01) {
          ctx.strokeStyle = `rgba(${LINE_RGB}, ${(LINE_OPACITY + EDGE_ENERGY).toFixed(3)})`
          ctx.lineWidth   = LINE_WIDTH
          ctx.beginPath()
          for (let idx = 0; idx < edgeList.length; idx++) {
            if (!vis[idx]) continue
            if (revAlpha && revAlpha[idx] < 0.12) continue
            const [i, j] = edgeList[idx]
            if (!nodeEnergy[i] && !nodeEnergy[j]) continue
            const ni = nodes[i]; const nj = nodes[j]
            if (!ni || !nj) continue
            if (!isFinite(ni.x) || !isFinite(ni.y) || !isFinite(nj.x) || !isFinite(nj.y)) continue
            ctx.moveTo(ni.x, ni.y)
            ctx.lineTo(nj.x, nj.y)
          }
          ctx.stroke()
        }

        // ── G. Secondary hover edges ──────────────────────────────────────
        const secList  = secEdgesRef.current
        const secAlpha = secAlphaRef.current
        if (secList.length > 0 && secAlpha) {
          const SIR2 = SEC_INTERACT_R * SEC_INTERACT_R

          for (let idx = 0; idx < secList.length; idx++) {
            const [i, j] = secList[idx]
            const ni = nodes[i]; const nj = nodes[j]
            if (!ni || !nj) { secAlpha[idx] = 0; continue }

            let target = 0
            const dxi = ni.x - mx, dyi = ni.y - my
            const d2i = dxi * dxi + dyi * dyi
            if (d2i < SIR2) {
              const t = (1 - Math.sqrt(d2i) / SEC_INTERACT_R) ** 2
              if (t > target) target = t
            }
            const dxj = nj.x - mx, dyj = nj.y - my
            const d2j = dxj * dxj + dyj * dyj
            if (d2j < SIR2) {
              const t = (1 - Math.sqrt(d2j) / SEC_INTERACT_R) ** 2
              if (t > target) target = t
            }

            const tgt = target * SEC_MAX_ALPHA
            const cur = secAlpha[idx]
            secAlpha[idx] = cur + (tgt - cur) * (tgt > cur ? SEC_LERP_IN : SEC_LERP_OUT)
          }

          const MID = SEC_MAX_ALPHA * 0.5
          let hasLo = false, hasHi = false
          for (let idx = 0; idx < secList.length; idx++) {
            const a = secAlpha[idx]
            if (a >= 0.004 && a < MID) { hasLo = true; if (hasHi) break }
            if (a >= MID)              { hasHi = true; if (hasLo) break }
          }
          if (hasLo) {
            ctx.strokeStyle = `rgba(${LINE_RGB}, ${(SEC_MAX_ALPHA * 0.25).toFixed(3)})`
            ctx.lineWidth   = LINE_WIDTH
            ctx.beginPath()
            for (let idx = 0; idx < secList.length; idx++) {
              const a = secAlpha[idx]
              if (a < 0.004 || a >= MID) continue
              const [i, j] = secList[idx]
              const ni = nodes[i]; const nj = nodes[j]
              if (!ni || !nj) continue
              if (!isFinite(ni.x) || !isFinite(ni.y) || !isFinite(nj.x) || !isFinite(nj.y)) continue
              ctx.moveTo(ni.x, ni.y)
              ctx.lineTo(nj.x, nj.y)
            }
            ctx.stroke()
          }
          if (hasHi) {
            ctx.strokeStyle = `rgba(${LINE_RGB}, ${(SEC_MAX_ALPHA * 0.75).toFixed(3)})`
            ctx.lineWidth   = LINE_WIDTH
            ctx.beginPath()
            for (let idx = 0; idx < secList.length; idx++) {
              if (secAlpha[idx] < MID) continue
              const [i, j] = secList[idx]
              const ni = nodes[i]; const nj = nodes[j]
              if (!ni || !nj) continue
              if (!isFinite(ni.x) || !isFinite(ni.y) || !isFinite(nj.x) || !isFinite(nj.y)) continue
              ctx.moveTo(ni.x, ni.y)
              ctx.lineTo(nj.x, nj.y)
            }
            ctx.stroke()
          }
        }

        // ── H. New-node glows — per-node opacity via globalAlpha ──────────
        if (nodeOp) {
          for (let i = 0; i < N; i++) {
            const op = nodeOp[i]
            if (op < 0.005) continue
            const n = nodes[i]
            if (!isFinite(n.x) || !isFinite(n.y)) continue
            ctx.globalAlpha = op
            ctx.drawImage(glow.canvas, n.x - glow.half, n.y - glow.half)
          }
          ctx.globalAlpha = 1.0
        } else {
          for (let i = 0; i < N; i++) {
            const n = nodes[i]
            if (!isFinite(n.x) || !isFinite(n.y)) continue
            ctx.drawImage(glow.canvas, n.x - glow.half, n.y - glow.half)
          }
        }

        // ── I. New-node cores — bucketed by reveal opacity ─────────────────
        if (nodeOp) {
          for (let b = 0; b < N_NODE_BUCKETS; b++) nodeBuckets[b].length = 0
          for (let i = 0; i < N; i++) {
            const op = nodeOp[i]
            if (op < 0.005) continue
            nodeBuckets[Math.min(N_NODE_BUCKETS - 1, (op * N_NODE_BUCKETS) | 0)].push(i)
          }
          for (let b = 0; b < N_NODE_BUCKETS; b++) {
            if (nodeBuckets[b].length === 0) continue
            ctx.fillStyle = `rgba(${CORE_RGB}, ${(((b + 0.5) / N_NODE_BUCKETS) * CORE_OPACITY).toFixed(3)})`
            ctx.beginPath()
            for (const i of nodeBuckets[b]) {
              const n = nodes[i]
              if (!isFinite(n.x) || !isFinite(n.y)) continue
              ctx.moveTo(n.x + CORE_RADIUS, n.y)
              ctx.arc(n.x, n.y, CORE_RADIUS, 0, TWO_PI)
            }
            ctx.fill()
          }
        } else {
          ctx.fillStyle = `rgba(${CORE_RGB}, ${CORE_OPACITY})`
          ctx.beginPath()
          for (let i = 0; i < N; i++) {
            const n = nodes[i]
            if (!isFinite(n.x) || !isFinite(n.y)) continue
            ctx.moveTo(n.x + CORE_RADIUS, n.y)
            ctx.arc(n.x, n.y, CORE_RADIUS, 0, TWO_PI)
          }
          ctx.fill()
        }

      } catch (err) {
        ctx.globalAlpha = 1.0  // safety reset so future frames render correctly
        console.error('[Canvas] tick error:', err)
      }
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, []) // intentionally empty

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
    />
  )
}
