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
  dashPattern: u32,
  _pad: vec2<f32>,
};

@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var<storage, read> samples: array<f32>;
@group(0) @binding(2) var<storage, read> channels: array<ChannelConfig>;

struct VSOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) color: vec4<f32>,
  @location(1) edgeDist: f32,
  @location(2) dashDist: f32,
  @location(3) @interpolate(flat) dashPattern: u32,
};

fn readSample(channel: u32, i: u32) -> f32 {
  let idx = (u.writePointer + i) & (u.bufferLength - 1u);
  return samples[channel * u.bufferLength + idx];
}

fn dashAlpha(pattern: u32, dist: f32) -> f32 {
  let cycle = 24.0;
  let t = fract(dist / cycle);
  switch pattern {
    case 0u: { return 1.0; }
    case 1u: { return select(0.0, 1.0, t < 0.6); }
    case 2u: { return select(0.0, 1.0, t < 0.18); }
    case 3u: {
      let a = t < 0.5 && t > 0.1;
      let b = t < 0.85 && t > 0.7;
      return select(0.0, 1.0, a || b);
    }
    default: { return 1.0; }
  }
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
  out.dashDist = x;
  out.dashPattern = ch.dashPattern;
  return out;
}

@fragment
fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let alpha = 1.0 - smoothstep(0.7, 1.0, abs(in.edgeDist));
  let dashA = dashAlpha(in.dashPattern, in.dashDist);
  return vec4<f32>(in.color.rgb, in.color.a * alpha * dashA);
}
