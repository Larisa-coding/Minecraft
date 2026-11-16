import type { GameMode, TerrainKind, WorldSize } from '../game/world/constants';
import type { Slot } from '../game/inventory/inventory';

export interface PlayerSave {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  health: number;
  hunger: number;
  flying: boolean;
  slot: number;
  camera: 'first' | 'third';
}

export interface WorldSave {
  version: 1;
  id: string;
  name: string;
  seed: string;
  mode: GameMode;
  size: WorldSize;
  terrain: TerrainKind;
  generatorVersion: number;
  createdAt: number;
  updatedAt: number;
  time: number;
  timeRunning: boolean;
  weather: 'clear' | 'rain';
  lineMode: boolean;
  spawn: { x: number; y: number; z: number };
  player: PlayerSave;
  inventory: Slot[];
  edits: number[];
  thumbnail?: string;
  checksum?: string;
}

export interface WorldMeta {
  id: string;
  name: string;
  seed: string;
  mode: GameMode;
  size: WorldSize;
  terrain: TerrainKind;
  createdAt: number;
  updatedAt: number;
  thumbnail?: string;
  damaged?: boolean;
}
