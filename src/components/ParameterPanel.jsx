import React from 'react'

const PANEL_W = 216
const FONT = '"Helvetica Neue", Helvetica, Arial, sans-serif'

// ── Slider row ─────────────────────────────────────────────────────────────
function ParamSlider({ label, value, min, max, step = 1, onChange, format }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: 10,
        }}
      >
        <span
          style={{
            fontSize: 7,
            fontFamily: FONT,
            fontWeight: 300,
            color: 'rgba(255, 255, 255, 0.32)',
            letterSpacing: '0.28em',
            textTransform: 'uppercase',
          }}
        >
          {label}
        </span>
        <span
          style={{
            fontSize: 10,
            fontFamily: 'monospace',
            color: 'rgba(255, 255, 255, 0.62)',
            letterSpacing: '0.04em',
          }}
        >
          {format ? format(value) : value}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: '100%', cursor: 'pointer' }}
      />
    </div>
  )
}

// ── Panel ──────────────────────────────────────────────────────────────────
export function ParameterPanel({ params, onChange, open, onToggle }) {
  return (
    <>
      {/* ── Slide-in dark glass panel ────────────────────────────────────── */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          height: '100%',
          width: PANEL_W,
          background: 'rgba(5, 5, 5, 0.88)',
          backdropFilter: 'blur(32px)',
          WebkitBackdropFilter: 'blur(32px)',
          borderLeft: '1px solid rgba(255, 255, 255, 0.06)',
          boxShadow: '-1px 0 0 rgba(255,255,255,0.03), -24px 0 64px rgba(0,0,0,0.40)',
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.48s cubic-bezier(0.4, 0, 0.2, 1)',
          zIndex: 100,
          overflowY: 'auto',
          pointerEvents: open ? 'auto' : 'none',
        }}
      >
        <div style={{ padding: '44px 24px 36px' }}>

          {/* Section header */}
          <div
            style={{
              fontSize: 7,
              fontFamily: FONT,
              fontWeight: 300,
              color: 'rgba(255, 255, 255, 0.20)',
              letterSpacing: '0.32em',
              textTransform: 'uppercase',
              marginBottom: 40,
            }}
          >
            Parameters
          </div>

          {/* Hairline divider */}
          <div
            style={{
              height: 1,
              background: 'rgba(255, 255, 255, 0.05)',
              marginBottom: 32,
            }}
          />

          <ParamSlider
            label="Neighbors"
            value={params.numNeighbors}
            min={1}
            max={12}
            onChange={(v) => onChange({ ...params, numNeighbors: v })}
          />

          <ParamSlider
            label="Density"
            value={params.spacing}
            min={8}
            max={28}
            step={1}
            onChange={(v) => onChange({ ...params, spacing: v })}
            format={(v) => `${v}px`}
          />

          <ParamSlider
            label="Remove Lines"
            value={params.removalPct}
            min={0}
            max={100}
            onChange={(v) => onChange({ ...params, removalPct: v })}
            format={(v) => `${v}%`}
          />

          {/* Hairline divider */}
          <div
            style={{
              height: 1,
              background: 'rgba(255, 255, 255, 0.05)',
              margin: '8px 0 24px',
            }}
          />

          {/* Stats readout */}
          {params._pointCount !== undefined && (
            <div
              style={{
                fontSize: 7,
                fontFamily: FONT,
                fontWeight: 300,
                color: 'rgba(255, 255, 255, 0.18)',
                letterSpacing: '0.18em',
                lineHeight: 2.4,
                textTransform: 'uppercase',
              }}
            >
              {params._pointCount}&thinsp;nodes
              <br />
              {params._edgeCount}&thinsp;edges
            </div>
          )}
        </div>
      </div>

      {/* ── Toggle tab ────────────────────────────────────────────────────── */}
      <button
        onClick={onToggle}
        style={{
          position: 'fixed',
          right: 0,
          top: '50%',
          transform: open
            ? `translateX(-${PANEL_W}px) translateY(-50%)`
            : 'translateX(0) translateY(-50%)',
          transition: 'transform 0.48s cubic-bezier(0.4, 0, 0.2, 1)',
          width: 16,
          height: 52,
          background: 'rgba(255, 255, 255, 0.04)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.07)',
          borderRight: 'none',
          borderRadius: '6px 0 0 6px',
          cursor: 'pointer',
          zIndex: 102,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'rgba(255, 255, 255, 0.22)',
          fontSize: 9,
          outline: 'none',
          flexShrink: 0,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(255,255,255,0.08)'
          e.currentTarget.style.color = 'rgba(255,255,255,0.50)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
          e.currentTarget.style.color = 'rgba(255,255,255,0.22)'
        }}
        aria-label={open ? 'Close parameters' : 'Open parameters'}
      >
        {open ? '›' : '‹'}
      </button>
    </>
  )
}
