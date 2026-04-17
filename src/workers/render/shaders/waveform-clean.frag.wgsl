struct FSIn {
  @location(0) color: vec4<f32>,
  @location(1) edgeDist: f32,
  @location(2) age: f32,
};

@fragment
fn fs_main(in: FSIn) -> @location(0) vec4<f32> {
  let alpha = 1.0 - smoothstep(0.7, 1.0, abs(in.edgeDist));
  return vec4<f32>(in.color.rgb, in.color.a * alpha);
}
