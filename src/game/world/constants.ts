export const CHUNK_SIZE = 16;
export const WORLD_HEIGHT = 72;
export const SEA_LEVEL = 30;
export const CHUNK_VOLUME = CHUNK_SIZE * WORLD_HEIGHT * CHUNK_SIZE;

export type WorldSize = 'small' | 'medium' | 'large';
export type TerrainKind = 'plains' | 'forest' | 'mountains' | 'desert' | 'islands' | 'mixed';
export type GameMode = 'creative' | 'survival';

export const blockIndex = (x: number, y: number, z: number): number =>
  x + z * CHUNK_SIZE + y * CHUNK_SIZE * CHUNK_SIZE;

export const chunkKey = (cx: number, cz: number): string => `${cx},${cz}`;

export const worldToChunk = (x: number, z: number) => {
  const cx = Math.floor(x / CHUNK_SIZE);
  const cz = Math.floor(z / CHUNK_SIZE);
  return { cx, cz, lx: x - cx * CHUNK_SIZE, lz: z - cz * CHUNK_SIZE };
};

export const radiusForSize = (size: WorldSize): number => {
  if (size === 'small') return 8;
  if (size === 'medium') return 14;
  return 24;
};

export const renderDistanceChunks = (level: 'low' | 'medium' | 'high'): number => {
  if (level === 'low') return 3;
  if (level === 'high') return 7;
  return 5;
};
