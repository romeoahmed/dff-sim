import { AlertTriangle } from "lucide-react";

export function WebGPUUnavailable() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas text-fg p-8">
      <div className="max-w-xl text-center space-y-5">
        <AlertTriangle size={56} strokeWidth={1.25} className="mx-auto text-danger" aria-hidden />
        <h1
          className="text-display text-fg"
          style={{ fontSize: 40, lineHeight: 1.1, letterSpacing: -0.2 }}
        >
          WebGPU Required
        </h1>
        <p className="text-[17px] text-body text-fg-muted max-w-prose mx-auto">
          This simulation renders analog waveforms through WebGPU, which is not available in your
          browser.
        </p>
        <p className="text-[14px] text-caption text-fg-subtle">
          Please use Chrome / Edge 113+, Firefox 141+, or Safari 26+.
        </p>
        <div className="pt-2">
          <a
            href="https://caniuse.com/webgpu"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center h-9 px-5 rounded-full border border-border-strong text-accent text-[14px] hover:bg-panel-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
          >
            Check browser support →
          </a>
        </div>
      </div>
    </div>
  );
}
