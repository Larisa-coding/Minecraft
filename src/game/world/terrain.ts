import { AIR, blockId, getBlockDef, isCollidable, isReplaceable } from '../blocks/registry';
import { clamp, fbm2, fbm3, hash2, hash3 } from '../../utils/hash';
import { CHUNK_SIZE, SEA_LEVEL, WORLD_HEIGHT, blockIndex, type TerrainKind } from './constants';

export type Biome = 'plains' | 'forest' | 'taiga' | 'desert' | 'snow' | 'mountains' | 'beach';

export interface GenParams {
  seed: number;
  terrain: TerrainKind;
  generatorVersion: number;
}

export interface SurfaceInfo {
  ground: number;
  biome: Biome;
  temp: number;
  moist: number;
}

const GRASS = blockId('grass');
const DIRT = blockId('dirt');
const STONE = blockId('stone');
const SAND = blockId('sand');
const GRAVEL = blockId('gravel');
const SNOW = blockId('snow');
const ICE = blockId('ice');
const CLAY = blockId('clay');
const WATER = blockId('water');
const OAK_LOG = blockId('oak_log');
const BIRCH_LOG = blockId('birch_log');
const PINE_LOG = blockId('pine_log');
const OAK_LEAVES = blockId('oak_leaves');
const BIRCH_LEAVES = blockId('birch_leaves');
const PINE_LEAVES = blockId('pine_leaves');
const SANDSTONE = blockId('sandstone');
const DARK = blockId('dark_stone');
const IRON = blockId('iron_ore');
const GOLD = blockId('gold_ore');
const COAL = blockId('coal_ore');
const DIAMOND = blockId('diamond_ore');
const COPPER = blockId('copper_ore');
const TALL = blockId('tall_grass');
const FLOWER = blockId('flower');
const BUSH = blockId('dead_bush');

const salted = (params: GenParams): number => (params.seed + params.generatorVersion * 997) >>> 0;

export const surfaceAt = (x: number, z: number, params: GenParams): SurfaceInfo => {
  const s = salted(params);
  let temp = fbm2(x * 0.003, z * 0.003, s + 201, 4);
  let moist = fbm2(x * 0.0034, z * 0.0034, s + 307, 4);
  const cont = fbm2(x * 0.0026, z * 0.0026, s + 11, 5);
  const detail = fbm2(x * 0.02, z * 0.02, s + 19, 3);
  const ridge = 1 - Math.abs(fbm2(x * 0.007, z * 0.007, s + 53, 4) * 2 - 1);
  const basin = fbm2(x * 0.018, z * 0.018, s + 70, 3);

  if (params.terrain === 'desert') {
    temp = clamp(temp * 0.35 + 0.66, 0, 1);
    moist *= 0.22;
  } else if (params.terrain === 'forest') {
    moist = clamp(moist * 0.45 + 0.5, 0, 1);
    temp = clamp(temp * 0.65 + 0.18, 0, 1);
  } else if (params.terrain === 'plains') {
    moist *= 0.42;
    temp = 0.42 + temp * 0.22;
  } else if (params.terrain === 'islands') {
    moist = clamp(moist + 0.08, 0, 1);
  }

  let height = 36 + (cont - 0.5) * 16 + (detail - 0.5) * 6;
  if (params.terrain === 'mountains') height += ridge * ridge * 26 + Math.max(0, cont - 0.4) * 8;
  else if (params.terrain === 'plains') height = 35 + (cont - 0.5) * 6 + (detail - 0.5) * 2;
  else if (params.terrain === 'desert') height = 34 + (cont - 0.5) * 8 + (detail - 0.5) * 2.2;
  else if (params.terrain === 'islands') {
    const island = fbm2(x * 0.012, z * 0.012, s + 91, 4);
    height = island > 0.48 ? 28 + (island - 0.48) * 30 + (detail - 0.5) * 3 : 16 + island * 12;
  } else height += ridge * ridge * 10;
  if (params.terrain !== 'mountains' && params.terrain !== 'desert') height -= Math.max(0, 0.58 - basin) * 36;

  const ground = clamp(Math.round(height), 4, WORLD_HEIGHT - 8);
  let biome: Biome = 'plains';
  if (params.terrain === 'desert') biome = 'desert';
  else if (ground >= 50 || (params.terrain === 'mountains' && ground >= 40)) biome = 'mountains';
  else if (ground <= SEA_LEVEL && ground >= SEA_LEVEL - 2 && temp >= 0.34 && params.terrain !== 'mountains') biome = 'beach';
  else if (temp < 0.34) biome = moist > 0.42 ? 'taiga' : 'snow';
  else if (temp > 0.68 && moist < 0.4) biome = 'desert';
  else if (moist > 0.6) biome = 'forest';
  else if (moist > 0.46 && temp < 0.5) biome = 'taiga';

  if (params.terrain === 'forest' && biome === 'plains') biome = 'forest';
  if (params.terrain === 'plains' && biome === 'forest' && moist < 0.75) biome = 'plains';
  return { ground, biome, temp, moist };
};

