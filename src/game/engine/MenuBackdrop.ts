import * as THREE from 'three';
import { isCollidable, blockId } from '../blocks/registry';
import { createMaterials, disposeMaterials, type GameMaterials } from '../rendering/materials';
import { meshChunk, type ChunkBuffers } from '../rendering/mesher';
import { SkyDome, skyState, type SkyState } from '../rendering/sky';
import { hashSeed } from '../../utils/hash';
import { VoxelWorld } from '../world/VoxelWorld';

const geometryFrom = (buffers: ChunkBuffers): THREE.BufferGeometry => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(buffers.positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(buffers.normals, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(buffers.uvs, 2));
  geometry.setAttribute('color', new THREE.BufferAttribute(buffers.colors, 3));
  geometry.setIndex(new THREE.BufferAttribute(buffers.indices, 1));
  return geometry;
};

export class MenuBackdrop {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(60, 1, 0.1, 500);
  private readonly world: VoxelWorld;
  private readonly materials: GameMaterials;
  private readonly sky: SkyDome;
  private readonly colors: SkyState;
  private readonly light: THREE.DirectionalLight;
  private readonly groups: THREE.Group[] = [];
  private readonly queue: [number, number][] = [];
  private frame = 0;
  private disposed = false;
  private focus = new THREE.Vector3(4, 28, 4);

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.world = new VoxelWorld({
      seed: hashSeed('mosspeak-harbor'),
      terrain: 'mixed',
      size: 'small',
      generatorVersion: 1,
    });
    this.materials = createMaterials();
    this.sky = new SkyDome();
    this.sky.addTo(this.scene);
    this.colors = skyState(0.34, {
      top: new THREE.Color(), horizon: new THREE.Color(), bottom: new THREE.Color(),
      light: new THREE.Vector3(), intensity: 1, ambient: 0.5, hemiSky: new THREE.Color(),
      hemiGround: new THREE.Color(), sunVisible: true, moonVisible: false, exposure: 1, fog: new THREE.Color(),
    });
    this.scene.add(new THREE.HemisphereLight('#d7ecff', '#6d7a55', 0.75));
    this.light = new THREE.DirectionalLight('#fff4dd', 1.15);
    this.scene.add(this.light);
    this.scene.fog = new THREE.Fog(this.colors.fog, 28, 90);
    for (let cz = -1; cz <= 1; cz += 1) for (let cx = -1; cx <= 1; cx += 1) this.queue.push([cx, cz]);
    this.resize();
    window.addEventListener('resize', this.onResize);
    this.tick();
  }

  private onResize = () => this.resize();

  private resize(): void {
    const width = this.renderer.domElement.clientWidth || window.innerWidth;
    const height = this.renderer.domElement.clientHeight || window.innerHeight;
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  private buildHut(): void {
    let ground = 30;
    for (let y = 60; y >= 1; y -= 1) {
      if (isCollidable(this.world.getBlock(4, y, 4))) { ground = y; break; }
    }
    const log = blockId('oak_log');
    const planks = blockId('oak_planks');
    const glass = blockId('glass');
    const glow = blockId('glow');
    for (let x = 3; x <= 6; x += 1) for (let z = 3; z <= 6; z += 1) this.world.setBlock(x, ground + 1, z, planks);
    for (let y = 1; y <= 3; y += 1) {
      for (const [x, z] of [[3, 3], [6, 3], [3, 6], [6, 6]] as const) this.world.setBlock(x, ground + 1 + y, z, log);
    }
    for (let x = 3; x <= 6; x += 1) for (let z = 3; z <= 6; z += 1) this.world.setBlock(x, ground + 5, z, planks);
    this.world.setBlock(5, ground + 2, 3, glass);
    this.world.setBlock(5, ground + 3, 3, glass);
    this.world.setBlock(4, ground + 2, 6, glow);
    this.focus.set(4.5, ground + 3, 4.5);
  }

  private tick = (): void => {
    if (this.disposed) return;
    requestAnimationFrame(this.tick);
    if (this.queue.length) {
      const job = this.queue.shift();
      if (job) {
        const [cx, cz] = job;
        const data = meshChunk(cx, cz, (x, y, z) => this.world.getBlock(x, y, z));
        const group = new THREE.Group();
        group.position.set(cx * 16, 0, cz * 16);
        const add = (buffers: ChunkBuffers | null, material: THREE.Material) => {
          if (!buffers) return;
          group.add(new THREE.Mesh(geometryFrom(buffers), material));
        };
        add(data.opaque, this.materials.opaque);
        add(data.cutout, this.materials.cutout);
        add(data.glow, this.materials.glow);
        add(data.glass, this.materials.glass);
        add(data.water, this.materials.water);
        this.scene.add(group);
        this.groups.push(group);
      }
      if (!this.queue.length) {
        this.buildHut();
        for (const group of this.groups) {
          group.traverse((obj) => { if (obj instanceof THREE.Mesh) obj.geometry.dispose(); });
          this.scene.remove(group);
        }
        this.groups.length = 0;
        for (let cz = -1; cz <= 1; cz += 1) {
          for (let cx = -1; cx <= 1; cx += 1) {
            const data = meshChunk(cx, cz, (x, y, z) => this.world.getBlock(x, y, z));
            const group = new THREE.Group();
            group.position.set(cx * 16, 0, cz * 16);
            const add = (buffers: ChunkBuffers | null, material: THREE.Material) => {
              if (!buffers) return;
              group.add(new THREE.Mesh(geometryFrom(buffers), material));
            };
            add(data.opaque, this.materials.opaque);
            add(data.cutout, this.materials.cutout);
            add(data.glow, this.materials.glow);
            add(data.glass, this.materials.glass);
            add(data.water, this.materials.water);
            this.scene.add(group);
            this.groups.push(group);
          }
        }
      }
    }
    this.frame += 1;
    const time = 0.3 + Math.sin(this.frame * 0.004) * 0.06;
    this.materials.waterTime.value = this.frame / 60;
    skyState(time, this.colors);
    this.sky.update(this.colors, this.focus, time, true);
    this.light.position.copy(this.focus).addScaledVector(this.colors.light, 40);
    this.light.intensity = this.colors.intensity;
    const angle = this.frame * 0.0025;
    this.camera.position.set(this.focus.x + Math.cos(angle) * 14, this.focus.y + 6, this.focus.z + Math.sin(angle) * 14);
    this.camera.lookAt(this.focus);
    this.renderer.render(this.scene, this.camera);
  };

  dispose(): void {
    this.disposed = true;
    window.removeEventListener('resize', this.onResize);
    for (const group of this.groups) group.traverse((obj) => { if (obj instanceof THREE.Mesh) obj.geometry.dispose(); });
    this.sky.dispose();
    disposeMaterials(this.materials);
    this.renderer.dispose();
  }
}
