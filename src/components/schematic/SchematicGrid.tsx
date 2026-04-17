export function SchematicGrid() {
  return (
    <>
      <defs>
        <pattern id="pcb-grid" width={24} height={24} patternUnits="userSpaceOnUse">
          <path
            d="M 24 0 L 0 0 0 24"
            fill="none"
            stroke="var(--color-surface0)"
            strokeWidth={0.5}
          />
          <circle cx={0} cy={0} r={0.8} fill="var(--color-overlay0)" opacity={0.35} />
        </pattern>
        <filter id="wire-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation={2.5} />
        </filter>
      </defs>
      <rect width="100%" height="100%" fill="url(#pcb-grid)" />
    </>
  );
}
