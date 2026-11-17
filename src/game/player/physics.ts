import { getBlockDef } from '../blocks/registry';

export interface Aabb {
  minX: number;
  minY: number;
  minZ: number;
  maxX: number;
  maxY: number;
  maxZ: number;
}

export interface Body {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  onGround: boolean;
  width: number;
  height: number;
  flying: boolean;
}

export interface CollisionQuery {
  boxesAt: (x: number, y: number, z: number) => Aabb[];
}

const EPS = 0.001;

const overlaps = (a0: number, a1: number, b0: number, b1: number) => a0 < b1 - 1e-5 && a1 > b0 + 1e-5;

export const collisionBoxes = (id: number, x: number, y: number, z: number): Aabb[] => {
  const def = getBlockDef(id);
  if (!def?.collidable) return [];
  if (def.shape === 'slab') return [{ minX: x, minY: y, minZ: z, maxX: x + 1, maxY: y + 0.5, maxZ: z + 1 }];
  if (def.shape !== 'cube') return [];
  return [{ minX: x, minY: y, minZ: z, maxX: x + 1, maxY: y + 1, maxZ: z + 1 }];
};

export const bodyAabb = (body: Body): Aabb => ({
  minX: body.x - body.width / 2,
  maxX: body.x + body.width / 2,
  minY: body.y,
  maxY: body.y + body.height,
  minZ: body.z - body.width / 2,
  maxZ: body.z + body.width / 2,
});

export const overlapsSolids = (body: Body, world: CollisionQuery): boolean => {
  const box = bodyAabb(body);
  const x0 = Math.floor(box.minX);
  const x1 = Math.floor(box.maxX);
  const y0 = Math.floor(box.minY);
  const y1 = Math.floor(box.maxY);
  const z0 = Math.floor(box.minZ);
  const z1 = Math.floor(box.maxZ);
  for (let y = y0; y <= y1; y += 1) {
    for (let z = z0; z <= z1; z += 1) {
      for (let x = x0; x <= x1; x += 1) {
        for (const solid of world.boxesAt(x, y, z)) {
          if (
            overlaps(box.minX, box.maxX, solid.minX, solid.maxX) &&
            overlaps(box.minY, box.maxY, solid.minY, solid.maxY) &&
            overlaps(box.minZ, box.maxZ, solid.minZ, solid.maxZ)
          ) return true;
        }
      }
    }
  }
  return false;
};

export const moveAxis = (body: Body, axis: 'x' | 'y' | 'z', delta: number, world: CollisionQuery): boolean => {
  if (Math.abs(delta) < 1e-8) return false;
  const box = bodyAabb(body);
  const x0 = Math.floor((axis === 'x' ? Math.min(box.minX, box.minX + delta) : box.minX) - 1);
  const x1 = Math.floor((axis === 'x' ? Math.max(box.maxX, box.maxX + delta) : box.maxX) + 1);
  const y0 = Math.floor((axis === 'y' ? Math.min(box.minY, box.minY + delta) : box.minY) - 1);
  const y1 = Math.floor((axis === 'y' ? Math.max(box.maxY, box.maxY + delta) : box.maxY) + 1);
  const z0 = Math.floor((axis === 'z' ? Math.min(box.minZ, box.minZ + delta) : box.minZ) - 1);
  const z1 = Math.floor((axis === 'z' ? Math.max(box.maxZ, box.maxZ + delta) : box.maxZ) + 1);
  let allowed = delta;
  let hit = false;
  for (let y = y0; y <= y1; y += 1) {
    for (let z = z0; z <= z1; z += 1) {
      for (let x = x0; x <= x1; x += 1) {
        for (const solid of world.boxesAt(x, y, z)) {
          if (axis === 'x') {
            if (!overlaps(box.minY, box.maxY, solid.minY, solid.maxY) || !overlaps(box.minZ, box.maxZ, solid.minZ, solid.maxZ)) continue;
            if (delta > 0 && box.maxX <= solid.minX + 1e-4) {
              const dist = solid.minX - box.maxX;
              if (dist < allowed) { allowed = dist; hit = true; }
            } else if (delta < 0 && box.minX >= solid.maxX - 1e-4) {
              const dist = solid.maxX - box.minX;
              if (dist > allowed) { allowed = dist; hit = true; }
            }
          } else if (axis === 'y') {
            if (!overlaps(box.minX, box.maxX, solid.minX, solid.maxX) || !overlaps(box.minZ, box.maxZ, solid.minZ, solid.maxZ)) continue;
            if (delta > 0 && box.maxY <= solid.minY + 1e-4) {
              const dist = solid.minY - box.maxY;
              if (dist < allowed) { allowed = dist; hit = true; }
            } else if (delta < 0 && box.minY >= solid.maxY - 1e-4) {
              const dist = solid.maxY - box.minY;
              if (dist > allowed) { allowed = dist; hit = true; }
            }
          } else {
            if (!overlaps(box.minX, box.maxX, solid.minX, solid.maxX) || !overlaps(box.minY, box.maxY, solid.minY, solid.maxY)) continue;
            if (delta > 0 && box.maxZ <= solid.minZ + 1e-4) {
              const dist = solid.minZ - box.maxZ;
              if (dist < allowed) { allowed = dist; hit = true; }
            } else if (delta < 0 && box.minZ >= solid.maxZ - 1e-4) {
              const dist = solid.maxZ - box.minZ;
              if (dist > allowed) { allowed = dist; hit = true; }
            }
          }
        }
      }
    }
  }
  if (hit) allowed = delta > 0 ? Math.max(0, allowed - EPS) : Math.min(0, allowed + EPS);
  if (axis === 'x') body.x += allowed;
  else if (axis === 'y') body.y += allowed;
  else body.z += allowed;
  return hit;
};

