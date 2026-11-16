import { GENERATOR_VERSION, SAVE_VERSION } from '../game/version';
import { sanitizeSlots } from '../game/inventory/inventory';
import { checksumString } from '../utils/hash';
import type { GameMode, TerrainKind, WorldSize } from '../game/world/constants';
import type { PlayerSave, WorldSave } from './types';

const TERRAINS: TerrainKind[] = ['plains', 'forest', 'mountains', 'desert', 'islands', 'mixed'];
const SIZES: WorldSize[] = ['small', 'medium', 'large'];
const MODES: GameMode[] = ['creative', 'survival'];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const num = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const str = (value: unknown, fallback = ''): string => (typeof value === 'string' ? value : fallback);

const sortEdits = (edits: number[]): number[] => {
  const map = new Map<string, [number, number, number, number]>();
  for (let i = 0; i + 3 < edits.length; i += 4) {
    const x = edits[i];
    const y = edits[i + 1];
    const z = edits[i + 2];
    const id = edits[i + 3];
    if (x === undefined || y === undefined || z === undefined || id === undefined) continue;
    if (![x, y, z, id].every(Number.isFinite)) continue;
    map.set(`${x | 0},${y | 0},${z | 0}`, [x | 0, y | 0, z | 0, id | 0]);
  }
  return [...map.values()]
    .sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2])
    .flat();
};

export const canonicalPayload = (save: WorldSave): string =>
  JSON.stringify({
    version: save.version,
    id: save.id,
    name: save.name,
    seed: save.seed,
    mode: save.mode,
    size: save.size,
    terrain: save.terrain,
    generatorVersion: save.generatorVersion,
    createdAt: save.createdAt,
    updatedAt: save.updatedAt,
    time: save.time,
    timeRunning: save.timeRunning,
    weather: save.weather,
    lineMode: save.lineMode,
    spawn: { x: save.spawn.x, y: save.spawn.y, z: save.spawn.z },
    player: {
      x: save.player.x,
      y: save.player.y,
      z: save.player.z,
      yaw: save.player.yaw,
      pitch: save.player.pitch,
      health: save.player.health,
      hunger: save.player.hunger,
      flying: save.player.flying,
      slot: save.player.slot,
      camera: save.player.camera,
    },
    inventory: save.inventory.map((slot) => ({ id: slot.id, count: slot.count })),
    edits: save.edits,
  });

export const withChecksum = (save: WorldSave): WorldSave => {
  const next = { ...save, edits: sortEdits(save.edits), inventory: sanitizeSlots(save.inventory) };
  next.checksum = checksumString(canonicalPayload(next));
  return next;
};

const playerOf = (value: unknown): PlayerSave => {
  const data = isRecord(value) ? value : {};
  return {
    x: num(data.x, 0.5),
    y: num(data.y, 40),
    z: num(data.z, 0.5),
    yaw: num(data.yaw, 0),
    pitch: num(data.pitch, 0),
    health: Math.max(0, Math.min(20, num(data.health, 20))),
    hunger: Math.max(0, Math.min(20, num(data.hunger, 20))),
    flying: data.flying === true,
    slot: Math.max(0, Math.min(8, num(data.slot, 0) | 0)),
    camera: data.camera === 'third' ? 'third' : 'first',
  };
};

export const validateWorldSave = (value: unknown): WorldSave => {
  if (!isRecord(value)) throw new Error('Файл повреждён');
  if (value.version !== SAVE_VERSION) throw new Error(`Версия сохранения ${String(value.version)} не поддерживается`);
  const name = str(value.name).trim();
  const seed = str(value.seed).trim();
  const id = str(value.id).trim();
  if (!id || !name || !seed) throw new Error('В сохранении нет названия, seed или идентификатора');
  if (!MODES.includes(value.mode as GameMode)) throw new Error('Неизвестный режим игры');
  if (!SIZES.includes(value.size as WorldSize)) throw new Error('Неизвестный размер мира');
  if (!TERRAINS.includes(value.terrain as TerrainKind)) throw new Error('Неизвестный тип ландшафта');
  const spawnRaw = isRecord(value.spawn) ? value.spawn : {};
  const inventoryRaw = Array.isArray(value.inventory) ? value.inventory : [];
  const editsRaw = Array.isArray(value.edits) ? value.edits.filter((item) => typeof item === 'number' && Number.isFinite(item)) : [];
  const save: WorldSave = {
    version: 1,
    id,
    name: name.slice(0, 32),
    seed: seed.slice(0, 64),
    mode: value.mode as GameMode,
    size: value.size as WorldSize,
    terrain: value.terrain as TerrainKind,
    generatorVersion: num(value.generatorVersion, GENERATOR_VERSION) | 0,
    createdAt: num(value.createdAt, Date.now()),
    updatedAt: num(value.updatedAt, Date.now()),
    time: Math.max(0, Math.min(1, num(value.time, 0.3))),
    timeRunning: value.timeRunning !== false,
    weather: value.weather === 'rain' ? 'rain' : 'clear',
    lineMode: value.lineMode === true,
    spawn: { x: num(spawnRaw.x, 0.5), y: num(spawnRaw.y, 40), z: num(spawnRaw.z, 0.5) },
    player: playerOf(value.player),
    inventory: sanitizeSlots(inventoryRaw.map((slot) => (isRecord(slot) ? { id: num(slot.id, 0), count: num(slot.count, 0) } : { id: 0, count: 0 }))),
    edits: sortEdits(editsRaw),
    thumbnail: typeof value.thumbnail === 'string' && value.thumbnail.startsWith('data:image/') ? value.thumbnail : undefined,
  };
  if (typeof value.checksum === 'string' && value.checksum.length > 0) {
    const expected = checksumString(canonicalPayload(save));
    if (expected !== value.checksum) throw new Error('Контрольная сумма сохранения не совпадает');
  }
  return save;
};

export const migrateWorldSave = (value: unknown): WorldSave => {
  if (!isRecord(value)) throw new Error('Файл повреждён');
  const version = value.version ?? 0;
  if (version === 1) return validateWorldSave(value);
  throw new Error(version === 0 ? 'Неизвестная версия сохранения' : `Версия сохранения ${String(version)} не поддерживается`);
};

export const worldNameError = (name: string): string | null => {
  const trimmed = name.trim();
  if (!trimmed) return 'Введите название';
  if (trimmed.length > 32) return 'Название длиннее 32 символов';
  if ([...trimmed].some((char) => char.charCodeAt(0) < 32)) return 'Название содержит недопустимые символы';
  return null;
};
