export function SchematicGrid() {
  return (
    <>
      <defs>
        <pattern id="pcb-grid" width={20} height={20} patternUnits="userSpaceOnUse">
          <circle cx={0} cy={0} r={0.75} fill="var(--color-border-strong)" opacity={0.5} />
        </pattern>
        <filter id="wire-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation={2.5} />
        </filter>
      </defs>
      <rect width="100%" height="100%" fill="url(#pcb-grid)" />
    </>
  );
}
