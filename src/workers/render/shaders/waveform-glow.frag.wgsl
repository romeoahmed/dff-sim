struct FSIn {
  @location(0) color: vec4<f32>,
  @location(1) edgeDist: f32,
  @location(2) age: f32,
};

@fragment
fn fs_main(in: FSIn) -> @location(0) vec4<f32> {
  let d = abs(in.edgeDist);
  let core = smoothstep(1.0, 0.3, d);
  let halo = exp(-d * d * 2.0);
  let intensity = core + halo * 0.6;
  return vec4<f32>(in.color.rgb * intensity, in.color.a * intensity);
}
