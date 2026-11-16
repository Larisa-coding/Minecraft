import { AIR, getBlockDef, isReplaceable } from '../blocks/registry';
import type { Body } from '../player/physics';
import type { RayHit } from './raycast';

export interface BlockPos {
  x: number;
  y: number;
  z: number;
}

export const targetCell = (hit: RayHit, getBlock: (x: number, y: number, z: number) => number): BlockPos => {
  const id = getBlock(hit.x, hit.y, hit.z);
  if (isReplaceable(id) && id !== AIR) return { x: hit.x, y: hit.y, z: hit.z };
  return { x: hit.x + hit.nx, y: hit.y + hit.ny, z: hit.z + hit.nz };
};

export const intersectsBody = (body: Body, x: number, y: number, z: number, shape: 'cube' | 'slab'): boolean => {
  const minX = body.x - body.width / 2 + 0.01;
  const maxX = body.x + body.width / 2 - 0.01;
  const minY = body.y + 0.01;
  const maxY = body.y + body.height - 0.01;
  const minZ = body.z - body.width / 2 + 0.01;
  const maxZ = body.z + body.width / 2 - 0.01;
  const top = shape === 'slab' ? y + 0.5 : y + 1;
  return minX < x + 1 && maxX > x && minY < top && maxY > y && minZ < z + 1 && maxZ > z;
};

export const canPlaceAt = (
  x: number,
  y: number,
  z: number,
  placeId: number,
  getBlock: (x: number, y: number, z: number) => number,
  body: Body,
  maxY: number,
): boolean => {
  if (y <= 0 || y >= maxY) return false;
  const def = getBlockDef(placeId);
  if (!def?.placeable) return false;
  const existing = getBlock(x, y, z);
  if (!isReplaceable(existing)) return false;
  if (def.shape === 'cross' || !def.collidable) return true;
  return !intersectsBody(body, x, y, z, def.shape === 'slab' ? 'slab' : 'cube');
};

export const axisLine = (from: BlockPos, to: BlockPos, limit = 24): BlockPos[] => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  const changed = Number(dx !== 0) + Number(dy !== 0) + Number(dz !== 0);
  if (changed !== 1) return [to];
  const n = Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz));
  if (n > limit) return [to];
  const out: BlockPos[] = [];
  for (let i = 1; i <= n; i += 1) {
    out.push({
      x: from.x + Math.sign(dx) * i,
      y: from.y + Math.sign(dy) * i,
      z: from.z + Math.sign(dz) * i,
    });
  }
  return out;
};

export const isBreakable = (_x: number, y: number, _z: number, id: number): boolean => {
  if (y <= 0) return false;
  if (id === AIR) return false;
  const def = getBlockDef(id);
  return !!def && def.hardness > 0;
};