const isCave = (x: number, y: number, z: number, seed: number, ground: number): boolean => {
  if (y <= 1 || y > ground - 5) return false;
  const n = fbm3(x * 0.08, y * 0.1, z * 0.08, seed + 777, 2);
  return n > 0.7;
};

const oreAt = (x: number, y: number, z: number, seed: number): number => {
  if (y <= 1) return 0;
  if (y < 14 && hash3(x, y, z, seed + 42) > 0.992) return DIAMOND;
  if (y < 24 && hash3(x, y, z, seed + 43) > 0.988) return GOLD;
  if (y < 40 && hash3(x, y, z, seed + 44) > 0.982) return IRON;
  if (y < 48 && hash3(x, y, z, seed + 45) > 0.984) return COPPER;
  if (y < 60 && hash3(x, y, z, seed + 46) > 0.972) return COAL;
  return 0;
};

const isTreeAnchor = (x: number, z: number, params: GenParams): boolean => {
  if (params.terrain === 'desert') return false;
  const surf = surfaceAt(x, z, params);
  if (surf.ground < SEA_LEVEL || surf.biome === 'desert' || surf.biome === 'beach') return false;
  const cell = surf.biome === 'plains' || surf.biome === 'mountains' ? 8 : 5;
  const gx = Math.floor(x / cell);
  const gz = Math.floor(z / cell);
  const jx = Math.floor(hash2(gx, gz, salted(params) + 601) * cell);
  const jz = Math.floor(hash2(gx, gz, salted(params) + 602) * cell);
  const lx = ((x % cell) + cell) % cell;
  const lz = ((z % cell) + cell) % cell;
  if (lx !== jx || lz !== jz) return false;
  let density = 0.3;
  if (surf.biome === 'forest') density = 0.94;
  else if (surf.biome === 'taiga') density = 0.9;
  else if (surf.biome === 'snow') density = 0.62;
  else if (surf.biome === 'plains') density = 0.42;
  if (params.terrain === 'forest') density = Math.min(1, density + 0.05);
  if (params.terrain === 'plains') density *= 0.65;
  return hash2(gx, gz, salted(params) + 603) < density;
};

