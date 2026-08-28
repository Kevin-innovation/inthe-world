import type { Rng } from "./types";

export function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

export function seedFrom(saveId: string, seasonId: string): number {
  const s = `${saveId}:${seasonId}`;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function createRng(seed: number, cursor = 0): Rng {
  const gen = mulberry32(seed);
  for (let i = 0; i < cursor; i++) {
    gen();
  }
  return { next: gen };
}
