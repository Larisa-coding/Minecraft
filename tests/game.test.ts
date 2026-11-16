import { describe, expect, it } from 'vitest';
import { BLOCKS, FACE_NAMES, blockId, getBlockDef, placeableBlocks } from '../src/game/blocks/registry';
import { PAINTERS } from '../src/game/rendering/tiles';
import { TILE_KEYS } from '../src/game/rendering/tileKeys';
import { meshChunk } from '../src/game/rendering/mesher';
import { RECIPES, canCraft, craft } from '../src/game/inventory/crafting';
import { addItem, emptyInventory, putHeld, takeSlot } from '../src/game/inventory/inventory';
import { axisLine, canPlaceAt, targetCell } from '../src/game/interaction/placement';
import { raycastVoxel } from '../src/game/interaction/raycast';
import { collisionBoxes, stepBody, type Body } from '../src/game/player/physics';
import { migrateWorldSave, withChecksum } from '../src/storage/serializer';
import { fbm2, hashSeed } from '../src/utils/hash';
import { generateChunk, findSpawn, surfaceAt } from '../src/game/world/terrain';
import { VoxelWorld } from '../src/game/world/VoxelWorld';
import { SEA_LEVEL, WORLD_HEIGHT } from '../src/game/world/constants';

const params = { seed: hashSeed('same-seed'), terrain: 'mixed' as const, generatorVersion: 1 };

describe('блоки и текстуры', () => {
  it('в каталоге не меньше 40 устанавливаемых блоков с шестью гранями', () => {
    expect(placeableBlocks().length).toBeGreaterThanOrEqual(40);
    for (const block of placeableBlocks()) {
      for (const face of FACE_NAMES) expect(block.faces[face]).toBeTruthy();
    }
    const grass = getBlockDef(blockId('grass'));
    const log = getBlockDef(blockId('oak_log'));
    expect(grass?.faces.top).not.toBe(grass?.faces.north);
    expect(grass?.faces.bottom).toBe('dirt');
    expect(log?.faces.top).not.toBe(log?.faces.north);
    expect(new Set(BLOCKS.map((block) => block.id)).size).toBe(BLOCKS.length);
  });

  it('у каждого тайла есть рисовальщик', () => {
    expect(Object.keys(PAINTERS).sort()).toEqual([...TILE_KEYS].sort());
  });
});

describe('генерация', () => {
  it('один seed даёт тот же чанк, другой seed — другой', () => {
    const a = generateChunk(0, 0, params);
    const b = generateChunk(0, 0, params);
    const c = generateChunk(0, 0, { ...params, seed: hashSeed('other-seed') });
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
    expect(surfaceAt(4, 4, params).ground).toBe(surfaceAt(4, 4, params).ground);
  });

  it('в смешанном мире есть трава, вода и деревья, а спавн не внутри блока', () => {
    let grass = 0;
    let water = 0;
    let logs = 0;
    for (let cz = -2; cz <= 2; cz += 1) {
      for (let cx = -2; cx <= 2; cx += 1) {
        const data = generateChunk(cx, cz, params);
        for (const id of data) {
          if (id === blockId('grass')) grass += 1;
          if (id === blockId('water')) water += 1;
          if (id === blockId('oak_log') || id === blockId('birch_log') || id === blockId('pine_log')) logs += 1;
        }
      }
    }
    expect(grass).toBeGreaterThan(10);
    expect(water).toBeGreaterThan(0);
    expect(logs).toBeGreaterThan(0);
    const spawn = findSpawn(params);
    if (spawn.platform) {
      expect(spawn.y).toBe(SEA_LEVEL + 1);
    } else {
      const world = new VoxelWorld({ seed: params.seed, terrain: 'mixed', size: 'small', generatorVersion: 1 });
      const x = Math.floor(spawn.x);
      const z = Math.floor(spawn.z);
      expect(getBlockDef(world.getBlock(x, Math.floor(spawn.y) - 1, z))?.collidable).toBe(true);
      expect(getBlockDef(world.getBlock(x, Math.floor(spawn.y), z))?.collidable ?? false).toBe(false);
      expect(getBlockDef(world.getBlock(x, Math.floor(spawn.y) + 1, z))?.collidable ?? false).toBe(false);
    }
  });

  it('правки блока переживают пересоздание мира и не дублируются', () => {
    const world = new VoxelWorld({ seed: params.seed, terrain: 'plains', size: 'small', generatorVersion: 1 });
    expect(world.getBlock(2, 70, 2)).toBe(0);
    expect(world.setBlock(2, 70, 2, blockId('bricks'))).toBe(true);
    expect(world.setBlock(2, 70, 2, blockId('bricks'))).toBe(false);
    expect(world.edits.toArray()).toHaveLength(4);
    const restored = new VoxelWorld({ seed: params.seed, terrain: 'plains', size: 'small', generatorVersion: 1, edits: world.edits.toArray() });
    expect(restored.getBlock(2, 70, 2)).toBe(blockId('bricks'));
  });
});

