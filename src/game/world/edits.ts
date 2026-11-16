import { CHUNK_SIZE, chunkKey, worldToChunk } from './constants';

const keyOf = (x: number, y: number, z: number) => `${x},${y},${z}`;

export class EditLog {
  private readonly map = new Map<string, number>();
  private readonly byChunk = new Map<string, Set<string>>();

  set(x: number, y: number, z: number, id: number): void {
    const key = keyOf(x, y, z);
    this.map.set(key, id);
    const { cx, cz } = worldToChunk(x, z);
    const ck = chunkKey(cx, cz);
    let bucket = this.byChunk.get(ck);
    if (!bucket) {
      bucket = new Set();
      this.byChunk.set(ck, bucket);
    }
    bucket.add(key);
  }

  get(x: number, y: number, z: number): number | undefined {
    return this.map.get(keyOf(x, y, z));
  }

  forChunk(cx: number, cz: number): Array<[number, number, number, number]> {
    const bucket = this.byChunk.get(chunkKey(cx, cz));
    if (!bucket) return [];
    const out: Array<[number, number, number, number]> = [];
    for (const key of bucket) {
      const id = this.map.get(key);
      if (id === undefined) continue;
      const [x, y, z] = key.split(',').map(Number);
      if (x === undefined || y === undefined || z === undefined) continue;
      out.push([x, y, z, id]);
    }
    return out;
  }

  toArray(): number[] {
    const tuples: number[][] = [];
    for (const [key, id] of this.map) {
      const [x, y, z] = key.split(',').map(Number);
      if (x === undefined || y === undefined || z === undefined) continue;
      tuples.push([x, y, z, id]);
    }
    tuples.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
    return tuples.flat();
  }

  static fromArray(data: number[]): EditLog {
    const log = new EditLog();
    for (let i = 0; i + 3 < data.length; i += 4) {
      const x = data[i];
      const y = data[i + 1];
      const z = data[i + 2];
      const id = data[i + 3];
      if (x === undefined || y === undefined || z === undefined || id === undefined) continue;
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z) || !Number.isFinite(id)) continue;
      log.set(x, y, z, id);
    }
    return log;
  }
}

export const affectedChunkKeys = (x: number, _y: number, z: number): string[] => {
  const { cx, cz, lx, lz } = worldToChunk(x, z);
  const keys = [chunkKey(cx, cz)];
  if (lx === 0) keys.push(chunkKey(cx - 1, cz));
  if (lx === CHUNK_SIZE - 1) keys.push(chunkKey(cx + 1, cz));
  if (lz === 0) keys.push(chunkKey(cx, cz - 1));
  if (lz === CHUNK_SIZE - 1) keys.push(chunkKey(cx, cz + 1));
  return keys;
};
