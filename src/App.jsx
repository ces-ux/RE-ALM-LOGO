import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useFont } from './hooks/useFont'
import { useTypography } from './hooks/useTypography'
import { useNeighbors } from './hooks/useNeighbors'
import { Canvas } from './components/Canvas'
import { InputPanel } from './components/InputPanel'
import { ParameterPanel } from './components/ParameterPanel'

function useWindowSize() {
  const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight })
  useEffect(() => {
    const update = () => setSize({ width: window.innerWidth, height: window.innerHeight })
    window.addEventListener('resize', update)
    // fullscreenchange can fire without a resize event — read dimensions explicitly
    document.addEventListener('fullscreenchange', update)
    return () => {
      window.removeEventListener('resize', update)
      document.removeEventListener('fullscreenchange', update)
    }
  }, [])
  return size
}

function useFullscreen(containerRef) {
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    const onChange = () => {
      const fs = !!document.fullscreenElement
      console.log('[Fullscreen] state:', fs, '| element:', document.fullscreenElement?.tagName)
      setIsFullscreen(fs)
    }
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  const toggle = useCallback(() => {
    if (!document.fullscreenElement) {
      const el = containerRef.current
      if (!el) { console.warn('[Fullscreen] container ref not set'); return }
      console.log('[Fullscreen] requesting on:', el.tagName, el.className)
      el.requestFullscreen().catch((err) => {
        console.error('[Fullscreen] requestFullscreen failed:', err.name, err.message)
      })
    } else {
      document.exitFullscreen().catch((err) => {
        console.error('[Fullscreen] exitFullscreen failed:', err.name, err.message)
      })
    }
  }, [containerRef])

  return { isFullscreen, toggle }
}

// Minimal corner-bracket SVG icons — thin strokes, architectural feel.
function IconExpand() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor"
         strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="1,5 1,1 5,1" />
      <polyline points="9,1 13,1 13,5" />
      <polyline points="1,9 1,13 5,13" />
      <polyline points="9,13 13,13 13,9" />
    </svg>
  )
}

function IconCompress() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor"
         strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="5,1 5,5 1,5" />
      <polyline points="9,1 9,5 13,5" />
      <polyline points="5,13 5,9 1,9" />
      <polyline points="9,13 9,9 13,9" />
    </svg>
  )
}

export default function App() {
  const [text, setText] = useState('FORM')
  const [panelOpen, setPanelOpen] = useState(false)
  const [params, setParams] = useState({
    numNeighbors: 4,
    removalPct: 0,
    spacing: 16,
  })

  const containerRef = useRef(null)
  const { width, height } = useWindowSize()
  const { fontFamily, fontReady } = useFont()
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen(containerRef)

  const points = useTypography({
    text,
    fontFamily,
    fontReady,
    width,
    height,
    spacing: params.spacing,
  })

  const edges = useNeighbors({
    points,
    k: params.numNeighbors,
    maxDist: params.spacing * 2.2,
  })

  // Denser neighbor set for secondary hover edges — superset of primary
  const denseEdges = useNeighbors({
    points,
    k: params.numNeighbors + 5,
    maxDist: params.spacing * 2.8,
  })

  // Secondary edges = denseEdges minus primary edges
  const secondaryEdges = useMemo(() => {
    const primary = new Set(edges.map(([i, j]) => `${i},${j}`))
    return denseEdges.filter(([i, j]) => !primary.has(`${i},${j}`))
  }, [denseEdges, edges])

  const displayParams = {
    ...params,
    _pointCount: points.length,
    _edgeCount: edges.length,
  }

  return (
    <div
      ref={containerRef}
      style={{
        width: '100vw',
        height: '100vh',
        background: '#050505',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
      }}
    >
      {/* Radial vignette — deepens corners, creates spatial depth */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse 85% 85% at 50% 50%, transparent 38%, rgba(0,0,0,0.62) 100%)',
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />

      {points.length === 0 && text.trim() && (
        <div style={centerLabel}>
          <span style={monoLabel}>No glyph data</span>
        </div>
      )}

      <Canvas
        points={points}
        edges={edges}
        secondaryEdges={secondaryEdges}
        removalPct={params.removalPct}
        width={width}
        height={height}
      />

      <InputPanel text={text} onChange={setText} />

      <ParameterPanel
        params={displayParams}
        onChange={setParams}
        open={panelOpen}
        onToggle={() => setPanelOpen((o) => !o)}
      />

      <FullscreenButton isFullscreen={isFullscreen} onToggle={toggleFullscreen} />
    </div>
  )
}

function FullscreenButton({ isFullscreen, onToggle }) {
  const [hovered, setHovered] = useState(false)

  return (
    <button
      onClick={onToggle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
      style={{
        position: 'fixed',
        top: 18,
        right: 18,
        width: 34,
        height: 34,
        background: hovered ? 'rgba(10, 10, 10, 0.88)' : 'rgba(5, 5, 5, 0.72)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: hovered
          ? '1px solid rgba(220, 168, 62, 0.28)'
          : '1px solid rgba(255, 255, 255, 0.09)',
        borderRadius: 7,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        color: hovered ? 'rgba(220, 168, 62, 0.90)' : 'rgba(255, 255, 255, 0.35)',
        zIndex: 150,
        outline: 'none',
        transition: 'color 0.18s ease, border-color 0.18s ease, background 0.18s ease',
        flexShrink: 0,
      }}
    >
      {isFullscreen ? <IconCompress /> : <IconExpand />}
    </button>
  )
}

const centerLabel = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  pointerEvents: 'none',
  zIndex: 2,
}

const monoLabel = {
  fontSize: 9,
  fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
  fontWeight: 300,
  letterSpacing: '0.25em',
  textTransform: 'uppercase',
  color: 'rgba(255,255,255,0.20)',
}
