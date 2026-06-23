export function EmptyCartAnim() {
  return (
    <div className="empty-cart-anim">
      <svg viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg" width="160" height="160">
        {/* Cart body */}
        <path
          className="cart-svg-body"
          d="M28 52 L34 112 Q35 122 45 122 L115 122 Q125 122 126 112 L132 52 Z"
          stroke="var(--primary)" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round"
        />
        {/* Cart handle */}
        <path
          className="cart-svg-handle"
          d="M52 52 Q52 30 80 30 Q108 30 108 52"
          stroke="var(--primary)" strokeWidth="5.5" strokeLinecap="round"
        />
        {/* Face group */}
        <g className="cart-svg-face">
          {/* Left eye */}
          <circle cx="63" cy="82" r="4.5" fill="var(--primary)" opacity="0.72" />
          {/* Right eye */}
          <circle cx="97" cy="82" r="4.5" fill="var(--primary)" opacity="0.72" />
          {/* Sad mouth */}
          <path
            d="M64 104 Q80 95 96 104"
            stroke="var(--primary)" strokeWidth="4" strokeLinecap="round" fill="none" opacity="0.72"
          />
        </g>
        {/* Decorative sparkles around bag */}
        <circle cx="20" cy="42" r="3" fill="var(--accent)" opacity="0.6" style={{ animation: 'sparkle 2s 0.3s ease infinite' }} />
        <circle cx="140" cy="58" r="2.5" fill="var(--accent)" opacity="0.5" style={{ animation: 'sparkle 2s 0.9s ease infinite' }} />
        <circle cx="26" cy="90" r="2" fill="var(--primary-light)" opacity="0.5" style={{ animation: 'sparkle 2s 1.5s ease infinite' }} />
      </svg>
    </div>
  );
}
