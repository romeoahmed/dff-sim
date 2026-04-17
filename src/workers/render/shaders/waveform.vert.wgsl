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
  @location(2) age: f32,
  @location(3) dashDist: f32,
  @location(4) @interpolate(flat) dashPattern: u32,
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
  let side = f32(vid & 1u) * 2.0 - 1.0;
  let ch = channels[iid];

  let curV = readSample(iid, sampleIdx);

  let stepX = u.canvasSize.x / f32(u.bufferLength - 1u);
  let x = f32(sampleIdx) * stepX;
  let y = voltageToY(curV, ch.yOffset);

  let isLast = sampleIdx >= u.bufferLength - 1u;
  let refIdx = select(sampleIdx + 1u, sampleIdx - 1u, isLast);
  let refSign = select(1.0, -1.0, isLast);
  let refV = readSample(iid, refIdx);
  let refX = f32(refIdx) * stepX;
  let refY = voltageToY(refV, ch.yOffset);

  let dx = (refX - x) * refSign;
  let dy = (refY - y) * refSign;
  let len = max(sqrt(dx * dx + dy * dy), 0.001);
  let nx = -dy / len;
  let ny = dx / len;

  let offsetX = nx * side * u.lineWidth * 0.5;
  let offsetY = ny * side * u.lineWidth * 0.5;

  let screenX = (x + offsetX) / u.canvasSize.x * 2.0 - 1.0;
  let screenY = 1.0 - (y + offsetY) / u.canvasSize.y * 2.0;

  var out: VSOut;
  out.pos = vec4<f32>(screenX, screenY, 0.0, 1.0);
  out.color = ch.color;
  out.edgeDist = side;
  out.age = f32(u.bufferLength - sampleIdx) / f32(u.bufferLength);
  out.dashDist = x;
  out.dashPattern = ch.dashPattern;
  return out;
}
