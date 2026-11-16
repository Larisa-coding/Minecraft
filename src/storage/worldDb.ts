import { migrateWorldSave, withChecksum } from './serializer';
import type { WorldMeta, WorldSave } from './types';

const DB_NAME = 'mosspeak';
const STORE = 'worlds';

const openDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Не удалось открыть IndexedDB'));
  });

const requestToPromise = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Ошибка IndexedDB'));
  });

export const listWorlds = async (): Promise<WorldMeta[]> => {
  const db = await openDb();
  const rows = await requestToPromise(db.transaction(STORE, 'readonly').objectStore(STORE).getAll());
  db.close();
  const metas: WorldMeta[] = [];
  for (const row of rows) {
    try {
      const save = migrateWorldSave(row);
      metas.push({
        id: save.id,
        name: save.name,
        seed: save.seed,
        mode: save.mode,
        size: save.size,
        terrain: save.terrain,
        createdAt: save.createdAt,
        updatedAt: save.updatedAt,
        thumbnail: save.thumbnail,
      });
    } catch {
      const broken = row as { id?: string; name?: string };
      if (typeof broken.id === 'string') {
        metas.push({
          id: broken.id,
          name: typeof broken.name === 'string' ? broken.name : 'Повреждённый мир',
          seed: '—',
          mode: 'creative',
          size: 'small',
          terrain: 'mixed',
          createdAt: 0,
          updatedAt: 0,
          damaged: true,
        });
      }
    }
  }
  return metas.sort((a, b) => b.updatedAt - a.updatedAt);
};

export const getWorld = async (id: string): Promise<WorldSave | null> => {
  const db = await openDb();
  const row = await requestToPromise(db.transaction(STORE, 'readonly').objectStore(STORE).get(id));
  db.close();
  if (!row) return null;
  return migrateWorldSave(row);
};

export const putWorld = async (save: WorldSave): Promise<void> => {
  const next = withChecksum({ ...save, updatedAt: Date.now() });
  const db = await openDb();
  await requestToPromise(db.transaction(STORE, 'readwrite').objectStore(STORE).put(next));
  db.close();
};

export const deleteWorld = async (id: string): Promise<void> => {
  const db = await openDb();
  await requestToPromise(db.transaction(STORE, 'readwrite').objectStore(STORE).delete(id));
  db.close();
};
