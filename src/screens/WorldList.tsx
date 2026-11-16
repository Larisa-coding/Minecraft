import { useEffect, useState } from 'react';
import { Button } from '../components/ui';
import { audio } from '../game/audio/AudioManager';
import { deleteWorld, getWorld, listWorlds, putWorld } from '../storage/worldDb';
import { migrateWorldSave, worldNameError } from '../storage/serializer';
import type { WorldMeta, WorldSave } from '../storage/types';
import { useSettings } from '../store/settingsStore';
import { useUi } from '../store/uiStore';

const modeName = { creative: 'Творческий', survival: 'Выживание' };

export const WorldList = () => {
  const [worlds, setWorlds] = useState<WorldMeta[]>([]);
  const [error, setError] = useState('');
  const setScreen = useUi((state) => state.setScreen);
  const ask = useUi((state) => state.ask);

  const refresh = () => {
    listWorlds().then(setWorlds).catch(() => setError('IndexedDB недоступна'));
  };
  useEffect(() => { refresh(); }, []);

  const open = (id: string) => {
    audio.ui();
    useSettings.getState().patch((settings) => ({ ...settings, lastWorldId: id }));
    useUi.getState().setActiveWorldId(id);
    setScreen('game');
  };

  const rename = async (meta: WorldMeta) => {
    const name = window.prompt('Новое название', meta.name);
    if (name === null) return;
    const nameError = worldNameError(name);
    if (nameError) { setError(nameError); return; }
    const save = await getWorld(meta.id);
    if (!save) return;
    await putWorld({ ...save, name: name.trim() });
    refresh();
  };

  const copyWorld = async (meta: WorldMeta) => {
    const save = await getWorld(meta.id);
    if (!save) return;
    const copy: WorldSave = {
      ...save,
      id: crypto.randomUUID(),
      name: `${save.name} копия`.slice(0, 32),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      checksum: undefined,
    };
    await putWorld(copy);
    refresh();
  };

  const remove = (meta: WorldMeta) => {
    ask('Удалить мир?', `«${meta.name}» будет удалён с этого устройства.`, 'Удалить', () => {
      deleteWorld(meta.id).then(() => {
        if (useSettings.getState().lastWorldId === meta.id) {
          useSettings.getState().patch((settings) => ({ ...settings, lastWorldId: null }));
        }
        refresh();
      }).catch(() => setError('Не удалось удалить мир'));
    });
  };

  const exportWorld = async (meta: WorldMeta) => {
    const save = await getWorld(meta.id);
    if (!save) return;
    const blob = new Blob([JSON.stringify(save)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${save.name.replace(/[^\p{L}\p{N}]+/gu, '-') || 'world'}.mosspeak.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const importWorld = async (file: File) => {
    try {
      const parsed: unknown = JSON.parse(await file.text());
      const save = migrateWorldSave(parsed);
      const existing = worlds.find((world) => world.id === save.id);
      const commit = async (next: WorldSave) => { await putWorld(next); refresh(); setError(''); };
      if (existing) {
        const copy: WorldSave = { ...save, id: crypto.randomUUID(), name: `${save.name} импорт`.slice(0, 32), checksum: undefined, createdAt: Date.now(), updatedAt: Date.now() };
        ask('Такой мир уже есть', 'Текущий мир не будет перезаписан. Импортировать отдельную копию?', 'Импортировать копию', () => { void commit(copy); });
        return;
      }
      await commit(save);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Некорректный файл');
    }
  };

  return (
    <div className="screen">
      <div className="panel wide">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2>Мои миры</h2>
          <div className="row">
            <label className="btn ghost small">Импорт
              <input type="file" accept="application/json,.json" hidden onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void importWorld(file);
                event.target.value = '';
              }} />
            </label>
            <Button variant="ghost" onClick={() => setScreen('menu')}>Назад</Button>
          </div>
        </div>
        <p className="notice">{error}</p>
        {worlds.length === 0 && <p className="sub">Сохранённых миров пока нет.</p>}
        <div className="cards">
          {worlds.map((world) => (
            <article className="card" key={world.id}>
              <div className="shot">{world.thumbnail ? <img src={world.thumbnail} alt="" /> : 'Mosspeak'}</div>
              <div className="body">
                <strong>{world.name}</strong>
                <div className="meta">{world.damaged ? 'Повреждён' : `${modeName[world.mode]} · seed ${world.seed}`}</div>
                <div className="meta">{world.updatedAt ? new Date(world.updatedAt).toLocaleString('ru-RU') : 'Нет даты'}</div>
                <div className="row">
                  <Button small disabled={world.damaged} onClick={() => open(world.id)}>Продолжить</Button>
                  <Button small variant="ghost" disabled={world.damaged} onClick={() => void rename(world)}>Имя</Button>
                  <Button small variant="ghost" disabled={world.damaged} onClick={() => void copyWorld(world)}>Копия</Button>
                  <Button small variant="ghost" disabled={world.damaged} onClick={() => void exportWorld(world)}>Экспорт</Button>
                  <Button small variant="danger" onClick={() => remove(world)}>Удалить</Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
};
