import { blockId } from '../game/blocks/registry';
import { creativeHotbar, emptyInventory } from '../game/inventory/inventory';
import { GENERATOR_VERSION } from '../game/version';
import { SEA_LEVEL, type GameMode, type TerrainKind, type WorldSize } from '../game/world/constants';
import { EditLog } from '../game/world/edits';
import { findSpawn, type GenParams } from '../game/world/terrain';
import { hashSeed } from '../utils/hash';
import { withChecksum } from './serializer';
import type { WorldSave } from './types';

const autoName = (): string => {
  const now = new Date();
  const pad = (value: number) => value.toString().padStart(2, '0');
  return `Мир ${pad(now.getDate())}.${pad(now.getMonth() + 1)} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
};

export interface NewWorldInput {
  name: string;
  seed: string;
  mode: GameMode;
  size: WorldSize;
  terrain: TerrainKind;
}

export const createWorldSave = (input: NewWorldInput): WorldSave => {
  const name = input.name.trim() || autoName();
  const seed = input.seed.trim() || String(Math.floor(Math.random() * 1_000_000_000));
  const params: GenParams = { seed: hashSeed(seed), terrain: input.terrain, generatorVersion: GENERATOR_VERSION };
  const spawn = findSpawn(params);
  let edits: number[] = [];
  let y = spawn.y;
  if (spawn.platform) {
    const log = new EditLog();
    const stone = blockId('stone');
    for (let x = 6; x <= 10; x += 1) {
      for (let z = 6; z <= 10; z += 1) {
        log.set(x, SEA_LEVEL, z, stone);
        log.set(x, SEA_LEVEL + 1, z, 0);
        log.set(x, SEA_LEVEL + 2, z, 0);
      }
    }
    edits = log.toArray();
    y = SEA_LEVEL + 1;
  }
  const now = Date.now();
  const inventory = input.mode === 'creative'
    ? creativeHotbar(['grass', 'dirt', 'stone', 'oak_log', 'oak_planks', 'glass', 'bricks', 'glow', 'oak_leaves'].map(blockId))
    : emptyInventory();
  return withChecksum({
    version: 1,
    id: crypto.randomUUID(),
    name,
    seed,
    mode: input.mode,
    size: input.size,
    terrain: input.terrain,
    generatorVersion: GENERATOR_VERSION,
    createdAt: now,
    updatedAt: now,
    time: 0.32,
    timeRunning: true,
    weather: 'clear',
    lineMode: false,
    spawn: { x: spawn.x, y, z: spawn.z },
    player: {
      x: spawn.x,
      y,
      z: spawn.z,
      yaw: 0,
      pitch: 0,
      health: 20,
      hunger: 20,
      flying: false,
      slot: 0,
      camera: 'first',
    },
    inventory,
    edits,
  });
};
