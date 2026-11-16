import { AIR, blockId } from '../blocks/registry';
import { CHUNK_VOLUME, chunkKey, radiusForSize, worldToChunk, type TerrainKind, type WorldSize, blockIndex, WORLD_HEIGHT } from './constants';
import { EditLog } from './edits';
import { generateChunk, type GenParams } from './terrain';

const DARK = blockId('dark_stone');

export class VoxelWorld {
  readonly params: GenParams;
  readonly radius: number;
  readonly edits: EditLog;
  private readonly chunks = new Map<string, Uint8Array>();
  private readonly border: Uint8Array;

  constructor(options: {
    seed: number;
    terrain: TerrainKind;
    size: WorldSize;
    generatorVersion: number;
    edits?: number[];
  }) {
    this.params = {
      seed: options.seed >>> 0,
      terrain: options.terrain,
      generatorVersion: options.generatorVersion,
    };
    this.radius = radiusForSize(options.size);
    this.edits = EditLog.fromArray(options.edits ?? []);
    this.border = new Uint8Array(CHUNK_VOLUME);
    for (let y = 0; y <= 40 && y < WORLD_HEIGHT; y += 1) {
      for (let z = 0; z < 16; z += 1) {
        for (let x = 0; x < 16; x += 1) this.border[blockIndex(x, y, z)] = DARK;
      }
    }
  }

  inBounds(cx: number, cz: number): boolean {
    return Math.max(Math.abs(cx), Math.abs(cz)) <= this.radius;
  }

  getBlock(x: number, y: number, z: number): number {
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return AIR;
    if (y < 0) return DARK;
    if (y >= WORLD_HEIGHT) return AIR;
    const { cx, cz, lx, lz } = worldToChunk(x, z);
    const data = this.ensure(cx, cz);
    return data[blockIndex(lx, y, lz)] ?? AIR;
  }

  setBlock(x: number, y: number, z: number, id: number): boolean {
    if (y <= 0 || y >= WORLD_HEIGHT) return false;
    const { cx, cz, lx, lz } = worldToChunk(x, z);
    if (!this.inBounds(cx, cz)) return false;
    const data = this.ensure(cx, cz);
    const index = blockIndex(lx, y, lz);
    if ((data[index] ?? AIR) === id) return false;
    data[index] = id;
    this.edits.set(x, y, z, id);
    return true;
  }

  unload(cx: number, cz: number): void {
    this.chunks.delete(chunkKey(cx, cz));
  }

  private ensure(cx: number, cz: number): Uint8Array {
    const key = chunkKey(cx, cz);
    const cached = this.chunks.get(key);
    if (cached) return cached;
    if (!this.inBounds(cx, cz)) {
      this.chunks.set(key, this.border);
      return this.border;
    }
    let data: Uint8Array;
    try {
      data = generateChunk(cx, cz, this.params);
    } catch (error) {
      console.error('Ошибка генерации чанка', cx, cz, error);
      data = new Uint8Array(CHUNK_VOLUME);
    }
    for (const [x, y, z, id] of this.edits.forChunk(cx, cz)) {
      const lx = x - cx * 16;
      const lz = z - cz * 16;
      if (y > 0 && y < WORLD_HEIGHT && lx >= 0 && lx < 16 && lz >= 0 && lz < 16) data[blockIndex(lx, y, lz)] = id;
    }
    this.chunks.set(key, data);
    return data;
  }
}
