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
