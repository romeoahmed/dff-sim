import { AlertTriangle } from "lucide-react";

export function WebGPUUnavailable() {
  return (
    <div className="h-screen flex items-center justify-center bg-base text-text p-8">
      <div className="max-w-xl text-center space-y-4">
        <AlertTriangle size={48} className="mx-auto text-yellow" />
        <h1 className="text-2xl font-bold">WebGPU Required</h1>
        <p className="text-subtext0">
          This simulation requires WebGPU, which is not available in your browser.
        </p>
        <p className="text-subtext0 text-sm">
          Please use Chrome/Edge 113+, Firefox 141+, or Safari 26+.
        </p>
      </div>
    </div>
  );
}
