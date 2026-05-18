export const MOUSE_RADIUS = 90
export const MAX_DISPLACEMENT = 5
export const LERP_FACTOR = 0.07

// Returns the target (displaced) position for a point given the current mouse position.
// Points are pushed radially away from the cursor with a smooth falloff.
export function targetPosition(orig, mouse) {
  const dx = orig.x - mouse.x
  const dy = orig.y - mouse.y
  const d = Math.sqrt(dx * dx + dy * dy)

  if (d >= MOUSE_RADIUS || d < 0.5) return orig

  // Quadratic falloff: full influence at cursor, zero at radius edge
  const t = 1 - d / MOUSE_RADIUS
  const push = t * t * MAX_DISPLACEMENT
  return {
    x: orig.x + (dx / d) * push,
    y: orig.y + (dy / d) * push,
  }
}

// Single-step lerp toward target position.
export function stepToward(current, target) {
  const dx = target.x - current.x
  const dy = target.y - current.y
  // Skip micro-movement to avoid infinite float drift
  if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) return target
  return {
    x: current.x + dx * LERP_FACTOR,
    y: current.y + dy * LERP_FACTOR,
  }
}
