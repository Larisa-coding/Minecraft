import * as THREE from 'three';
import { getBlockDef } from '../blocks/registry';

export interface Mob {
  id: number;
  x: number;
  y: number;
  z: number;
  health: number;
  cooldown: number;
  hurt: number;
}

export const ZOMBIE_HEALTH = 12;

export const isNight = (time: number): boolean => Math.sin(time * Math.PI * 2) < 0.05;

export const weaponDamage = (id: number): number => {
  const damage = getBlockDef(id)?.damage ?? 0;
  return damage > 0 ? damage : 1;
};

export const swingTime = (id: number): number => {
  const damage = weaponDamage(id);
  if (damage >= 7) return 0.34;
  if (damage >= 5) return 0.4;
  if (damage >= 4) return 0.46;
  return 0.5;
};

export const pickMob = (
  mobs: Mob[],
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  reach: number,
): { mob: Mob; distance: number } | null => {
  let best: { mob: Mob; distance: number } | null = null;
  for (const mob of mobs) {
    if (mob.health <= 0) continue;
    const cx = mob.x;
    const cy = mob.y + 0.95;
    const cz = mob.z;
    const vx = cx - ox;
    const vy = cy - oy;
    const vz = cz - oz;
    const along = vx * dx + vy * dy + vz * dz;
    if (along < 0.4 || along > reach) continue;
    const miss = Math.hypot(ox + dx * along - cx, oy + dy * along - cy, oz + dz * along - cz);
    if (miss > 1.15) continue;
    if (!best || along < best.distance) best = { mob, distance: along };
  }
  return best;
};

export const stepMobs = (
  mobs: Mob[],
  dt: number,
  player: { x: number; y: number; z: number },
  solid: (x: number, y: number, z: number) => boolean,
  night: boolean,
): number => {
  let damage = 0;
  for (const mob of mobs) {
    if (mob.health <= 0) continue;
    mob.hurt = Math.max(0, mob.hurt - dt);
    mob.cooldown = Math.max(0, mob.cooldown - dt);
    if (!night && !solid(Math.floor(mob.x), Math.floor(mob.y + 2), Math.floor(mob.z))) mob.health -= dt * 2.4;
    const dx = player.x - mob.x;
    const dz = player.z - mob.z;
    const dist = Math.hypot(dx, dz) || 1;
    if (dist > 1.2 && mob.health > 0) {
      const nx = mob.x + (dx / dist) * 1.65 * dt;
      const nz = mob.z + (dz / dist) * 1.65 * dt;
      const fx = Math.floor(nx);
      const fz = Math.floor(nz);
      const fy = Math.floor(mob.y + 0.01);
      const low = solid(fx, fy, fz);
      const high = solid(fx, fy + 1, fz);
      if (!low && !high) {
        mob.x = nx;
        mob.z = nz;
      } else if (low && !solid(fx, fy + 1, fz) && !solid(fx, fy + 2, fz)) {
        mob.y += 1;
        mob.x = nx;
        mob.z = nz;
      }
    }
    const under = Math.floor(mob.y - 0.08);
    if (!solid(Math.floor(mob.x), under, Math.floor(mob.z))) mob.y = Math.max(1, mob.y - 12 * dt);
    const close = Math.hypot(player.x - mob.x, player.z - mob.z) < 1.35 && Math.abs(player.y - mob.y) < 2.1;
    if (close && mob.cooldown <= 0 && mob.health > 0) {
      damage += 3;
      mob.cooldown = 0.95;
    }
  }
  return damage;
};

const limb = (w: number, h: number, d: number, color: number, x: number, y: number, z: number) => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color }));
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.userData.base = color;
  return mesh;
};

export const makeZombieMesh = (): THREE.Group => {
  const group = new THREE.Group();
  group.add(limb(0.22, 0.55, 0.22, 0x3d4a38, -0.12, 0.28, 0));
  group.add(limb(0.22, 0.55, 0.22, 0x3d4a38, 0.12, 0.28, 0));
  group.add(limb(0.5, 0.62, 0.28, 0x4e6244, 0, 0.86, 0));
  group.add(limb(0.16, 0.55, 0.16, 0x6d8a58, -0.34, 0.9, 0.08));
  group.add(limb(0.16, 0.55, 0.16, 0x6d8a58, 0.34, 0.9, 0.08));
  group.add(limb(0.38, 0.38, 0.38, 0x7d9a68, 0, 1.38, 0));
  return group;
};

export const poseZombie = (group: THREE.Group, mob: Mob, playerX: number, playerZ: number): void => {
  group.position.set(mob.x, mob.y, mob.z);
  group.rotation.y = Math.atan2(playerX - mob.x, playerZ - mob.z);
  const hurt = mob.hurt > 0;
  group.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh) || !(obj.material instanceof THREE.MeshLambertMaterial)) return;
    const base = typeof obj.userData.base === 'number' ? obj.userData.base : 0x6d8a58;
    obj.material.color.setHex(hurt ? 0xc45a4a : base);
  });
};