describe('взаимодействие и физика', () => {
  it('луч попадает в верхнюю грань и ставит блок над ней', () => {
    const hit = raycastVoxel(0.5, 4, 0.5, 0, -1, 0, 8, (x, y, z) => (x === 0 && y === 0 && z === 0 ? blockId('stone') : 0), (id) => id !== 0);
    expect(hit).toMatchObject({ x: 0, y: 0, z: 0, ny: 1 });
    expect(targetCell(hit!, () => blockId('stone'))).toEqual({ x: 0, y: 1, z: 0 });
  });

  it('нельзя поставить блок внутрь игрока и можно поставить рядом', () => {
    const body: Body = { x: 0.5, y: 1, z: 0.5, vx: 0, vy: 0, vz: 0, onGround: true, width: 0.6, height: 1.8, flying: false };
    expect(canPlaceAt(0, 1, 0, blockId('stone'), () => 0, body, WORLD_HEIGHT)).toBe(false);
    expect(canPlaceAt(2, 1, 0, blockId('stone'), () => 0, body, WORLD_HEIGHT)).toBe(true);
    expect(axisLine({ x: 0, y: 1, z: 0 }, { x: 3, y: 1, z: 0 })).toHaveLength(3);
  });

  it('игрок падает на пол и не проходит стену', () => {
    const floor = {
      boxesAt(x: number, y: number, z: number) {
        if (y >= 0 && y <= 2) return collisionBoxes(blockId('stone'), x, y, z);
        if (x >= 3 && y <= 6) return collisionBoxes(blockId('stone'), x, y, z);
        return [];
      },
    };
    const body: Body = { x: 0.5, y: 10, z: 0.5, vx: 0, vy: 0, vz: 0, onGround: false, width: 0.6, height: 1.78, flying: false };
    for (let i = 0; i < 360; i += 1) stepBody(body, 1 / 60, floor);
    expect(body.onGround).toBe(true);
    expect(body.y).toBeGreaterThan(2.9);
    expect(body.y).toBeLessThan(3.15);
    body.vx = 6;
    for (let i = 0; i < 180; i += 1) stepBody(body, 1 / 60, floor);
    expect(body.x + body.width / 2).toBeLessThan(3.05);
  });
});

describe('инвентарь, крафт и сохранения', () => {
  it('складывает стаки, делит и крафтит доски', () => {
    let slots = emptyInventory();
    slots = addItem(slots, blockId('oak_log'), 2).slots;
    expect(slots[0]).toEqual({ id: blockId('oak_log'), count: 2 });
    const taken = takeSlot(slots, 0, true);
    expect(taken.held.count).toBe(1);
    const put = putHeld(taken.slots, 1, taken.held, false);
    expect(put.slots[1]?.count).toBe(1);
    const crafted = craft(addItem(emptyInventory(), blockId('oak_log'), 1).slots, RECIPES[0]!);
    expect(crafted?.[0]).toEqual({ id: blockId('oak_planks'), count: 4 });
    expect(canCraft(emptyInventory(), RECIPES[0]!)).toBe(false);
  });

  it('бракует битый файл и принимает честную контрольную сумму', () => {
    expect(() => migrateWorldSave({ version: 9 })).toThrow();
    const save = withChecksum({
      version: 1,
      id: 'w1',
      name: 'Тест',
      seed: '42',
      mode: 'creative',
      size: 'small',
      terrain: 'plains',
      generatorVersion: 1,
      createdAt: 1,
      updatedAt: 2,
      time: 0.3,
      timeRunning: true,
      weather: 'clear',
      lineMode: false,
      spawn: { x: 1, y: 2, z: 3 },
      player: { x: 1, y: 2, z: 3, yaw: 0, pitch: 0, health: 20, hunger: 20, flying: false, slot: 0, camera: 'first' },
      inventory: emptyInventory(),
      edits: [1, 2, 3, 4],
    });
    expect(migrateWorldSave(save).name).toBe('Тест');
    expect(() => migrateWorldSave({ ...save, name: 'Подмена' })).toThrow(/сумм/);
  });

  it('шум стабилен', () => {
    expect(fbm2(1.2, 3.4, 9, 3)).toBe(fbm2(1.2, 3.4, 9, 3));
  });
});

describe('мешер', () => {
  it('не рисует грань между двумя камнями и рисует внешние', () => {
    const stone = blockId('stone');
    const get = (x: number, y: number, z: number) => (y === 4 && x >= 0 && x <= 1 && z === 0 ? stone : y < 0 ? stone : 0);
    const mesh = meshChunk(0, 0, get);
    expect(mesh.opaque).not.toBeNull();
    const positions = mesh.opaque?.positions ?? new Float32Array();
    const indices = mesh.opaque?.indices ?? new Uint16Array();
    let internalFaces = 0;
    for (let i = 0; i < indices.length; i += 6) {
      const xs = [0, 1, 2, 3].map((offset) => positions[((indices[i + offset] ?? 0) * 3)] ?? 0);
      if (xs.every((x) => Math.abs(x - 1) < 0.001)) internalFaces += 1;
    }
    expect(internalFaces).toBe(0);
    expect(positions.length).toBeGreaterThan(0);
  });
});