const writeTree = (
  x: number,
  ground: number,
  z: number,
  biome: Biome,
  params: GenParams,
  emit: (x: number, y: number, z: number, id: number) => void,
) => {
  const n = hash2(x, z, salted(params) + 702);
  const pine = biome === 'taiga' || biome === 'snow' || biome === 'mountains';
  const birch = !pine && hash2(x, z, salted(params) + 700) > 0.58;
  if (pine) {
    const h = 6 + Math.floor(n * 3);
    for (let i = 1; i <= h; i += 1) emit(x, ground + i, z, PINE_LOG);
    const top = ground + h;
    for (let y = ground + 2; y <= top + 1; y += 1) {
      const distTop = top + 1 - y;
      const rad = distTop <= 0 ? 0 : Math.min(3, Math.ceil(distTop / 1.7));
      for (let lx = -rad; lx <= rad; lx += 1) {
        for (let lz = -rad; lz <= rad; lz += 1) {
          if (lx === 0 && lz === 0 && y <= top) continue;
          if (Math.abs(lx) === rad && Math.abs(lz) === rad && hash3(x + lx, y, z + lz, salted(params)) > 0.62) continue;
          emit(x + lx, y, z + lz, PINE_LEAVES);
        }
      }
    }
    return;
  }
  const h = birch ? 5 + Math.floor(n * 3) : 4 + Math.floor(n * 2);
  const log = birch ? BIRCH_LOG : OAK_LOG;
  const leaf = birch ? BIRCH_LEAVES : OAK_LEAVES;
  for (let i = 1; i <= h; i += 1) emit(x, ground + i, z, log);
  const top = ground + h;
  for (let dy = -2; dy <= 1; dy += 1) {
    const rad = dy === 1 ? 1 : 2;
    for (let lx = -rad; lx <= rad; lx += 1) {
      for (let lz = -rad; lz <= rad; lz += 1) {
        if (lx === 0 && lz === 0 && dy <= 0) continue;
        if (Math.abs(lx) === rad && Math.abs(lz) === rad && hash3(x + lx, dy, z + lz, salted(params) + 8) > 0.6) continue;
        emit(x + lx, top + dy, z + lz, leaf);
      }
    }
  }
};

export const generateChunk = (cx: number, cz: number, params: GenParams): Uint8Array => {
  const blocks = new Uint8Array(CHUNK_SIZE * WORLD_HEIGHT * CHUNK_SIZE);
  const set = (lx: number, y: number, lz: number, id: number) => {
    if (y < 0 || y >= WORLD_HEIGHT || lx < 0 || lz < 0 || lx >= CHUNK_SIZE || lz >= CHUNK_SIZE) return;
    blocks[blockIndex(lx, y, lz)] = id;
  };
  const get = (lx: number, y: number, lz: number): number => {
    if (y < 0 || y >= WORLD_HEIGHT || lx < 0 || lz < 0 || lx >= CHUNK_SIZE || lz >= CHUNK_SIZE) return AIR;
    return blocks[blockIndex(lx, y, lz)] ?? AIR;
  };
  const seed = salted(params);

  for (let lz = 0; lz < CHUNK_SIZE; lz += 1) {
    for (let lx = 0; lx < CHUNK_SIZE; lx += 1) {
      const wx = cx * CHUNK_SIZE + lx;
      const wz = cz * CHUNK_SIZE + lz;
      const surf = surfaceAt(wx, wz, params);
      const ground = surf.ground;
      for (let y = 0; y <= ground; y += 1) {
        if (y === 0) {
          set(lx, y, lz, DARK);
          continue;
        }
        if (isCave(wx, y, wz, seed, ground)) {
          set(lx, y, lz, AIR);
          continue;
        }
        set(lx, y, lz, oreAt(wx, y, wz, seed) || STONE);
      }
      const gravel = hash2(wx, wz, seed + 15) < 0.05 && (surf.biome === 'plains' || surf.biome === 'mountains');
      if (surf.biome === 'desert' || surf.biome === 'beach') {
        for (let d = 0; d < 4 && ground - d > 0; d += 1) set(lx, ground - d, lz, d < 3 ? SAND : SANDSTONE);
        if (surf.biome === 'beach' && ground - 3 > 0) set(lx, ground - 3, lz, CLAY);
      } else if (surf.biome === 'snow' || (surf.biome === 'mountains' && (surf.temp < 0.36 || ground > 54))) {
        set(lx, ground, lz, SNOW);
        for (let d = 1; d <= 3 && ground - d > 0; d += 1) set(lx, ground - d, lz, surf.biome === 'mountains' ? STONE : DIRT);
      } else if (surf.biome === 'mountains' && ground > 46) {
        set(lx, ground, lz, STONE);
      } else if (gravel) {
        set(lx, ground, lz, GRAVEL);
        if (ground - 1 > 0) set(lx, ground - 1, lz, GRAVEL);
      } else {
        set(lx, ground, lz, GRASS);
        for (let d = 1; d <= 3 && ground - d > 0; d += 1) set(lx, ground - d, lz, DIRT);
      }
      for (let y = ground + 1; y < SEA_LEVEL; y += 1) {
        if (get(lx, y, lz) === AIR) set(lx, y, lz, surf.biome === 'snow' && y === SEA_LEVEL - 1 ? ICE : WATER);
      }
      const above = ground + 1;
      if (above >= SEA_LEVEL && get(lx, above, lz) === AIR) {
        const roll = hash2(wx, wz, seed + 77);
        const surfaceId = get(lx, ground, lz);
        if (surfaceId === GRASS && roll < 0.11) set(lx, above, lz, TALL);
        else if (surfaceId === GRASS && roll < 0.15) set(lx, above, lz, FLOWER);
        else if (surfaceId === SAND && roll < 0.04) set(lx, above, lz, BUSH);
      }
    }
  }

  const margin = 5;
  for (let wz = cz * CHUNK_SIZE - margin; wz < cz * CHUNK_SIZE + CHUNK_SIZE + margin; wz += 1) {
    for (let wx = cx * CHUNK_SIZE - margin; wx < cx * CHUNK_SIZE + CHUNK_SIZE + margin; wx += 1) {
      if (!isTreeAnchor(wx, wz, params)) continue;
      const surf = surfaceAt(wx, wz, params);
      writeTree(wx, surf.ground, wz, surf.biome, params, (x, y, z, id) => {
        const lx = x - cx * CHUNK_SIZE;
        const lz = z - cz * CHUNK_SIZE;
        if (lx < 0 || lz < 0 || lx >= CHUNK_SIZE || lz >= CHUNK_SIZE || y <= 0 || y >= WORLD_HEIGHT) return;
        const existing = get(lx, y, lz);
        if (existing === WATER || existing === ICE) return;
        if (existing !== AIR && !isReplaceable(existing)) return;
        set(lx, y, lz, id);
      });
    }
  }
  return blocks;
};

