interface CRMSpinnerProps {
  size?: number
  /** Pass a hex/rgb to override. Omit to inherit var(--primary) from the active theme. */
  accent?: string
  label?: string
}

export function CRMSpinner({ size = 48, accent, label }: CRMSpinnerProps) {
  // When accent is provided use it; otherwise fall back to the CSS theme variable
  const color = accent || 'var(--primary)'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      {/* Spinning CRM "C" logo mark */}
      <div
        style={{
          width: size,
          height: size,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: 'crm-logo-spin 1.1s linear infinite',
        }}
      >
        {/* color prop makes currentColor resolve to the accent / theme primary */}
        <svg
          width={size}
          height={size}
          viewBox="636 179 210 236"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ color }}
        >
          {/* Top-right arc */}
          <path
            d="M844.43 261.832H779.18C755.828 216.83 734.222 211.243 701.93 203.707C772.712 179.963 811.637 198.438 844.43 261.832Z"
            fill="currentColor"
          />
          {/* Bottom-right arc */}
          <path
            d="M844.751 331.75H779.501C756.149 376.752 734.544 382.339 702.251 389.875C773.033 413.619 811.958 395.144 844.751 331.75Z"
            fill="currentColor"
          />
          {/* Left inner – bottom half */}
          <path
            d="M717.251 343.75H653.876C640.958 306.982 638.694 286.451 653.876 250H717.251C686.137 285.835 688.238 310.491 717.251 343.75Z"
            fill="currentColor"
          />
          {/* Left inner – top half */}
          <path
            d="M716.93 249.832H653.555C640.636 286.6 638.372 307.131 653.555 343.582H716.93C685.816 307.747 687.917 283.091 716.93 249.832Z"
            fill="currentColor"
          />
        </svg>
      </div>

      {label && (
        <p
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--color-text-secondary, #5F5E5A)',
            margin: 0,
            letterSpacing: '0.01em',
          }}
        >
          {label}
        </p>
      )}

      <style>{`
        @keyframes crm-logo-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          @keyframes crm-logo-spin {
            from { transform: none; }
            to   { transform: none; }
          }
        }
      `}</style>
    </div>
  )
}

export default CRMSpinner
