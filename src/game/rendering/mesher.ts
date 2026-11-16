import { AIR, getBlockDef, isOpaqueCube, type FaceName } from '../blocks/registry';
import { hash3 } from '../../utils/hash';
import { CHUNK_SIZE, WORLD_HEIGHT } from '../world/constants';
import { ATLAS_COLS, ATLAS_ROWS, TILE_SIZE, type TileKey } from './tileKeys';
import { tileIndex } from './tiles';

export interface UvRect {
  u0: number;
  v0: number;
  u1: number;
  v1: number;
  px: number;
  py: number;
}

const halfU = 0.5 / (ATLAS_COLS * TILE_SIZE);
const halfV = 0.5 / (ATLAS_ROWS * TILE_SIZE);

export const uvFor = (key: TileKey): UvRect => {
  const pos = tileIndex.get(key);
  if (!pos) throw new Error(`Нет тайла ${key}`);
  const vTop = 1 - pos.row / ATLAS_ROWS;
  const vBot = 1 - (pos.row + 1) / ATLAS_ROWS;
  return {
    u0: pos.col / ATLAS_COLS + halfU,
    u1: (pos.col + 1) / ATLAS_COLS - halfU,
    v0: vBot + halfV,
    v1: vTop - halfV,
    px: pos.col * TILE_SIZE,
    py: pos.row * TILE_SIZE,
  };
};

interface FaceGeom {
  n: [number, number, number];
  v: [number, number, number][];
}

const FACES: Record<FaceName, FaceGeom> = {
  east: { n: [1, 0, 0], v: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]] },
  west: { n: [-1, 0, 0], v: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]] },
  north: { n: [0, 0, -1], v: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]] },
  south: { n: [0, 0, 1], v: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] },
  top: { n: [0, 1, 0], v: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] },
  bottom: { n: [0, -1, 0], v: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
};

const FACE_ORDER: FaceName[] = ['east', 'west', 'north', 'south', 'top', 'bottom'];

export interface ChunkBuffers {
  positions: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
  colors: Float32Array;
  indices: Uint16Array | Uint32Array;
}

export interface ChunkMeshData {
  opaque: ChunkBuffers | null;
  cutout: ChunkBuffers | null;
  glass: ChunkBuffers | null;
  water: ChunkBuffers | null;
  glow: ChunkBuffers | null;
}

class Bucket {
  positions: number[] = [];
  normals: number[] = [];
  uvs: number[] = [];
  colors: number[] = [];
  indices: number[] = [];

  push(corners: number[][], nx: number, ny: number, nz: number, uv: UvRect, shade: number) {
    const start = this.positions.length / 3;
    const uvs = [
      [uv.u0, uv.v0],
      [uv.u1, uv.v0],
      [uv.u1, uv.v1],
      [uv.u0, uv.v1],
    ];
    corners.forEach((corner, index) => {
      this.positions.push(corner[0] ?? 0, corner[1] ?? 0, corner[2] ?? 0);
      this.normals.push(nx, ny, nz);
      const uvPair = uvs[index] ?? uvs[0];
      this.uvs.push(uvPair[0] ?? 0, uvPair[1] ?? 0);
      this.colors.push(shade, shade, shade);
    });
    this.indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
  }

  pack(): ChunkBuffers | null {
    if (this.positions.length === 0) return null;
    const vertexCount = this.positions.length / 3;
    return {
      positions: new Float32Array(this.positions),
      normals: new Float32Array(this.normals),
      uvs: new Float32Array(this.uvs),
      colors: new Float32Array(this.colors),
      indices: vertexCount > 65535 ? new Uint32Array(this.indices) : new Uint16Array(this.indices),
    };
  }
}

const shadeFor = (ny: number, wx: number, y: number, wz: number) => {
  const base = ny > 0.5 ? 1 : ny < -0.5 ? 0.62 : 0.8;
  return base * (0.97 + hash3(wx, y, wz, 9) * 0.03);
};

export const meshChunk = (
  cx: number,
  cz: number,
  getBlock: (x: number, y: number, z: number) => number,
): ChunkMeshData => {
  const buckets = {
    opaque: new Bucket(),
    cutout: new Bucket(),
    glass: new Bucket(),
    water: new Bucket(),
    glow: new Bucket(),
  };

  for (let y = 0; y < WORLD_HEIGHT; y += 1) {
    for (let lz = 0; lz < CHUNK_SIZE; lz += 1) {
      for (let lx = 0; lx < CHUNK_SIZE; lx += 1) {
        const wx = cx * CHUNK_SIZE + lx;
        const wz = cz * CHUNK_SIZE + lz;
        const id = getBlock(wx, y, wz);
        if (id === AIR) continue;
        const def = getBlockDef(id);
        if (!def || def.layer === 'none' || def.shape === 'none') continue;
        if (def.shape === 'cross') {
          const uv = uvFor(def.faces.north);
          const shade = shadeFor(1, wx, y, wz);
          buckets.cutout.push(
            [
              [lx, y, lz],
              [lx + 1, y, lz + 1],
              [lx + 1, y + 1, lz + 1],
              [lx, y + 1, lz],
            ],
            0, 1, 0, uv, shade,
          );
          buckets.cutout.push(
            [
              [lx + 1, y, lz],
              [lx, y, lz + 1],
              [lx, y + 1, lz + 1],
              [lx + 1, y + 1, lz],
            ],
            0, 1, 0, uv, shade,
          );
          continue;
        }
        const above = getBlock(wx, y + 1, wz);
        const aboveDef = getBlockDef(above);
        let yMax = def.shape === 'slab' ? 0.5 : 1;
        if (def.liquid && !aboveDef?.liquid) yMax = 0.88;
        const layer = def.layer === 'opaque' ? 'opaque' : def.layer;
        const bucket = buckets[layer === 'cutout' || layer === 'glass' || layer === 'water' || layer === 'glow' ? layer : 'opaque'];
        for (const face of FACE_ORDER) {
          const geom = FACES[face];
          const nx = geom.n[0];
          const ny = geom.n[1];
          const nz = geom.n[2];
          const nid = getBlock(wx + nx, y + ny, wz + nz);
          const neighbor = getBlockDef(nid);
          if (def.shape === 'slab') {
            if (face === 'bottom' && neighbor && isOpaqueCube(nid)) continue;
          } else if (def.liquid) {
            if (neighbor?.liquid) continue;
          } else if (isOpaqueCube(id)) {
            if (isOpaqueCube(nid)) continue;
          } else if (neighbor && neighbor.id === id && neighbor.shape === 'cube') continue;
          const uv = uvFor(def.faces[face]);
          const corners = geom.v.map((vertex) => [lx + vertex[0], y + vertex[1] * yMax, lz + vertex[2]]);
          bucket.push(corners, nx, ny, nz, uv, shadeFor(ny, wx, y, wz));
        }
      }
    }
  }

  return {
    opaque: buckets.opaque.pack(),
    cutout: buckets.cutout.pack(),
    glass: buckets.glass.pack(),
    water: buckets.water.pack(),
    glow: buckets.glow.pack(),
  };
};