export interface SpawnPoint {
  x: number;
  y: number;
  z: number;
  platform: boolean;
}

export const findSpawn = (params: GenParams): SpawnPoint => {
  const cache = new Map<string, Uint8Array>();
  const sample = (x: number, y: number, z: number): number => {
    if (y < 0 || y >= WORLD_HEIGHT) return AIR;
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    const key = `${cx},${cz}`;
    let data = cache.get(key);
    if (!data) {
      data = generateChunk(cx, cz, params);
      cache.set(key, data);
    }
    const lx = x - cx * CHUNK_SIZE;
    const lz = z - cz * CHUNK_SIZE;
    return data[blockIndex(lx, y, lz)] ?? AIR;
  };
  for (let r = 0; r <= 28; r += 1) {
    for (let dx = -r; dx <= r; dx += 1) {
      for (let dz = -r; dz <= r; dz += 1) {
        if (r !== 0 && Math.abs(dx) !== r && Math.abs(dz) !== r) continue;
        const surf = surfaceAt(dx, dz, params);
        const feet = surf.ground + 1;
        const groundBlock = sample(dx, surf.ground, dz);
        const feetBlock = sample(dx, feet, dz);
        const headBlock = sample(dx, feet + 1, dz);
        const wet = (id: number) => getBlockDef(id)?.liquid === true;
        if (isCollidable(groundBlock) && !isCollidable(feetBlock) && !isCollidable(headBlock) && !wet(groundBlock) && !wet(feetBlock) && !wet(headBlock)) {
          return { x: dx + 0.5, y: feet, z: dz + 0.5, platform: false };
        }
      }
    }
  }
  return { x: 8.5, y: SEA_LEVEL + 1, z: 8.5, platform: true };
};
