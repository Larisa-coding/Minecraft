export interface RayHit {
  x: number;
  y: number;
  z: number;
  nx: number;
  ny: number;
  nz: number;
  distance: number;
}

export const raycastVoxel = (
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  maxDist: number,
  getBlock: (x: number, y: number, z: number) => number,
  canHit: (id: number) => boolean,
  minDist = 0,
): RayHit | null => {
  const len = Math.hypot(dx, dy, dz) || 1;
  const dirX = dx / len;
  const dirY = dy / len;
  const dirZ = dz / len;
  let x = Math.floor(ox);
  let y = Math.floor(oy);
  let z = Math.floor(oz);
  const stepX = dirX > 0 ? 1 : dirX < 0 ? -1 : 0;
  const stepY = dirY > 0 ? 1 : dirY < 0 ? -1 : 0;
  const stepZ = dirZ > 0 ? 1 : dirZ < 0 ? -1 : 0;
  const tDeltaX = stepX === 0 ? Infinity : Math.abs(1 / dirX);
  const tDeltaY = stepY === 0 ? Infinity : Math.abs(1 / dirY);
  const tDeltaZ = stepZ === 0 ? Infinity : Math.abs(1 / dirZ);
  const frac = (value: number) => value - Math.floor(value);
  let tMaxX = stepX > 0 ? (1 - frac(ox)) * tDeltaX : stepX < 0 ? frac(ox) * tDeltaX : Infinity;
  let tMaxY = stepY > 0 ? (1 - frac(oy)) * tDeltaY : stepY < 0 ? frac(oy) * tDeltaY : Infinity;
  let tMaxZ = stepZ > 0 ? (1 - frac(oz)) * tDeltaZ : stepZ < 0 ? frac(oz) * tDeltaZ : Infinity;
  let nx = 0;
  let ny = 0;
  let nz = 0;
  let dist = 0;
  for (let i = 0; i < 256; i += 1) {
    const id = getBlock(x, y, z);
    if (i > 0 && dist >= minDist && canHit(id)) return { x, y, z, nx, ny, nz, distance: dist };
    if (tMaxX < tMaxY && tMaxX < tMaxZ) {
      if (tMaxX > maxDist) return null;
      x += stepX;
      dist = tMaxX;
      tMaxX += tDeltaX;
      nx = -stepX;
      ny = 0;
      nz = 0;
    } else if (tMaxY < tMaxZ) {
      if (tMaxY > maxDist) return null;
      y += stepY;
      dist = tMaxY;
      tMaxY += tDeltaY;
      nx = 0;
      ny = -stepY;
      nz = 0;
    } else {
      if (tMaxZ > maxDist) return null;
      z += stepZ;
      dist = tMaxZ;
      tMaxZ += tDeltaZ;
      nx = 0;
      ny = 0;
      nz = -stepZ;
    }
  }
  return null;
};

export const REACH = 6;
