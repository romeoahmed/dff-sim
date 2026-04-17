import type { RngFn } from "@/lib/types";

export function createGaussianSampler(rng: RngFn): () => number {
  let cache: number | null = null;
  return function sample(): number {
    if (cache !== null) {
      const cached = cache;
      cache = null;
      return cached;
    }
    let u: number;
    let v: number;
    let s: number;
    do {
      u = rng() * 2 - 1;
      v = rng() * 2 - 1;
      s = u * u + v * v;
    } while (s >= 1 || s === 0);
    const mul = Math.sqrt((-2.0 * Math.log(s)) / s);
    cache = v * mul;
    return u * mul;
  };
}
