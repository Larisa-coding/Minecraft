import * as THREE from 'three';
import { audio } from '../audio/AudioManager';
import { AIR, blockId, getBlockDef, isCollidable } from '../blocks/registry';
import { bindGame, type GameApi } from './api';
import { axisLine, canPlaceAt, isBreakable, targetCell, type BlockPos } from '../interaction/placement';
import { REACH, raycastVoxel, type RayHit } from '../interaction/raycast';
import { addItem, cloneSlots, consumeFromSlot, type Slot } from '../inventory/inventory';
import { collisionBoxes, JUMP_SPEED, nudgeOut, overlapsSolids, stepBody, type Body } from '../player/physics';
import { isNight, makeZombieMesh, pickMob, poseZombie, stepMobs, swingTime, weaponDamage, ZOMBIE_HEALTH, type Mob } from '../entities/mobs';
import { createMaterials, disposeMaterials, type GameMaterials } from '../rendering/materials';
import { meshChunk, type ChunkBuffers } from '../rendering/mesher';
import { SkyDome, skyState, type SkyState } from '../rendering/sky';
import { chunkKey, renderDistanceChunks, WORLD_HEIGHT, type GameMode } from '../world/constants';
import { affectedChunkKeys } from '../world/edits';
import { VoxelWorld } from '../world/VoxelWorld';
import { hashSeed } from '../../utils/hash';
import { useSettings } from '../../store/settingsStore';
import { useUi } from '../../store/uiStore';
import { putWorld } from '../../storage/worldDb';
import type { Settings } from '../../storage/settings';
import type { WorldSave } from '../../storage/types';

const BERRIES = blockId('berries');

const lookOf = (yaw: number, pitch: number) => new THREE.Vector3(
  -Math.sin(yaw) * Math.cos(pitch),
  Math.sin(pitch),
  -Math.cos(yaw) * Math.cos(pitch),
);

const geometryFrom = (buffers: ChunkBuffers): THREE.BufferGeometry => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(buffers.positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(buffers.normals, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(buffers.uvs, 2));
  geometry.setAttribute('color', new THREE.BufferAttribute(buffers.colors, 3));
  geometry.setIndex(new THREE.BufferAttribute(buffers.indices, 1));
  return geometry;
};

export class GameEngine {
  private readonly canvas: HTMLCanvasElement;
  private readonly save: WorldSave;
  private readonly world: VoxelWorld;
  private settings: Settings;
  private renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(60, 1, 0.18, 700);
  private readonly materials: GameMaterials;
  private readonly sky: SkyDome;
  private readonly skyColors: SkyState;
  private readonly hemi: THREE.HemisphereLight;
  private readonly sun: THREE.DirectionalLight;
  private readonly ambient: THREE.AmbientLight;
  private readonly chunks = new Map<string, THREE.Group>();
  private readonly queue: { cx: number; cz: number; dist: number }[] = [];
  private readonly boot = new Set<string>();
  private readonly keys = new Set<string>();
  private readonly body: Body;
  private readonly highlight: THREE.Group;
  private readonly preview: THREE.Group;
  private readonly avatar: THREE.Group;
  private readonly grid: THREE.GridHelper;
  private readonly rain: THREE.Points;
  private readonly clock = new THREE.Clock();
  private slots: Slot[];
  private yaw: number;
  private pitch: number;
  private slot: number;
  private health: number;
  private hunger: number;
  private fall = 0;
  private hungerTimer = 0;
  private starveTimer = 0;
  private time: number;
  private timeRunning: boolean;
  private weather: 'clear' | 'rain';
  private lineMode: boolean;
  private cameraMode: 'first' | 'third';
  private viewDistance = 0;
  private flying: boolean;
  private sprintLatch = false;
  private sprinting = false;
  private ready = false;
  private paused = false;
  private pointerLocked = false;
  private disposed = false;
  private breaking = false;
  private placing = false;
  private breakTime = 0;
  private breakKey = '';
  private actionCooldown = 0;
  private placeCooldown = 0;
  private placeLock = 0;
  private jumpHeld = false;
  private touchForward = 0;
  private touchStrafe = 0;
  private touchJump = false;
  private touchSneak = false;
  private lookX = 0;
  private lookY = 0;
  private press: { x: number; y: number; button: number; moved: number } | null = null;
  private lastSpace = 0;
  private lastJumpTap = 0;
  private lastForwardTap = 0;
  private lastPlace: BlockPos | null = null;
  private hit: RayHit | null = null;
  private aimed: Mob | null = null;
  private readonly mobs: Mob[] = [];
  private readonly mobMeshes = new Map<number, THREE.Group>();
  private mobTimer = 0;
  private nextMob = 1;
  private swing = 0;
  private dirty = false;
  private saveTimer = 0;
  private positionTimer = 0;
  private saving = false;
  private hudTimer = 0;
  private fpsTimer = 0;
  private fpsFrames = 0;
  private fps = 0;
  private readonly touch: boolean;
  private unsub = () => {};
  private readonly onResize: () => void;
  private resizeObserver: ResizeObserver | null = null;
  private onKeyDown: (event: KeyboardEvent) => void = () => {};
  private onKeyUp: (event: KeyboardEvent) => void = () => {};
  private onMouseDown: (event: MouseEvent) => void = () => {};
  private onMouseUp: (event: MouseEvent) => void = () => {};
  private onMouseMove: (event: MouseEvent) => void = () => {};
  private onWheel: (event: WheelEvent) => void = () => {};
  private onLock: () => void = () => {};
  private onHide: () => void = () => {};
  private onContext: (event: Event) => void = () => {};
  private onClick: () => void = () => {};

