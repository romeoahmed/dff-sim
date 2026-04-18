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

struct FSIn {
  @location(0) color: vec4<f32>,
  @location(1) edgeDist: f32,
  @location(2) age: f32,
  @location(3) dashDist: f32,
  @location(4) @interpolate(flat) dashPattern: u32,
};

@fragment
fn fs_main(in: FSIn) -> @location(0) vec4<f32> {
  let edgeAlpha = 1.0 - smoothstep(0.7, 1.0, abs(in.edgeDist));
  let ageFade = mix(0.2, 1.0, in.age);
  let dashA = dashAlpha(in.dashPattern, in.dashDist);
  return vec4<f32>(in.color.rgb * ageFade, in.color.a * edgeAlpha * ageFade * dashA);
}
