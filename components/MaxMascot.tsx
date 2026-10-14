// MAX, the tutor: a round violet friend with a pencil antenna and ruler ticks.
export function MaxMascot({ size = 48, wave = false, className = "" }: { size?: number; wave?: boolean; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 -5 64 69"
      role="img"
      aria-label="MAX"
      className={`${wave ? "max-wave" : ""} ${className}`}
    >
      {/* pencil antenna */}
      <g transform="rotate(18 32 14)">
        <rect x="29.5" y="2" width="5" height="13" rx="1" fill="#ffc93c" />
        <path d="M29.5 2 L32 -3 L34.5 2 Z" fill="#1f2347" />
        <rect x="29.5" y="13" width="5" height="3" fill="#ff6f59" />
      </g>
      {/* head */}
      <rect x="8" y="14" width="48" height="44" rx="20" fill="#5a47d6" />
      {/* ruler ticks on the side */}
      <g stroke="#ecE9ff" strokeWidth="1.6" strokeLinecap="round" opacity="0.7">
        <line x1="12" y1="30" x2="16" y2="30" />
        <line x1="12" y1="35" x2="14.5" y2="35" />
        <line x1="12" y1="40" x2="16" y2="40" />
        <line x1="12" y1="45" x2="14.5" y2="45" />
      </g>
      {/* face */}
      <rect x="19" y="24" width="32" height="24" rx="11" fill="#ffffff" />
      <circle cx="28" cy="34" r="3.4" fill="#1f2347" />
      <circle cx="42" cy="34" r="3.4" fill="#1f2347" />
      <circle cx="29.2" cy="32.8" r="1.1" fill="#ffffff" />
      <circle cx="43.2" cy="32.8" r="1.1" fill="#ffffff" />
      <path d="M30 41 Q35 45.5 40 41" stroke="#1f2347" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <circle cx="23.5" cy="40" r="2.2" fill="#ff6f59" opacity="0.45" />
      <circle cx="46.5" cy="40" r="2.2" fill="#ff6f59" opacity="0.45" />
    </svg>
  );
}