  constructor(canvas: HTMLCanvasElement, save: WorldSave) {
    this.canvas = canvas;
    this.save = save;
    this.world = new VoxelWorld({
      seed: hashSeed(save.seed),
      terrain: save.terrain,
      size: save.size,
      generatorVersion: save.generatorVersion,
      edits: save.edits,
    });
    this.settings = {
      graphics: useSettings.getState().graphics,
      controls: useSettings.getState().controls,
      audio: useSettings.getState().audio,
      ui: useSettings.getState().ui,
      tutorialSeen: useSettings.getState().tutorialSeen,
      lastWorldId: useSettings.getState().lastWorldId,
    };
    this.touch = window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 1;
    this.slots = cloneSlots(save.inventory);
    if (save.mode === 'creative') this.ensureWeapons();
    this.yaw = save.player.yaw;
    this.pitch = THREE.MathUtils.clamp(save.player.pitch, -1.52, 1.52);
    this.slot = save.player.slot;
    this.health = save.player.health;
    this.hunger = save.player.hunger;
    this.time = save.time;
    this.timeRunning = save.timeRunning;
    this.weather = save.weather;
    this.lineMode = save.lineMode;
    this.cameraMode = save.player.camera;
    this.viewDistance = save.player.camera === 'third' ? 8 : 0;
    this.flying = save.mode === 'creative' && save.player.flying;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: this.settings.graphics.antialias && !this.touch,
        alpha: false,
        powerPreference: 'high-performance',
        preserveDrawingBuffer: true,
      });
    } catch {
      useUi.getState().setWorldUi({ fatal: 'WebGL недоступен. Обновите браузер или включите аппаратное ускорение.' });
      throw new Error('WebGL недоступен');
    }
    this.renderer = renderer;
    if (!renderer.getContext()) {
      useUi.getState().setWorldUi({ fatal: 'Не удалось создать графический контекст.' });
      throw new Error('WebGL context');
    }
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.materials = createMaterials();
    this.sky = new SkyDome();
    this.sky.addTo(this.scene);
    this.skyColors = skyState(this.time, {
      top: new THREE.Color(),
      horizon: new THREE.Color(),
      bottom: new THREE.Color(),
      light: new THREE.Vector3(),
      intensity: 1,
      ambient: 0.4,
      hemiSky: new THREE.Color(),
      hemiGround: new THREE.Color(),
      sunVisible: true,
      moonVisible: false,
      exposure: 1,
      fog: new THREE.Color(),
    });
    this.hemi = new THREE.HemisphereLight('#cfe6ff', '#6d7a55', 0.7);
    this.ambient = new THREE.AmbientLight('#ffffff', 0.25);
    this.sun = new THREE.DirectionalLight('#fff4dd', 1.1);
    this.sun.castShadow = this.settings.graphics.shadows;
    this.sun.shadow.mapSize.set(this.settings.graphics.quality === 'high' ? 2048 : 1024, this.settings.graphics.quality === 'high' ? 2048 : 1024);
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 140;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.04;
    const shadowSize = 28;
    this.sun.shadow.camera.left = -shadowSize;
    this.sun.shadow.camera.right = shadowSize;
    this.sun.shadow.camera.top = shadowSize;
    this.sun.shadow.camera.bottom = -shadowSize;
    this.scene.add(this.hemi, this.ambient, this.sun, this.sun.target);
    this.scene.fog = new THREE.Fog('#d9eeff', 40, 120);
    this.body = {
      x: save.player.x,
      y: save.player.y,
      z: save.player.z,
      vx: 0,
      vy: 0,
      vz: 0,
      onGround: false,
      width: 0.62,
      height: 1.78,
      flying: this.flying,
    };
    this.highlight = this.makeBox(0xffffff, 0.15, true);
    this.preview = this.makeBox(0x7dffb3, 0.28, false);
    this.scene.add(this.highlight, this.preview);
    this.avatar = this.makeAvatar();
    this.scene.add(this.avatar);
    this.grid = new THREE.GridHelper(16, 16, 0xd9c7a3, 0x2f6b45);
    this.grid.visible = this.settings.ui.showGrid;
    this.scene.add(this.grid);
    const rainGeo = new THREE.BufferGeometry();
    const rainPositions = new Float32Array(500 * 3);
    for (let i = 0; i < 500; i += 1) {
      rainPositions[i * 3] = (Math.random() - 0.5) * 24;
      rainPositions[i * 3 + 1] = Math.random() * 16;
      rainPositions[i * 3 + 2] = (Math.random() - 0.5) * 24;
    }
    rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
    this.rain = new THREE.Points(rainGeo, new THREE.PointsMaterial({ color: '#e7f2f8', size: 0.07, transparent: true, opacity: 0.55 }));
    this.rain.visible = false;
    this.scene.add(this.rain);
    this.ensureSafe();
    this.applyGraphics();
    this.resize();
    this.bindInput();
    this.onResize = () => this.resize();
    window.addEventListener('resize', this.onResize);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.canvas);
    this.unsub = useSettings.subscribe((state) => {
      this.settings = {
        graphics: state.graphics,
        controls: state.controls,
        audio: state.audio,
        ui: state.ui,
        tutorialSeen: state.tutorialSeen,
        lastWorldId: state.lastWorldId,
      };
      this.applyGraphics();
    });
    useUi.getState().setSlots(cloneSlots(this.slots));
    useUi.getState().setWorldUi({
      ready: false,
      loading: 0.04,
      loadingLabel: 'Собираем ландшафт',
      fatal: null,
      touch: this.touch,
      time: this.time,
      timeRunning: this.timeRunning,
      weather: this.weather,
      lineMode: this.lineMode,
    });
    this.seedQueue(true);
    bindGame(this.api());
    this.publish(true);
  }

  start(): void {
    this.clock.start();
    this.frame();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    bindGame(null);
    this.unsub();
    window.removeEventListener('resize', this.onResize);
    this.resizeObserver?.disconnect();
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('wheel', this.onWheel);
    document.removeEventListener('pointerlockchange', this.onLock);
    document.removeEventListener('visibilitychange', this.onHide);
    window.removeEventListener('pagehide', this.onHide);
    this.canvas.removeEventListener('contextmenu', this.onContext);
    this.canvas.removeEventListener('click', this.onClick);
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
    void this.flush(true);
    for (const key of [...this.chunks.keys()]) this.removeChunk(key, true);
    for (const mesh of this.mobMeshes.values()) this.dropMobMesh(mesh);
    this.mobMeshes.clear();
    this.sky.dispose();
    this.highlight.traverse((obj) => { if (obj instanceof THREE.Mesh || obj instanceof THREE.LineSegments) obj.geometry.dispose(); });
    this.preview.traverse((obj) => { if (obj instanceof THREE.Mesh || obj instanceof THREE.LineSegments) obj.geometry.dispose(); });
    this.avatar.traverse((obj) => { if (obj instanceof THREE.Mesh) { obj.geometry.dispose(); (obj.material as THREE.Material).dispose(); } });
    this.grid.geometry.dispose();
    (this.grid.material as THREE.Material).dispose();
    this.rain.geometry.dispose();
    (this.rain.material as THREE.Material).dispose();
    disposeMaterials(this.materials);
    this.renderer.dispose();
    useUi.getState().setWorldUi({ ready: false, pointerLocked: false });
  }

  private api(): GameApi {
    return {
      setMove: (strafe, forward) => { this.touchStrafe = strafe; this.touchForward = forward; },
      addLook: (dx, dy) => { this.lookX += dx; this.lookY += dy; },
      setJump: (value) => {
        if (value && this.save.mode === 'creative') {
          const now = performance.now();
          if (now - this.lastJumpTap < 300) this.toggleFly();
          this.lastJumpTap = now;
        }
        this.touchJump = value;
      },
      setSprint: (value) => { this.sprintLatch = value; },
      setSneak: (value) => { this.touchSneak = value; },
      setBreaking: (value) => { this.breaking = value; if (!value) this.breakTime = 0; },
      setPlacing: (value) => { this.placing = value; if (value) { this.tryPlace(false); this.placeCooldown = 0.5; } },
      placeAt: (x, y) => this.placeAt(x, y),
      nudgeZoom: (amount) => this.nudgeZoom(amount),
      toggleFly: () => this.toggleFly(),
      selectSlot: (index) => this.selectSlot(index),
      setSlots: (slots) => { this.slots = cloneSlots(slots); useUi.getState().setSlots(this.slots); this.dirty = true; },
      setMode: (mode) => this.setMode(mode),
      pause: () => this.pause(),
      resume: () => this.resume(),
      save: () => this.flush(true, true),
      leave: () => this.leave(),
      respawnAtSpawn: () => this.teleportSpawn(false),
      setTime: (time) => { this.time = THREE.MathUtils.clamp(time, 0, 1); this.dirty = true; this.publish(true); },
      setTimeRunning: (value) => { this.timeRunning = value; this.dirty = true; this.publish(true); },
      setWeather: (weather) => { this.weather = weather; this.dirty = true; this.publish(true); },
      toggleLine: () => { this.lineMode = !this.lineMode; this.lastPlace = null; this.dirty = true; this.publish(true); },
      toggleCamera: () => this.toggleCamera(),
      photo: () => this.photo(),
    };
  }

  private bindInput(): void {
    const typing = (event: Event) => {
      const target = event.target;
      return target instanceof HTMLElement && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
    };
    this.onKeyDown = (event) => {
      if (this.disposed || typing(event)) return;
      this.keys.add(event.code);
      if (['Space', 'KeyE', 'F5', 'F3', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
      if (event.code === 'Escape') {
        event.preventDefault();
        this.handleEscape();
        return;
      }
      if (this.uiBlocked()) return;
      if (event.code.startsWith('Digit')) {
        const index = Number(event.code.slice(5)) - 1;
        if (index >= 0 && index < 9) this.selectSlot(index);
      }
      if (event.code === 'KeyE') this.openInventory();
      if (event.code === 'KeyC' && this.save.mode === 'creative') this.openCreative();
      if (event.code === 'KeyF') {
        if (this.save.mode === 'creative') this.toggleFly();
        else this.eat();
      }
      if (!event.repeat && (event.code === 'ControlLeft' || event.code === 'ControlRight')) this.sprintLatch = !this.sprintLatch;
      if (!event.repeat && (event.code === 'KeyW' || event.code === 'ArrowUp')) {
        const now = performance.now();
        if (now - this.lastForwardTap < 260) this.sprintLatch = true;
        this.lastForwardTap = now;
      }
      if (event.code === 'F5') this.toggleCamera();
      if (event.code === 'Minus' || event.code === 'NumpadSubtract') this.nudgeZoom(2.5);
      if (event.code === 'Equal' || event.code === 'NumpadAdd') this.nudgeZoom(-2.5);
      if (event.code === 'F3') {
        useSettings.getState().patch((settings) => ({ ...settings, ui: { ...settings.ui, showFps: !settings.ui.showFps } }));
      }
      if (event.code === 'Space' && this.save.mode === 'creative') {
        const now = performance.now();
        if (now - this.lastSpace < 280) this.toggleFly();
        this.lastSpace = now;
      }
    };
    this.onKeyUp = (event) => { this.keys.delete(event.code); };
    this.onMouseDown = (event) => {
      if (this.uiBlocked() || event.target !== this.canvas) return;
      if (this.viewDistance >= 1 && document.pointerLockElement !== this.canvas) {
        this.press = { x: event.clientX, y: event.clientY, button: event.button, moved: 0 };
        return;
      }
      if (document.pointerLockElement !== this.canvas) return;
      if (event.button === 0) { this.breaking = true; this.actionCooldown = 0; }
      if (event.button === 2) { this.placing = true; this.tryPlace(false); this.placeCooldown = 0.5; }
    };
    this.onMouseUp = (event) => {
      if (this.press && event.target === this.canvas) {
        const moved = Math.hypot(event.clientX - this.press.x, event.clientY - this.press.y);
        if (moved < 12 && (this.press.button === 0 || this.press.button === 2)) this.placeAt(event.clientX, event.clientY);
      }
      this.press = null;
      if (event.button === 0) { this.breaking = false; this.breakTime = 0; }
      if (event.button === 2) this.placing = false;
    };
    this.onMouseMove = (event) => {
      if (this.uiBlocked()) return;
      const sense = this.settings.controls.mouseSensitivity;
      const invert = this.settings.controls.invertY ? -1 : 1;
      if (this.press && this.viewDistance >= 1 && document.pointerLockElement !== this.canvas) {
        this.press.moved += Math.hypot(event.movementX, event.movementY);
        this.yaw -= event.movementX * 0.004 * sense;
        this.pitch = THREE.MathUtils.clamp(this.pitch - event.movementY * 0.004 * sense * invert, -1.52, 1.52);
        return;
      }
      if (document.pointerLockElement !== this.canvas) return;
      this.yaw -= event.movementX * 0.0022 * sense;
      this.pitch = THREE.MathUtils.clamp(this.pitch - event.movementY * 0.0022 * sense * invert, -1.52, 1.52);
    };
    this.onWheel = (event) => {
      if (this.uiBlocked()) return;
      event.preventDefault();
      this.nudgeZoom(event.deltaY > 0 ? 1.6 : -1.6);
    };
    this.onLock = () => {
      this.pointerLocked = document.pointerLockElement === this.canvas;
      useUi.getState().setWorldUi({ pointerLocked: this.pointerLocked });
    };
    this.onHide = () => {
      void this.flush(true, false);
      if (document.hidden && this.ready) this.pause();
    };
    this.onContext = (event) => event.preventDefault();
    this.onClick = () => {
      audio.unlock();
      if (!this.touch && this.ready && !this.uiBlocked() && this.viewDistance < 1) void this.canvas.requestPointerLock();
    };
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('wheel', this.onWheel, { passive: false });
    document.addEventListener('pointerlockchange', this.onLock);
    document.addEventListener('visibilitychange', this.onHide);
    window.addEventListener('pagehide', this.onHide);
    this.canvas.addEventListener('contextmenu', this.onContext);
    this.canvas.addEventListener('click', this.onClick);
  }

  private handleEscape(): void {
    const ui = useUi.getState();
    if (ui.inventoryOpen) { ui.setInventoryOpen(false); return; }
    if (ui.creativeOpen) { ui.setCreativeOpen(false); return; }
    if (ui.helpOpen) { ui.setHelpOpen(false); return; }
    if (ui.settingsOpen) { ui.setSettingsOpen(false); return; }
    if (!this.paused) this.pause();
    else this.resume();
  }

  private uiBlocked(): boolean {
    const ui = useUi.getState();
    return this.paused || ui.inventoryOpen || ui.settingsOpen || ui.helpOpen || ui.creativeOpen || !this.ready;
  }

  private controlActive(): boolean {
    return !this.uiBlocked();
  }

  private pause(): void {
    if (this.paused) return;
    this.paused = true;
    this.breaking = false;
    this.placing = false;
    this.sprintLatch = false;
    this.sprinting = false;
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
    useUi.getState().setPaused(true);
    void this.flush(true, false);
  }

  private resume(): void {
    this.paused = false;
    useUi.getState().setPaused(false);
    useUi.getState().setInventoryOpen(false);
    useUi.getState().setCreativeOpen(false);
    useUi.getState().setSettingsOpen(false);
    useUi.getState().setHelpOpen(false);
    if (!this.touch && this.viewDistance < 1) void this.canvas.requestPointerLock();
  }

  private openInventory(): void {
    audio.inventory();
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
    useUi.getState().setInventoryOpen(true);
  }

  private openCreative(): void {
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
    useUi.getState().setCreativeOpen(true);
  }

  private ensureWeapons(): void {
    const ids = ['wood_sword', 'stone_sword', 'iron_sword'].map((key) => blockId(key));
    ids.forEach((id, index) => {
      if (this.slots.some((slot) => slot.id === id && slot.count > 0)) return;
      const empty = this.slots.findIndex((slot, slotIndex) => slotIndex < 9 && (slot.id === 0 || slot.count <= 0));
      this.slots[empty >= 0 ? empty : 6 + index] = { id, count: 1 };
    });
  }

  private setMode(mode: GameMode): void {
    this.save.mode = mode;
    if (mode !== 'creative') {
      this.flying = false;
      this.body.flying = false;
      this.body.vy = 0;
    } else this.ensureWeapons();
    useUi.getState().setSlots(cloneSlots(this.slots));
    this.dirty = true;
    this.publish(true);
    useUi.getState().pushToast(mode === 'creative' ? 'Творческий режим. Клинки на панели.' : 'Выживание');
  }

  private toggleFly(): void {
    if (this.save.mode !== 'creative') return;
    this.flying = !this.flying;
    this.body.flying = this.flying;
    this.body.vy = 0;
    audio.ui();
    this.publish(true);
  }

  private toggleCamera(): void {
    this.nudgeZoom(this.viewDistance >= 1 ? -this.viewDistance : 14);
  }

  private nudgeZoom(amount: number): void {
    let next = this.viewDistance + amount;
    if (amount > 0 && this.viewDistance < 1) next = 6;
    if (amount < 0 && next < 2.5) next = 0;
    next = THREE.MathUtils.clamp(next, 0, 36);
    if (next >= 1 && document.pointerLockElement === this.canvas) document.exitPointerLock();
    this.viewDistance = next;
    this.cameraMode = next >= 1 ? 'third' : 'first';
    this.dirty = true;
    this.publish(true);
  }

  private reach(): number {
    return this.viewDistance >= 1 ? Math.min(56, this.viewDistance + 16) : REACH;
  }

  private rayFromScreen(clientX: number, clientY: number, reach: number): RayHit | null {
    const rect = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1,
      -((clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1,
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(ndc, this.camera);
    const { origin, direction } = raycaster.ray;
    const eye = this.eye();
    const minDist = Math.max(0, origin.distanceTo(eye) - 0.35);
    return raycastVoxel(origin.x, origin.y, origin.z, direction.x, direction.y, direction.z, reach, (x, y, z) => this.world.getBlock(x, y, z), (id) => id !== AIR, minDist);
  }

  private placeAt(x: number, y: number): void {
    if (this.uiBlocked() || !this.ready) return;
    const hit = this.rayFromScreen(x, y, Math.max(this.reach(), 28));
    if (!hit) return;
    this.hit = hit;
    this.tryPlace(false);
  }

  private selectSlot(index: number): void {
    this.slot = index;
    audio.ui();
    this.publish(true);
  }

  private eat(): void {
    if (this.save.mode !== 'survival') return;
    const stack = this.slots[this.slot];
    if (!stack || stack.id !== BERRIES || stack.count <= 0) return;
    this.slots = consumeFromSlot(this.slots, this.slot, 1);
    this.hunger = Math.min(20, this.hunger + 5);
    if (this.hunger >= 16 && this.health < 20) this.health += 1;
    useUi.getState().setSlots(this.slots);
    audio.play('plant');
    this.dirty = true;
    this.publish(true);
  }

  private frame = (): void => {
    if (this.disposed) return;
    requestAnimationFrame(this.frame);
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.materials.waterTime.value += dt;
    if (!this.ready) this.warmup();
    else if (!this.uiBlocked()) this.simulate(dt);
    else this.body.vx = this.body.vz = 0;
    this.stream(this.ready ? 1 : 2);
    this.updateVisuals(dt);
    this.updateTarget();
    if (this.ready) {
      this.saveTimer += dt;
      this.positionTimer += dt;
      if (this.positionTimer > 8) { this.positionTimer = 0; this.dirty = true; }
      if (this.dirty && this.saveTimer > 0.45 && !this.saving) void this.flush(false);
    }
    this.fpsFrames += 1;
    this.fpsTimer += dt;
    if (this.fpsTimer >= 0.5) {
      this.fps = this.fpsFrames / this.fpsTimer;
      this.fpsFrames = 0;
      this.fpsTimer = 0;
    }
    this.hudTimer += dt;
    if (this.hudTimer > 0.15) this.publish(false);
    this.renderer.render(this.scene, this.camera);
  };

  private warmup(): void {
    if (this.boot.size === 0) return;
    let done = 0;
    for (const key of this.boot) if (this.chunks.has(key)) done += 1;
    const progress = done / this.boot.size;
    useUi.getState().setWorldUi({ loading: Math.max(0.08, progress), loadingLabel: 'Собираем ландшафт' });
    if (done >= this.boot.size) {
      this.ready = true;
      this.ensureSafe();
      useUi.getState().setWorldUi({ ready: true, loading: 1, loadingLabel: 'Готово' });
      this.boot.clear();
      if (!useSettings.getState().tutorialSeen) useUi.getState().setHelpOpen(true);
      this.publish(true);
    }
  }

  private simulate(dt: number): void {
    if (!this.controlActive()) {
      this.body.vx = 0;
      this.body.vz = 0;
      this.body.flying = this.flying;
      stepBody(this.body, dt, this.collision());
      return;
    }
    const sense = this.touch ? this.settings.controls.touchSensitivity : 1;
    if (this.lookX || this.lookY) {
      this.yaw -= this.lookX * 0.0025 * sense;
      const invert = this.settings.controls.invertY ? -1 : 1;
      this.pitch = THREE.MathUtils.clamp(this.pitch - this.lookY * 0.0025 * sense * invert, -1.52, 1.52);
      this.lookX = 0;
      this.lookY = 0;
    }
    const forward = (this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 1 : 0) - (this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0) + this.touchForward;
    const strafe = (this.keys.has('KeyD') || this.keys.has('ArrowRight') ? 1 : 0) - (this.keys.has('KeyA') || this.keys.has('ArrowLeft') ? 1 : 0) + this.touchStrafe;
    const fx = -Math.sin(this.yaw);
    const fz = -Math.cos(this.yaw);
    const rx = Math.cos(this.yaw);
    const rz = -Math.sin(this.yaw);
    let mx = fx * forward + rx * strafe;
    let mz = fz * forward + rz * strafe;
    const mag = Math.hypot(mx, mz);
    if (mag > 1) { mx /= mag; mz /= mag; }
    const sneak = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') || this.touchSneak;
    if (sneak) this.sprintLatch = false;
    if (!this.flying && forward <= 0.05 && this.sprinting) this.sprintLatch = false;
    this.sprinting = this.sprintLatch && !sneak && (this.flying || forward > 0.15);
    this.setHeight(sneak && !this.flying ? 1.45 : 1.78);
    const pace = this.sprinting ? 1.75 : 1;
    const speed = (this.flying ? this.settings.controls.flySpeed * (this.sprintLatch ? 1.65 : 1) : 4.5 * this.settings.controls.moveSpeed * (this.sprinting ? pace : sneak ? 0.42 : 1));
    this.body.vx = mx * speed;
    this.body.vz = mz * speed;
    this.body.flying = this.flying;
    const jump = this.keys.has('Space') || this.touchJump;
    if (this.flying) {
      const up = (this.keys.has('Space') || this.touchJump ? 1 : 0) - (sneak ? 1 : 0);
      this.body.vy = up * this.settings.controls.flySpeed;
    } else if (jump && this.body.onGround && !this.jumpHeld) {
      this.body.vy = JUMP_SPEED;
      audio.jump();
    }
    this.jumpHeld = jump;
    const beforeX = this.body.x;
    const beforeY = this.body.y;
    const beforeZ = this.body.z;
    stepBody(this.body, dt, this.collision());
    nudgeOut(this.body, this.collision());
    if (!this.flying && this.body.onGround && mag > 0.25) {
      const moved = Math.hypot(this.body.x - beforeX, this.body.z - beforeZ);
      const tx = Math.floor(this.body.x + mx * 0.6);
      const tz = Math.floor(this.body.z + mz * 0.6);
      const ty = Math.floor(this.body.y + 0.15);
      const wall = isCollidable(this.world.getBlock(tx, ty, tz));
      const head = isCollidable(this.world.getBlock(tx, ty + 1, tz));
      const ceiling = isCollidable(this.world.getBlock(Math.floor(this.body.x), Math.floor(this.body.y + this.body.height + 0.05), Math.floor(this.body.z)));
      if (moved < speed * dt * 0.25 && wall && !head && !ceiling) this.body.vy = JUMP_SPEED * 0.86;
    }
    this.afterPhysics(dt, beforeY);
    this.updateMobs(dt);
    if (this.timeRunning) this.time = (this.time + dt / 360) % 1;
    this.updateBreaking(dt);
    if (this.placing) {
      this.placeCooldown -= dt;
      if (this.placeCooldown <= 0) { this.tryPlace(true); this.placeCooldown = 0.16; }
    }
    if (this.save.mode === 'survival') this.updateSurvival(dt, mag);
  }

  private setHeight(next: number): void {
    if (next === this.body.height) return;
    const previous = this.body.height;
    this.body.height = next;
    if (overlapsSolids(this.body, this.collision())) this.body.height = previous;
  }

  private afterPhysics(dt: number, beforeY: number): void {
    if (this.save.mode !== 'survival' || this.flying) { this.fall = 0; return; }
    const feet = this.world.getBlock(Math.floor(this.body.x), Math.floor(this.body.y), Math.floor(this.body.z));
    const wet = getBlockDef(feet)?.liquid === true;
    if (wet || this.body.vy > 0) this.fall = 0;
    else if (!this.body.onGround && this.body.y < beforeY) this.fall += beforeY - this.body.y;
    if (this.body.onGround && this.fall > 3.2) {
      this.health = Math.max(0, this.health - Math.floor(this.fall - 3));
      this.fall = 0;
      if (this.health <= 0) this.death();
    } else if (this.body.onGround) this.fall = 0;
    void dt;
  }

  private updateSurvival(dt: number, moving: number): void {
    this.hungerTimer += dt * (moving > 0.2 ? 1 : 0.35);
    if (this.hungerTimer > 26) {
      this.hungerTimer = 0;
      this.hunger = Math.max(0, this.hunger - 1);
      this.dirty = true;
    }
    if (this.hunger <= 0) {
      this.starveTimer += dt;
      if (this.starveTimer > 4) {
        this.starveTimer = 0;
        this.health = Math.max(0, this.health - 1);
        if (this.health <= 0) this.death();
      }
    }
  }

  private death(): void {
    this.health = 20;
    this.hunger = 14;
    this.teleportSpawn(true);
    useUi.getState().pushToast('Вы возродились');
  }

  private teleportSpawn(resetVitals: boolean): void {
    this.body.x = this.save.spawn.x;
    this.body.y = this.save.spawn.y;
    this.body.z = this.save.spawn.z;
    this.body.vx = this.body.vy = this.body.vz = 0;
    this.fall = 0;
    this.ensureSafe();
    if (!resetVitals) useUi.getState().pushToast('Вы у точки появления');
    this.dirty = true;
    this.publish(true);
  }

  private solidAt(x: number, y: number, z: number): boolean {
    return isCollidable(this.world.getBlock(x, y, z));
  }

  private updateMobs(dt: number): void {
    const night = isNight(this.time);
    if (night) {
      this.mobTimer += dt;
      if (this.mobTimer > 6 && this.mobs.length < 4) {
        this.mobTimer = 0;
        this.spawnZombie();
      }
    }
    const bite = stepMobs(this.mobs, dt, this.body, (x, y, z) => this.solidAt(x, y, z), night);
    if (bite > 0) {
      this.health = Math.max(0, this.health - bite);
      audio.hurt();
      this.dirty = true;
      if (this.health <= 0) this.death();
    }
    for (let i = this.mobs.length - 1; i >= 0; i -= 1) {
      const mob = this.mobs[i];
      if (!mob) continue;
      const far = Math.hypot(mob.x - this.body.x, mob.z - this.body.z) > 64;
      if (mob.health <= 0 || far) {
        if (mob.health <= 0 && this.save.mode === 'survival') {
          const loot = addItem(this.slots, blockId('sticks'), 1);
          if (loot.added > 0) {
            this.slots = loot.slots;
            useUi.getState().setSlots(this.slots);
          }
        }
        this.mobs.splice(i, 1);
        if (this.aimed?.id === mob.id) this.aimed = null;
      }
    }
    this.syncMobs();
  }

  private spawnZombie(): void {
    const angle = Math.random() * Math.PI * 2;
    const dist = 14 + Math.random() * 12;
    const x = this.body.x + Math.cos(angle) * dist;
    const z = this.body.z + Math.sin(angle) * dist;
    let y = Math.floor(this.body.y) + 6;
    for (let i = 0; i < 18; i += 1) {
      const fx = Math.floor(x);
      const fz = Math.floor(z);
      const ground = this.solidAt(fx, y - 1, fz);
      const feet = this.solidAt(fx, y, fz);
      const head = this.solidAt(fx, y + 1, fz);
      const wet = getBlockDef(this.world.getBlock(fx, y - 1, fz))?.liquid === true;
      if (ground && !feet && !head && !wet) {
        this.mobs.push({ id: this.nextMob, x: fx + 0.5, y, z: fz + 0.5, health: ZOMBIE_HEALTH, cooldown: 0.6, hurt: 0 });
        this.nextMob += 1;
        return;
      }
      y -= 1;
    }
  }

  private strike(mob: Mob): void {
    const held = this.slots[this.slot]?.id ?? 0;
    mob.health -= weaponDamage(held);
    mob.hurt = 0.18;
    this.swing = swingTime(held);
    audio.hit();
    if (mob.health <= 0) this.toastSoon('Зомби повержен');
  }

  private syncMobs(): void {
    const alive = new Set(this.mobs.map((mob) => mob.id));
    for (const [id, mesh] of this.mobMeshes) {
      if (alive.has(id)) continue;
      this.dropMobMesh(mesh);
      this.mobMeshes.delete(id);
    }
    for (const mob of this.mobs) {
      let mesh = this.mobMeshes.get(mob.id);
      if (!mesh) {
        mesh = makeZombieMesh();
        this.mobMeshes.set(mob.id, mesh);
        this.scene.add(mesh);
      }
      poseZombie(mesh, mob, this.body.x, this.body.z);
    }
  }

  private dropMobMesh(mesh: THREE.Group): void {
    this.scene.remove(mesh);
    mesh.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      obj.geometry.dispose();
      if (obj.material instanceof THREE.Material) obj.material.dispose();
    });
  }

  private updateBreaking(dt: number): void {
    this.swing = Math.max(0, this.swing - dt);
    if (this.breaking && this.aimed && this.aimed.health > 0) {
      this.breakTime = 0;
      if (this.swing <= 0) this.strike(this.aimed);
      return;
    }
    if (!this.breaking || !this.hit) { this.breakTime = 0; return; }
    const id = this.world.getBlock(this.hit.x, this.hit.y, this.hit.z);
    if (!isBreakable(this.hit.x, this.hit.y, this.hit.z, id) || this.hit.distance > this.reach()) {
      this.breakTime = 0;
      return;
    }
    if (this.save.mode === 'creative') {
      this.actionCooldown -= dt;
      if (this.actionCooldown <= 0) { this.removeBlock(this.hit, id); this.actionCooldown = 0.09; }
      return;
    }
    const key = `${this.hit.x},${this.hit.y},${this.hit.z}`;
    if (key !== this.breakKey) { this.breakKey = key; this.breakTime = 0; }
    const hardness = getBlockDef(id)?.hardness ?? 0.5;
    this.breakTime += dt;
    useUi.getState().setHud({ breaking: Math.min(1, this.breakTime / hardness) });
    if (this.breakTime >= hardness) {
      this.removeBlock(this.hit, id);
      this.breakTime = 0;
    }
  }

  private removeBlock(hit: RayHit, id: number): void {
    const def = getBlockDef(id);
    if (!def) return;
    if (this.save.mode === 'survival') {
      const added = addItem(this.slots, id, 1);
      if (added.added < 1) { useUi.getState().pushToast('Недостаточно места'); return; }
      this.slots = added.slots;
      if (def.key.endsWith('leaves') && hashSeed(`${hit.x}${hit.y}${hit.z}`) % 100 < 18) {
        const berries = addItem(this.slots, BERRIES, 1);
        if (berries.added > 0) this.slots = berries.slots;
      }
      useUi.getState().setSlots(this.slots);
    }
    this.world.setBlock(hit.x, hit.y, hit.z, AIR);
    this.remesh(hit.x, hit.y, hit.z);
    audio.play(def.sound);
    this.burst(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5, def.faces.top);
    this.dirty = true;
    this.saveTimer = 0;
    this.toastSoon('Блок разрушен');
  }

  private tryPlace(quiet: boolean): void {
    if (!quiet && performance.now() < this.placeLock) return;
    if (!this.hit || this.uiBlocked()) return;
    const stack = this.slots[this.slot];
    if (!stack || stack.count <= 0 || stack.id === 0) { if (!quiet) useUi.getState().pushToast('Нет подходящего блока'); return; }
    const def = getBlockDef(stack.id);
    if (!def?.placeable) { if (!quiet) useUi.getState().pushToast('Нет подходящего блока'); return; }
    const cell = targetCell(this.hit, (x, y, z) => this.world.getBlock(x, y, z));
    const cells = this.lineMode && this.lastPlace ? axisLine(this.lastPlace, cell) : [cell];
    let placed = 0;
    let guard = this.save.mode === 'creative' ? 64 : stack.count;
    for (const pos of cells) {
      if (guard <= 0) break;
      if (pos.y <= 0 || pos.y >= WORLD_HEIGHT) continue;
      if (!canPlaceAt(pos.x, pos.y, pos.z, stack.id, (x, y, z) => this.world.getBlock(x, y, z), this.body, WORLD_HEIGHT)) continue;
      if (!this.world.setBlock(pos.x, pos.y, pos.z, stack.id)) continue;
      this.remesh(pos.x, pos.y, pos.z);
      placed += 1;
      guard -= 1;
      this.lastPlace = pos;
    }
    if (!placed) { if (!quiet) useUi.getState().pushToast('Невозможно установить здесь'); return; }
    this.placeLock = performance.now() + 320;
    if (this.save.mode === 'survival') {
      this.slots = consumeFromSlot(this.slots, this.slot, placed);
      useUi.getState().setSlots(this.slots);
    }
    if (!this.lineMode) this.lastPlace = cell;
    audio.place();
    this.dirty = true;
    this.saveTimer = 0;
    this.toastSoon('Блок установлен');
  }

  private toastSoon(text: string): void {
    useUi.getState().pushToast(text);
  }

  private remesh(x: number, y: number, z: number): void {
    for (const key of affectedChunkKeys(x, y, z)) {
      const [cx, cz] = key.split(',').map(Number);
      if (cx === undefined || cz === undefined) continue;
      if (this.chunks.has(key) || this.boot.has(key)) this.rebuild(cx, cz);
    }
  }

  private updateTarget(): void {
    if (!this.ready || this.uiBlocked()) { this.hit = null; this.aimed = null; this.highlight.visible = false; this.preview.visible = false; return; }
    const eye = this.eye();
    const look = lookOf(this.yaw, this.pitch);
    this.hit = raycastVoxel(eye.x, eye.y, eye.z, look.x, look.y, look.z, this.reach(), (x, y, z) => this.world.getBlock(x, y, z), (id) => id !== AIR);
    const melee = Math.min(3.4, this.reach());
    const picked = pickMob(this.mobs, eye.x, eye.y, eye.z, look.x, look.y, look.z, melee);
    this.aimed = picked && (!this.hit || picked.distance < this.hit.distance) ? picked.mob : null;
    if (!this.hit) {
      this.highlight.visible = false;
      this.preview.visible = false;
      return;
    }
    const def = getBlockDef(this.world.getBlock(this.hit.x, this.hit.y, this.hit.z));
    const tall = def?.shape === 'slab' ? 0.5 : 1;
    this.highlight.visible = true;
    this.highlight.position.set(this.hit.x + 0.5, this.hit.y + tall / 2, this.hit.z + 0.5);
    this.highlight.scale.set(1.002, tall * 1.002, 1.002);
    const stack = this.slots[this.slot];
    const placeDef = stack ? getBlockDef(stack.id) : null;
    if (!placeDef?.placeable) { this.preview.visible = false; return; }
    const cell = targetCell(this.hit, (x, y, z) => this.world.getBlock(x, y, z));
    const ok = canPlaceAt(cell.x, cell.y, cell.z, placeDef.id, (x, y, z) => this.world.getBlock(x, y, z), this.body, WORLD_HEIGHT);
    const placeTall = placeDef.shape === 'slab' ? 0.5 : 1;
    this.preview.visible = true;
    this.preview.position.set(cell.x + 0.5, cell.y + placeTall / 2, cell.z + 0.5);
    this.preview.scale.set(1, placeTall, 1);
    const color = ok ? 0x7dffb3 : 0xff6b6b;
    this.preview.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.material instanceof THREE.MeshBasicMaterial) obj.material.color.setHex(color);
      if (obj instanceof THREE.LineSegments && obj.material instanceof THREE.LineBasicMaterial) obj.material.color.setHex(color);
    });
  }

  private updateVisuals(dt: number): void {
    skyState(this.time, this.skyColors);
    const anchor = new THREE.Vector3(this.body.x, this.body.y, this.body.z);
    const effects = this.settings.graphics.effects !== 'low';
    this.sky.update(this.skyColors, anchor, this.time, effects);
    this.renderer.toneMappingExposure = this.skyColors.exposure;
    this.sun.intensity = this.skyColors.intensity;
    this.sun.position.copy(anchor).addScaledVector(this.skyColors.light, 48);
    this.sun.target.position.copy(anchor);
    this.sun.color.set(this.skyColors.sunVisible ? '#fff1d2' : '#9eb4d8');
    this.hemi.intensity = this.skyColors.ambient;
    this.hemi.color.copy(this.skyColors.hemiSky);
    this.hemi.groundColor.copy(this.skyColors.hemiGround);
    this.ambient.intensity = 0.18 + (1 - Number(this.skyColors.sunVisible)) * 0.12;
    const fog = this.scene.fog as THREE.Fog;
    fog.color.copy(this.skyColors.fog);
    const distance = Math.min(renderDistanceChunks(this.settings.graphics.renderDistance), this.world.radius);
    fog.near = Math.max(12, (distance - 1.2) * 16);
    fog.far = Math.max((distance + 0.35) * 16, this.viewDistance + 32);
    const eye = this.eye();
    const eyeBlock = getBlockDef(this.world.getBlock(Math.floor(eye.x), Math.floor(eye.y), Math.floor(eye.z)));
    if (eyeBlock?.liquid) fog.color.set('#3d88b0');
    const look = lookOf(this.yaw, this.pitch);
    if (this.viewDistance >= 0.35) {
      const back = look.clone().multiplyScalar(-1);
      const clip = raycastVoxel(eye.x, eye.y, eye.z, back.x, back.y, back.z, this.viewDistance + 0.6, (x, y, z) => this.world.getBlock(x, y, z), isCollidable);
      let dist = clip ? Math.max(1.35, Math.min(this.viewDistance, clip.distance - 0.65)) : this.viewDistance;
      const pos = eye.clone().addScaledVector(back, dist);
      for (let i = 0; i < 5; i += 1) {
        const id = this.world.getBlock(Math.floor(pos.x), Math.floor(pos.y), Math.floor(pos.z));
        if (!isCollidable(id)) break;
        dist = Math.max(1.2, dist * 0.62);
        pos.copy(eye).addScaledVector(back, dist);
      }
      this.camera.position.copy(pos);
      this.camera.lookAt(eye);
      this.avatar.visible = true;
      this.avatar.position.set(this.body.x, this.body.y, this.body.z);
      this.avatar.rotation.y = Math.atan2(look.x, look.z);
    } else {
      this.camera.position.copy(eye);
      this.camera.lookAt(eye.clone().add(look));
      this.avatar.visible = false;
    }
    this.grid.visible = this.settings.ui.showGrid;
    this.grid.position.set(Math.floor(this.body.x) + 0.5, Math.floor(this.body.y) + 0.03, Math.floor(this.body.z) + 0.5);
    this.rain.visible = this.weather === 'rain' && this.settings.graphics.effects !== 'low';
    if (this.rain.visible) {
      const positions = this.rain.geometry.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < positions.count; i += 1) {
        let y = positions.getY(i) - dt * 18;
        if (y < 0) y = 16;
        positions.setXYZ(i, positions.getX(i), y, positions.getZ(i));
      }
      positions.needsUpdate = true;
      this.rain.position.set(this.body.x, this.body.y, this.body.z);
    }
  }

  private eye(): THREE.Vector3 {
    return new THREE.Vector3(this.body.x, this.body.y + this.body.height - 0.14, this.body.z);
  }

  private collision() {
    return { boxesAt: (x: number, y: number, z: number) => collisionBoxes(this.world.getBlock(x, y, z), x, y, z) };
  }

  private ensureSafe(): void {
    let guard = 0;
    while (overlapsSolids(this.body, this.collision()) && guard < 48) {
      this.body.y += 0.2;
      guard += 1;
    }
  }

  private seedQueue(boot: boolean): void {
    const pcx = Math.floor(this.body.x / 16);
    const pcz = Math.floor(this.body.z / 16);
    const radius = boot ? Math.min(2, this.world.radius, renderDistanceChunks(this.settings.graphics.renderDistance)) : Math.min(renderDistanceChunks(this.settings.graphics.renderDistance), this.world.radius);
    const list: { cx: number; cz: number; dist: number }[] = [];
    for (let dz = -radius; dz <= radius; dz += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        if (dx * dx + dz * dz > radius * radius + 1) continue;
        const cx = pcx + dx;
        const cz = pcz + dz;
        if (!this.world.inBounds(cx, cz)) continue;
        const key = chunkKey(cx, cz);
        if (boot) this.boot.add(key);
        if (!this.chunks.has(key)) list.push({ cx, cz, dist: dx * dx + dz * dz });
      }
    }
    list.sort((a, b) => a.dist - b.dist);
    this.queue.splice(0, this.queue.length, ...list);
  }

  private stream(budget: number): void {
    const pcx = Math.floor(this.body.x / 16);
    const pcz = Math.floor(this.body.z / 16);
    const radius = Math.min(renderDistanceChunks(this.settings.graphics.renderDistance), this.world.radius);
    const needed = new Set<string>();
    for (let dz = -radius; dz <= radius; dz += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        if (dx * dx + dz * dz > radius * radius + 1) continue;
        const cx = pcx + dx;
        const cz = pcz + dz;
        if (!this.world.inBounds(cx, cz)) continue;
        const key = chunkKey(cx, cz);
        needed.add(key);
        if (!this.chunks.has(key) && !this.queue.some((job) => job.cx === cx && job.cz === cz)) {
          this.queue.push({ cx, cz, dist: dx * dx + dz * dz });
        }
      }
    }
    this.queue.sort((a, b) => a.dist - b.dist);
    for (const key of this.chunks.keys()) {
      if (needed.has(key) || this.boot.has(key)) continue;
      this.removeChunk(key, false);
      const [cx, cz] = key.split(',').map(Number);
      if (cx === undefined || cz === undefined) continue;
      if (Math.max(Math.abs(cx - pcx), Math.abs(cz - pcz)) > radius + 2) this.world.unload(cx, cz);
    }
    let left = budget;
    while (left > 0 && this.queue.length > 0) {
      const job = this.queue.shift();
      if (!job) break;
      if (!needed.has(chunkKey(job.cx, job.cz)) && !this.boot.has(chunkKey(job.cx, job.cz))) continue;
      this.rebuild(job.cx, job.cz);
      left -= 1;
    }
  }

  private rebuild(cx: number, cz: number): void {
    const key = chunkKey(cx, cz);
    try {
      const data = meshChunk(cx, cz, (x, y, z) => this.world.getBlock(x, y, z));
      this.removeChunk(key, false);
      const group = new THREE.Group();
      group.position.set(cx * 16, 0, cz * 16);
      const shadows = this.settings.graphics.shadows;
      const add = (buffers: ChunkBuffers | null, material: THREE.Material, cast: boolean) => {
        if (!buffers) return;
        const mesh = new THREE.Mesh(geometryFrom(buffers), material);
        mesh.castShadow = shadows && cast;
        mesh.receiveShadow = shadows;
        group.add(mesh);
      };
      add(data.opaque, this.materials.opaque, true);
      add(data.cutout, this.materials.cutout, true);
      add(data.glow, this.materials.glow, false);
      add(data.glass, this.materials.glass, false);
      add(data.water, this.materials.water, false);
      this.scene.add(group);
      this.chunks.set(key, group);
    } catch (error) {
      console.error('Чанк пропущен', cx, cz, error);
      this.chunks.set(key, new THREE.Group());
    }
  }

  private removeChunk(key: string, unload: boolean): void {
    const group = this.chunks.get(key);
    if (!group) return;
    group.traverse((obj) => { if (obj instanceof THREE.Mesh) obj.geometry.dispose(); });
    this.scene.remove(group);
    this.chunks.delete(key);
    if (unload) {
      const [cx, cz] = key.split(',').map(Number);
      if (cx !== undefined && cz !== undefined) this.world.unload(cx, cz);
    }
  }

  private applyGraphics(): void {
    audio.masterVolume = this.settings.audio.master;
    audio.effectsVolume = this.settings.audio.effects;
    audio.muted = this.settings.audio.muted;
    audio.apply();
    const cap = this.touch ? 1.15 : this.settings.graphics.quality === 'high' ? 1.6 : this.settings.graphics.quality === 'low' ? 1 : 1.3;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, cap));
    this.renderer.shadowMap.enabled = this.settings.graphics.shadows;
    this.sun.castShadow = this.settings.graphics.shadows;
    const size = this.settings.graphics.quality === 'high' ? 2048 : 1024;
    this.sun.shadow.mapSize.set(size, size);
    this.grid.visible = this.settings.ui.showGrid;
    document.documentElement.dataset.theme = this.settings.ui.theme;
    this.resize();
  }

  private resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width || this.canvas.clientWidth || window.innerWidth));
    const height = Math.max(1, Math.round(rect.height || this.canvas.clientHeight || window.innerHeight));
    const aspect = width / height;
    this.camera.aspect = aspect;
    this.camera.fov = aspect >= 1 ? 70 : 50;
    this.camera.near = 0.18;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  private publish(resetTimer: boolean): void {
    if (resetTimer) this.hudTimer = 0;
    const blockName = this.aimed ? 'Зомби' : this.hit ? getBlockDef(this.world.getBlock(this.hit.x, this.hit.y, this.hit.z))?.name ?? '' : '';
    useUi.getState().setHud({
      health: this.health,
      hunger: this.hunger,
      slot: this.slot,
      flying: this.flying,
      sprinting: this.sprinting,
      blockName,
      save: this.saving ? 'saving' : this.dirty ? 'saving' : 'saved',
      fps: this.fps,
      x: this.body.x,
      y: this.body.y,
      z: this.body.z,
      mode: this.save.mode,
      breaking: this.breakTime > 0 && this.hit ? Math.min(1, this.breakTime / (getBlockDef(this.world.getBlock(this.hit.x, this.hit.y, this.hit.z))?.hardness || 1)) : 0,
      camera: this.cameraMode,
      zoom: this.viewDistance,
    });
    useUi.getState().setWorldUi({
      time: this.time,
      timeRunning: this.timeRunning,
      weather: this.weather,
      lineMode: this.lineMode,
      touch: this.touch,
      pointerLocked: this.pointerLocked,
    });
  }

  private snapshot(thumb: boolean): WorldSave {
    let thumbnail = this.save.thumbnail;
    if (thumb) {
      try {
        const copy = document.createElement('canvas');
        copy.width = 192;
        copy.height = 108;
        const ctx = copy.getContext('2d');
        if (ctx) {
          ctx.drawImage(this.renderer.domElement, 0, 0, 192, 108);
          thumbnail = copy.toDataURL('image/jpeg', 0.62);
        }
      } catch {
        thumbnail = this.save.thumbnail;
      }
    }
    return {
      ...this.save,
      updatedAt: Date.now(),
      time: this.time,
      timeRunning: this.timeRunning,
      weather: this.weather,
      lineMode: this.lineMode,
      thumbnail,
      inventory: cloneSlots(this.slots),
      edits: this.world.edits.toArray(),
      player: {
        x: this.body.x,
        y: this.body.y,
        z: this.body.z,
        yaw: this.yaw,
        pitch: this.pitch,
        health: this.health,
        hunger: this.hunger,
        flying: this.flying,
        slot: this.slot,
        camera: this.cameraMode,
      },
    };
  }

  private async flush(manual: boolean, announce = false): Promise<void> {
    if (this.saving) return;
    if (!this.dirty && !manual) return;
    this.saving = true;
    this.dirty = false;
    this.saveTimer = 0;
    useUi.getState().setHud({ save: 'saving' });
    try {
      const next = this.snapshot(manual);
      await putWorld(next);
      this.save.time = next.time;
      this.save.timeRunning = next.timeRunning;
      this.save.weather = next.weather;
      this.save.lineMode = next.lineMode;
      this.save.inventory = next.inventory;
      this.save.edits = next.edits;
      this.save.player = next.player;
      this.save.thumbnail = next.thumbnail;
      this.save.updatedAt = next.updatedAt;
      useUi.getState().setHud({ save: 'saved' });
      if (announce) useUi.getState().pushToast('Мир сохранён');
    } catch (error) {
      console.error(error);
      this.dirty = true;
      useUi.getState().setHud({ save: 'error' });
      useUi.getState().pushToast('Ошибка сохранения');
    } finally {
      this.saving = false;
    }
  }

  private async leave(): Promise<void> {
    await this.flush(true, false);
    useSettings.getState().patch((settings) => ({ ...settings, lastWorldId: this.save.id }));
    useUi.getState().setPaused(false);
    useUi.getState().setInventoryOpen(false);
    useUi.getState().setScreen('menu');
  }

  private photo(): void {
    this.renderer.render(this.scene, this.camera);
    const link = document.createElement('a');
    link.href = this.renderer.domElement.toDataURL('image/png');
    link.download = `mosspeak-${Date.now()}.png`;
    link.click();
  }

  private burst(x: number, y: number, z: number, _tile: string): void {
    const geo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
    const mat = new THREE.MeshBasicMaterial({ color: '#d9c7a3' });
    for (let i = 0; i < 6; i += 1) {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y, z);
      const vx = (Math.random() - 0.5) * 2;
      const vy = Math.random() * 2.4;
      const vz = (Math.random() - 0.5) * 2;
      this.scene.add(mesh);
      const start = performance.now();
      const tick = () => {
        if (this.disposed) return;
        const t = (performance.now() - start) / 1000;
        mesh.position.set(x + vx * t, y + vy * t - 6 * t * t, z + vz * t);
        if (t > 0.45) {
          this.scene.remove(mesh);
          return;
        }
        requestAnimationFrame(tick);
      };
      tick();
    }
    window.setTimeout(() => { geo.dispose(); mat.dispose(); }, 700);
  }

  private makeBox(color: number, opacity: number, wireOnly: boolean): THREE.Group {
    const group = new THREE.Group();
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    if (!wireOnly) {
      const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false }));
      group.add(mesh);
    }
    const lines = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), new THREE.LineBasicMaterial({ color }));
    group.add(lines);
    group.visible = false;
    return group;
  }

  private makeAvatar(): THREE.Group {
    const group = new THREE.Group();
    const cloth = new THREE.MeshLambertMaterial({ color: '#2f6b45' });
    const skin = new THREE.MeshLambertMaterial({ color: '#e6d3b3' });
    const pants = new THREE.MeshLambertMaterial({ color: '#3d4c59' });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.72, 0.28), cloth);
    body.position.y = 1.05;
    body.castShadow = true;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), skin);
    head.position.y = 1.62;
    head.castShadow = true;
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.7, 0.18), pants);
    legL.position.set(-0.12, 0.35, 0);
    const legR = legL.clone();
    legR.position.x = 0.12;
    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.64, 0.16), cloth);
    armL.position.set(-0.36, 1.05, 0);
    const armR = armL.clone();
    armR.position.x = 0.36;
    group.add(body, head, legL, legR, armL, armR);
    group.visible = false;
    return group;
  }
}
