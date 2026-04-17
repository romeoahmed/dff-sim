import digital from "./digital.wgsl?raw";
import waveformVert from "./waveform.vert.wgsl?raw";
import waveformClean from "./waveform-clean.frag.wgsl?raw";
import waveformGlow from "./waveform-glow.frag.wgsl?raw";
import waveformPhosphor from "./waveform-phosphor.frag.wgsl?raw";

export type ShaderStyle = "clean" | "glow" | "phosphor";

export const shaders = {
  digital,
  waveformClean,
  waveformGlow,
  waveformPhosphor,
  waveformVert,
} as const;
