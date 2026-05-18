import { lerpPoint, quadBezier, cubicBezier } from './geometry'

// Walk a parameterized curve in `resolution` steps, building an arc-length table.
// Then emit evenly-spaced points (by arc length) separated by `spacing` units.
function sampleArcLength(curveFn, spacing, resolution = 80) {
  const table = []
  let prev = curveFn(0)
  let arcLen = 0
  table.push({ pos: { ...prev }, arcLen: 0 })

  for (let i = 1; i <= resolution; i++) {
    const t = i / resolution
    const curr = curveFn(t)
    const dx = curr.x - prev.x
    const dy = curr.y - prev.y
    arcLen += Math.sqrt(dx * dx + dy * dy)
    table.push({ pos: { x: curr.x, y: curr.y }, arcLen })
    prev = curr
  }

  const totalLen = arcLen
  if (totalLen < spacing * 0.5) return []

  const points = []
  // Start half a spacing in so points distribute symmetrically
  let target = spacing * 0.5
  let si = 0

  while (target < totalLen) {
    while (si < table.length - 1 && table[si + 1].arcLen < target) si++
    if (si >= table.length - 1) break

    const s0 = table[si]
    const s1 = table[si + 1]
    const segLen = s1.arcLen - s0.arcLen
    const pt = segLen < 1e-6
      ? s0.pos
      : lerpPoint(s0.pos, s1.pos, (target - s0.arcLen) / segLen)

    points.push({ x: pt.x, y: pt.y })
    target += spacing
  }

  return points
}

// Convert opentype.js path commands → evenly-spaced sample points.
// `spacing` is in the coordinate space of the path commands.
export function samplePathCommands(commands, spacing = 20) {
  const points = []
  let cx = 0, cy = 0   // current pen position
  let sx = 0, sy = 0   // subpath start (for Z command)

  for (const cmd of commands) {
    if (cmd.type === 'M') {
      cx = cmd.x; cy = cmd.y
      sx = cmd.x; sy = cmd.y

    } else if (cmd.type === 'L') {
      const p0 = { x: cx, y: cy }
      const p1 = { x: cmd.x, y: cmd.y }
      points.push(...sampleArcLength(t => lerpPoint(p0, p1, t), spacing))
      cx = cmd.x; cy = cmd.y

    } else if (cmd.type === 'Q') {
      const p0 = { x: cx, y: cy }
      const p1 = { x: cmd.x1, y: cmd.y1 }
      const p2 = { x: cmd.x, y: cmd.y }
      points.push(...sampleArcLength(t => quadBezier(p0, p1, p2, t), spacing))
      cx = cmd.x; cy = cmd.y

    } else if (cmd.type === 'C') {
      const p0 = { x: cx, y: cy }
      const p1 = { x: cmd.x1, y: cmd.y1 }
      const p2 = { x: cmd.x2, y: cmd.y2 }
      const p3 = { x: cmd.x, y: cmd.y }
      points.push(...sampleArcLength(t => cubicBezier(p0, p1, p2, p3, t), spacing))
      cx = cmd.x; cy = cmd.y

    } else if (cmd.type === 'Z') {
      const dx = cx - sx, dy = cy - sy
      if (Math.sqrt(dx * dx + dy * dy) > 1) {
        const p0 = { x: cx, y: cy }
        const p1 = { x: sx, y: sy }
        points.push(...sampleArcLength(t => lerpPoint(p0, p1, t), spacing))
      }
      cx = sx; cy = sy
    }
  }

  return points
}
