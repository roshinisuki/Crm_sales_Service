// components/HandshakeLoader.tsx
// Loading animation where the two halves of the SUKI CRM tick mark move
// apart and come back together like a handshake — used for connection,
// deal-closing, sync, and processing states.
//
// Usage:
//   <HandshakeLoader />                                    // default: clasp + ripple, blue, 64px
//   <HandshakeLoader size={96} accent="#F77F00" />          // orange theme, larger
//   <HandshakeLoader variant="flash" label="Connecting..." />
//   <HandshakeLoader fullScreen label="Closing the deal..." />

import React from 'react'

export type HandshakeVariant = 'ripple' | 'flash'

interface HandshakeLoaderProps {
  size?: number
  accent?: string
  variant?: HandshakeVariant
  label?: string
  fullScreen?: boolean
  background?: string
  speed?: number // seconds per full cycle, default 2.2
  className?: string
}

export function HandshakeLoader({
  size = 64,
  accent = '#2090FF',
  variant = 'ripple',
  label,
  fullScreen = false,
  background,
  speed = 2.2,
  className,
}: HandshakeLoaderProps) {
  const svgSize = size * 0.85

  const handshakeSvg = (
    <svg
      width={svgSize}
      height={svgSize * 0.7}
      viewBox="0 0 600 440"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="SUKI CRM"
      style={{ position: 'relative', zIndex: 2 }}
    >
      <g
        style={{
          animation: `suki-hs-top ${speed}s ease-in-out infinite`,
          transformOrigin: 'center',
        }}
      >
        <path
          d="M271.347 173.512C237.169 206.503 215.384 228.149 203.656 242.342C194.179 253.81 188.645 269.227 191.464 283.834C191.711 285.112 192.016 286.384 192.377 287.657C198.551 309.419 219.934 328.342 242.543 329.111C256.771 329.595 267.822 321.485 279.008 312.679L292.896 301.747C318.658 285.273 332.019 283.919 346.94 290.838C358.553 296.222 369.832 304.584 373.488 316.852C379.301 336.36 367.864 359.412 357.5 385L550.394 187.336C571.167 166.05 589.903 140.83 592.595 111.211C594.207 93.4827 591.102 77.3818 581.513 58.8554C572.531 41.4987 558.339 27.2564 541.628 17.1232C510.479 -1.76393 485.973 -4.50561 454.775 6.33468C434.99 13.2098 418.298 26.5609 403.486 41.3722L271.347 173.512Z"
          fill="white"
        />
      </g>
      <g
        style={{
          animation: `suki-hs-bottom ${speed}s ease-in-out infinite`,
          transformOrigin: 'center',
        }}
      >
        <path
          d="M189.087 118.132L258.698 185.877L222.04 222.657C209.22 235.52 195.788 249.406 192.312 267.231C190.473 276.66 191.684 285.835 196.833 296.726C203.633 311.109 215.578 322.261 231.016 326.107C248.103 330.365 266.076 321.419 280.218 310.926L296.061 299.172C320.042 283.694 334.026 279.665 362.043 299.172C374.977 309.305 381.225 318.815 381.49 332.192C382.016 358.783 362.384 380.906 343.578 399.712C325.757 417.533 305.095 433.976 280.244 438.173C270.085 439.889 259.538 440.09 247.099 438.323C217.168 434.073 191.615 415.605 170.238 394.229L48.3503 272.341C24.5145 248.505 4.61911 219.397 0.842184 185.9C-2.03178 160.411 2.24751 140.73 16.8081 119.726C22.7924 111.093 30.4126 103.678 38.7958 97.349C63.0675 79.026 84.1537 71.4883 115.357 76.2074C143.924 80.5279 168.381 97.9808 189.087 118.132Z"
          fill={accent}
        />
      </g>
    </svg>
  )

  const content = (
    <div
      className={className}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}
    >
      <div
        style={{
          width: size,
          height: size,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        {variant === 'ripple' && (
          <span
            style={{
              position: 'absolute',
              width: size * 0.75,
              height: size * 0.75,
              borderRadius: '50%',
              border: `2px solid ${accent}`,
              animation: `suki-hs-ring ${speed}s ease-out infinite`,
            }}
          />
        )}
        {variant === 'flash' && (
          <span
            style={{
              position: 'absolute',
              width: size * 0.18,
              height: size * 0.18,
              borderRadius: '50%',
              background: accent,
              boxShadow: `0 0 ${size * 0.25}px ${accent}`,
              animation: `suki-hs-flash ${speed}s ease-in-out infinite`,
            }}
          />
        )}
        {handshakeSvg}
      </div>

      {label && (
        <p style={{ fontSize: 13, color: 'var(--color-text-secondary, #5F5E5A)', margin: 0 }}>
          {label}
        </p>
      )}

      <style>{`
        @keyframes suki-hs-top {
          0% { transform: translate(14%, -10%) rotate(4deg); opacity: 0.5; }
          45% { transform: translate(0,0) rotate(0deg); opacity: 1; }
          55% { transform: translate(0,0) rotate(0deg); opacity: 1; }
          100% { transform: translate(14%, -10%) rotate(4deg); opacity: 0.5; }
        }
        @keyframes suki-hs-bottom {
          0% { transform: translate(-14%, 10%) rotate(-4deg); opacity: 0.5; }
          45% { transform: translate(0,0) rotate(0deg); opacity: 1; }
          55% { transform: translate(0,0) rotate(0deg); opacity: 1; }
          100% { transform: translate(-14%, 10%) rotate(-4deg); opacity: 0.5; }
        }
        @keyframes suki-hs-ring {
          0%, 40% { transform: scale(0.6); opacity: 0; }
          50% { transform: scale(1); opacity: 0.8; }
          100% { transform: scale(1.5); opacity: 0; }
        }
        @keyframes suki-hs-flash {
          0%, 40% { opacity: 0; }
          48%, 52% { opacity: 1; }
          60%, 100% { opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          * { animation: none !important; }
        }
      `}</style>
    </div>
  )

  if (!fullScreen) return content

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label || 'Loading'}
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: background || 'rgba(14,14,14,0.96)',
        zIndex: 9999,
      }}
    >
      {content}
    </div>
  )
}

export default HandshakeLoader
