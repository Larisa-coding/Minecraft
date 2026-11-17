export const hash2 = (x: number, z: number, seed: number): number => {
  let n = Math.imul(x | 0, 374761393) ^ Math.imul(z | 0, 668265263) ^ Math.imul(seed | 0, 1442695041);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
};

export const hash3 = (x: number, y: number, z: number, seed: number): number => {
  let n =
    Math.imul(x | 0, 374761393) ^
    Math.imul(y | 0, 668265263) ^
    Math.imul(z | 0, 1274126177) ^
    Math.imul(seed | 0, 1442695041);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
};

export const hashSeed = (text: string): number => {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

export const checksumString = (text: string): string => {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
};

const smooth = (t: number): number => t * t * t * (t * (t * 6 - 15) + 10);

export const valueNoise2 = (x: number, z: number, seed: number): number => {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const tx = smooth(x - x0);
  const tz = smooth(z - z0);
  const v00 = hash2(x0, z0, seed);
  const v10 = hash2(x0 + 1, z0, seed);
  const v01 = hash2(x0, z0 + 1, seed);
  const v11 = hash2(x0 + 1, z0 + 1, seed);
  const a = v00 + (v10 - v00) * tx;
  const b = v01 + (v11 - v01) * tx;
  return a + (b - a) * tz;
};

export const valueNoise3 = (x: number, y: number, z: number, seed: number): number => {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const z0 = Math.floor(z);
  const tx = smooth(x - x0);
  const ty = smooth(y - y0);
  const tz = smooth(z - z0);
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const v000 = hash3(x0, y0, z0, seed);
  const v100 = hash3(x0 + 1, y0, z0, seed);
  const v010 = hash3(x0, y0 + 1, z0, seed);
  const v110 = hash3(x0 + 1, y0 + 1, z0, seed);
  const v001 = hash3(x0, y0, z0 + 1, seed);
  const v101 = hash3(x0 + 1, y0, z0 + 1, seed);
  const v011 = hash3(x0, y0 + 1, z0 + 1, seed);
  const v111 = hash3(x0 + 1, y0 + 1, z0 + 1, seed);
  const x00 = lerp(v000, v100, tx);
  const x10 = lerp(v010, v110, tx);
  const x01 = lerp(v001, v101, tx);
  const x11 = lerp(v011, v111, tx);
  return lerp(lerp(x00, x10, ty), lerp(x01, x11, ty), tz);
};

export const fbm2 = (x: number, z: number, seed: number, octaves: number): number => {
  let amp = 1;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i += 1) {
    sum += valueNoise2(x * freq, z * freq, seed + i * 101) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
};

export const fbm3 = (x: number, y: number, z: number, seed: number, octaves: number): number => {
  let amp = 1;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i += 1) {
    sum += valueNoise3(x * freq, y * freq, z * freq, seed + i * 131) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
};

export const clamp = (v: number, min: number, max: number): number => Math.max(min, Math.min(max, v));
