import * as THREE from 'three';
import { ATLAS_COLS, ATLAS_ROWS, TILE_KEYS, TILE_SIZE, type TileKey } from './tileKeys';
import { paintTile } from './tiles';
import { uvFor } from './mesher';

export interface GameMaterials {
  texture: THREE.CanvasTexture;
  opaque: THREE.MeshLambertMaterial;
  cutout: THREE.MeshLambertMaterial;
  glass: THREE.MeshLambertMaterial;
  water: THREE.MeshLambertMaterial;
  glow: THREE.MeshLambertMaterial;
  waterTime: { value: number };
}

let iconCanvas: HTMLCanvasElement | null = null;
const iconCache = new Map<string, string>();

export const getIconCanvas = (): HTMLCanvasElement => {
  if (iconCanvas) return iconCanvas;
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_COLS * TILE_SIZE;
  canvas.height = ATLAS_ROWS * TILE_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Не удалось создать холст текстур');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (const key of TILE_KEYS) {
    const uv = uvFor(key);
    paintTile(ctx, key, uv.px / TILE_SIZE, uv.py / TILE_SIZE);
  }
  iconCanvas = canvas;
  return canvas;
};

export const iconUrl = (key: TileKey): string => {
  const cached = iconCache.get(key);
  if (cached) return cached;
  const uv = uvFor(key);
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(getIconCanvas(), uv.px, uv.py, TILE_SIZE, TILE_SIZE, 0, 0, 32, 32);
  const url = canvas.toDataURL();
  iconCache.set(key, url);
  return url;
};

const makeTexture = (): THREE.CanvasTexture => {
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_COLS * TILE_SIZE;
  canvas.height = ATLAS_ROWS * TILE_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Не удалось создать атлас');
  ctx.drawImage(getIconCanvas(), 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
};

export const createMaterials = (): GameMaterials => {
  const texture = makeTexture();
  const waterTime = { value: 0 };
  const opaque = new THREE.MeshLambertMaterial({ map: texture, vertexColors: true });
  const cutout = new THREE.MeshLambertMaterial({
    map: texture,
    vertexColors: true,
    alphaTest: 0.4,
    side: THREE.DoubleSide,
  });
  cutout.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\nvMossViewZ = mvPosition.z;');
    shader.vertexShader = `varying float vMossViewZ;\n${shader.vertexShader}`;
    shader.fragmentShader = shader.fragmentShader.replace('#include <alphatest_fragment>', '#include <alphatest_fragment>\nif (vMossViewZ > -0.42) discard;');
    shader.fragmentShader = `varying float vMossViewZ;\n${shader.fragmentShader}`;
  };
  const glass = new THREE.MeshLambertMaterial({
    map: texture,
    vertexColors: true,
    transparent: true,
    opacity: 0.7,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const water = new THREE.MeshLambertMaterial({
    map: texture,
    vertexColors: true,
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
    side: THREE.DoubleSide,
    color: new THREE.Color('#d5f2fb'),
  });
  water.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = waterTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nif (normal.y > 0.45) transformed.y += sin((position.x + position.z) * 2.6 + uTime * 1.7) * 0.04;',
      );
  };
  const glow = new THREE.MeshLambertMaterial({
    map: texture,
    vertexColors: true,
    emissive: new THREE.Color('#ffd27a'),
    emissiveMap: texture,
    emissiveIntensity: 0.7,
  });
  return { texture, opaque, cutout, glass, water, glow, waterTime };
};

export const disposeMaterials = (materials: GameMaterials): void => {
  materials.opaque.dispose();
  materials.cutout.dispose();
  materials.glass.dispose();
  materials.water.dispose();
  materials.glow.dispose();
  materials.texture.dispose();
};
