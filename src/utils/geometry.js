export const lerp = (a, b, t) => a + (b - a) * t

export const lerpPoint = (p1, p2, t) => ({
  x: lerp(p1.x, p2.x, t),
  y: lerp(p1.y, p2.y, t),
})

export const dist = (p1, p2) => {
  const dx = p1.x - p2.x
  const dy = p1.y - p2.y
  return Math.sqrt(dx * dx + dy * dy)
}

export const quadBezier = (p0, p1, p2, t) => {
  const mt = 1 - t
  return {
    x: mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x,
    y: mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y,
  }
}

export const cubicBezier = (p0, p1, p2, p3, t) => {
  const mt = 1 - t
  return {
    x: mt*mt*mt*p0.x + 3*mt*mt*t*p1.x + 3*mt*t*t*p2.x + t*t*t*p3.x,
    y: mt*mt*mt*p0.y + 3*mt*mt*t*p1.y + 3*mt*t*t*p2.y + t*t*t*p3.y,
  }
}
