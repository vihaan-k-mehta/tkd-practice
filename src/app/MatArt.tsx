// Original illustration of a dojang mat with a heavy bag, used as the session card image.
export function MatArt() {
  return (
    <svg viewBox="0 0 400 225" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Illustrated training mat with a heavy bag">
      <rect width="400" height="225" fill="#D9E4F2" />
      <rect y="150" width="400" height="75" fill="#C23B32" />
      <rect y="150" width="400" height="75" fill="#2A5DA8" opacity="0.0" />
      <path d="M0 150 H400" stroke="#241B35" stroke-width="3" />
      <g stroke="#241B35" stroke-width="3">
        <line x1="200" y1="0" x2="200" y2="40" />
        <rect x="178" y="40" width="44" height="100" rx="14" fill="#F4F1EA" />
        <rect x="178" y="40" width="44" height="22" rx="10" fill="#E8473F" />
        <rect x="178" y="118" width="44" height="22" rx="10" fill="#E8473F" />
      </g>
      <g stroke="#241B35" stroke-width="3" fill="#FFD54A">
        <circle cx="70" cy="60" r="16" />
        <circle cx="330" cy="80" r="12" fill="#3E7BE0" />
      </g>
      <rect x="250" y="40" width="0" height="0" rx="7" fill="#F4F1EA" stroke="#241B35" stroke-width="3" />
    </svg>
  );
}
