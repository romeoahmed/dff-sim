struct Uniforms {
  canvasSize: vec2<f32>,
  scaleY: f32,
  voltageHeadroom: f32,
  lineWidth: f32,
  writePointer: u32,
  bufferLength: u32,
  channelCount: u32,
};

struct ChannelConfig {
  yOffset: f32,
  color: vec4<f32>,
};

@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var<storage, read> samples: array<f32>;
@group(0) @binding(2) var<storage, read> channels: array<ChannelConfig>;

struct VSOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) color: vec4<f32>,
  @location(1) edgeDist: f32,
  @location(2) age: f32,
};

fn readSample(channel: u32, i: u32) -> f32 {
  let idx = (u.writePointer + i) & (u.bufferLength - 1u);
  return samples[channel * u.bufferLength + idx];
}

fn voltageToY(v: f32, yOffset: f32) -> f32 {
  let baseY = yOffset + u.voltageHeadroom * u.scaleY;
  return baseY - v * u.scaleY;
}

@vertex
fn vs_main(
  @builtin(vertex_index) vid: u32,
  @builtin(instance_index) iid: u32,
) -> VSOut {
  let sampleIdx = vid / 2u;
  let side = f32(vid & 1u) * 2.0 - 1.0; // +1 or -1
  let ch = channels[iid];

  // Read current and neighbor sample for direction
  let curV = readSample(iid, sampleIdx);
  let nextIdx = min(sampleIdx + 1u, u.bufferLength - 1u);
  let nextV = readSample(iid, nextIdx);

  let stepX = u.canvasSize.x / f32(u.bufferLength - 1u);
  let x = f32(sampleIdx) * stepX;
  let y = voltageToY(curV, ch.yOffset);

  let nextX = f32(nextIdx) * stepX;
  let nextY = voltageToY(nextV, ch.yOffset);

  let dx = nextX - x;
  let dy = nextY - y;
  let len = max(sqrt(dx * dx + dy * dy), 0.001);
  // Normal (perpendicular): (-dy, dx) normalized
  let nx = -dy / len;
  let ny = dx / len;

  let offsetX = nx * side * u.lineWidth * 0.5;
  let offsetY = ny * side * u.lineWidth * 0.5;

  let screenX = (x + offsetX) / u.canvasSize.x * 2.0 - 1.0;
  let screenY = 1.0 - (y + offsetY) / u.canvasSize.y * 2.0;

  var out: VSOut;
  out.pos = vec4<f32>(screenX, screenY, 0.0, 1.0);
  out.color = ch.color;
  out.edgeDist = side; // -1 at one edge, +1 at the other
  out.age = f32(u.bufferLength - sampleIdx) / f32(u.bufferLength);
  return out;
}