const moveHorizontal = (body: Body, axis: 'x' | 'z', delta: number, world: CollisionQuery) => {
  if (!body.onGround || body.flying) {
    moveAxis(body, axis, delta, world);
    return;
  }
  const snap = { x: body.x, y: body.y, z: body.z, vy: body.vy };
  const hit = moveAxis(body, axis, delta, world);
  if (!hit) return;
  body.x = snap.x;
  body.y = snap.y;
  body.z = snap.z;
  moveAxis(body, 'y', 0.56, world);
  const raised = body.y - snap.y;
  if (raised < 0.2) {
    body.x = snap.x;
    body.y = snap.y;
    body.z = snap.z;
    body.vy = snap.vy;
    moveAxis(body, axis, delta, world);
    return;
  }
  const blocked = moveAxis(body, axis, delta, world);
  if (blocked) {
    body.x = snap.x;
    body.y = snap.y;
    body.z = snap.z;
    body.vy = snap.vy;
    moveAxis(body, axis, delta, world);
    return;
  }
  body.onGround = true;
};

export const nudgeOut = (body: Body, world: CollisionQuery): void => {
  if (!overlapsSolids(body, world)) return;
  const origin = { x: body.x, y: body.y, z: body.z };
  for (let step = 1; step <= 8; step += 1) {
    body.y = origin.y + step * 0.25;
    if (!overlapsSolids(body, world)) return;
  }
  body.y = origin.y;
  const shifts: [number, number][] = [[0.45, 0], [-0.45, 0], [0, 0.45], [0, -0.45]];
  for (const [dx, dz] of shifts) {
    body.x = origin.x + dx;
    body.z = origin.z + dz;
    if (!overlapsSolids(body, world)) return;
  }
  body.x = origin.x;
  body.y = origin.y + 1;
  body.z = origin.z;
};

export const GRAVITY = 26;
export const JUMP_SPEED = 8.6;

export const stepBody = (body: Body, dt: number, world: CollisionQuery): void => {
  const safeDt = Math.min(dt, 0.05);
  if (!body.flying) body.vy = Math.max(-42, body.vy - GRAVITY * safeDt);
  const speed = Math.abs(body.vx) + Math.abs(body.vy) + Math.abs(body.vz);
  const steps = Math.min(6, Math.max(1, Math.ceil((speed * safeDt) / 0.35)));
  const h = safeDt / steps;
  for (let i = 0; i < steps; i += 1) {
    const hitY = moveAxis(body, 'y', body.vy * h, world);
    if (hitY && body.vy < 0) {
      body.onGround = true;
      body.vy = 0;
    } else if (hitY && body.vy > 0) {
      body.vy = 0;
      body.onGround = false;
    } else if (!body.flying && body.vy < 0 && !hitY) {
      body.onGround = false;
    }
    moveHorizontal(body, 'x', body.vx * h, world);
    moveHorizontal(body, 'z', body.vz * h, world);
  }
};
