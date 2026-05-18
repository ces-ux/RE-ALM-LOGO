import React, { useRef, useEffect } from 'react'

export function InputPanel({ text, onChange }) {
  const inputRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 32,
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(5, 5, 5, 0.82)',
        backdropFilter: 'blur(32px)',
        WebkitBackdropFilter: 'blur(32px)',
        border: '1px solid rgba(255, 255, 255, 0.09)',
        boxShadow: '0 0 0 1px rgba(255,255,255,0.03), 0 24px 64px rgba(0,0,0,0.72)',
        borderRadius: 28,
        padding: '13px 28px',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        minWidth: 320,
        zIndex: 200,
      }}
    >
      <input
        ref={inputRef}
        type="text"
        value={text}
        onChange={e => onChange(e.target.value)}
        placeholder="Type something…"
        style={{
          border: 'none',
          background: 'transparent',
          outline: 'none',
          fontSize: 14,
          fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
          fontWeight: 300,
          color: 'rgba(255, 255, 255, 0.78)',
          letterSpacing: '0.10em',
          flex: 1,
          minWidth: 220,
        }}
      />
      <span
        style={{
          fontSize: 8,
          fontFamily: 'monospace',
          color: 'rgba(255, 255, 255, 0.18)',
          letterSpacing: '0.08em',
          userSelect: 'none',
          flexShrink: 0,
        }}
      >
        {text.length}
      </span>
    </div>
  )
}
