struct Uniforms {
  canvasSize: vec2<f32>,
  threshold: f32,
  yHigh: f32,
  yLow: f32,
  lineWidth: f32,
  writePointer: u32,
  bufferLength: u32,
  channelCount: u32,
};

struct ChannelConfig {
  color: vec4<f32>,
  yOffset: f32,
  _pad: vec3<f32>,
};

@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var<storage, read> samples: array<f32>;
@group(0) @binding(2) var<storage, read> channels: array<ChannelConfig>;

struct VSOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) color: vec4<f32>,
  @location(1) edgeDist: f32,
};

fn readSample(channel: u32, i: u32) -> f32 {
  let idx = (u.writePointer + i) & (u.bufferLength - 1u);
  return samples[channel * u.bufferLength + idx];
}

@vertex
fn vs_main(
  @builtin(vertex_index) vid: u32,
  @builtin(instance_index) iid: u32,
) -> VSOut {
  let sampleIdx = vid / 2u;
  let side = f32(vid & 1u) * 2.0 - 1.0;
  let ch = channels[iid];

  let v = readSample(iid, sampleIdx);
  let yLocal = select(u.yLow, u.yHigh, v > u.threshold);
  let y = ch.yOffset + yLocal;

  let stepX = u.canvasSize.x / f32(u.bufferLength - 1u);
  let x = f32(sampleIdx) * stepX;

  let offsetY = side * u.lineWidth * 0.5;

  let screenX = x / u.canvasSize.x * 2.0 - 1.0;
  let screenY = 1.0 - (y + offsetY) / u.canvasSize.y * 2.0;

  var out: VSOut;
  out.pos = vec4<f32>(screenX, screenY, 0.0, 1.0);
  out.color = ch.color;
  out.edgeDist = side;
  return out;
}

@fragment
fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let alpha = 1.0 - smoothstep(0.7, 1.0, abs(in.edgeDist));
  return vec4<f32>(in.color.rgb, in.color.a * alpha);
}
