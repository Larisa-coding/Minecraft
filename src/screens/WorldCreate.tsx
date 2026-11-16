import { useState } from 'react';
import { Button, LoadingScreen } from '../components/ui';
import { audio } from '../game/audio/AudioManager';
import { createWorldSave } from '../storage/createWorld';
import { worldNameError } from '../storage/serializer';
import { putWorld } from '../storage/worldDb';
import type { GameMode, TerrainKind, WorldSize } from '../game/world/constants';
import { useSettings } from '../store/settingsStore';
import { useUi } from '../store/uiStore';

export const WorldCreate = () => {
  const setScreen = useUi((state) => state.setScreen);
  const [name, setName] = useState('');
  const [seed, setSeed] = useState('');
  const [mode, setMode] = useState<GameMode>('creative');
  const [size, setSize] = useState<WorldSize>('medium');
  const [terrain, setTerrain] = useState<TerrainKind>('mixed');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleCreate = () => {
    const nameError = name.trim() ? worldNameError(name) : null;
    if (nameError) { setError(nameError); return; }
    audio.ui();
    setBusy(true);
    window.setTimeout(() => {
      try {
        const save = createWorldSave({ name, seed, mode, size, terrain });
        putWorld(save).then(() => {
          useSettings.getState().patch((settings) => ({ ...settings, lastWorldId: save.id }));
          useUi.getState().setActiveWorldId(save.id);
          useUi.getState().setScreen('game');
        }).catch(() => { setBusy(false); setError('Не удалось записать мир в IndexedDB'); });
      } catch (reason) {
        setBusy(false);
        setError(reason instanceof Error ? reason.message : 'Ошибка создания');
      }
    }, 40);
  };

  return (
    <div className="screen">
      <div className="panel">
        <h2>Новый мир</h2>
        <div className="stack">
          <label className="field">Название<input value={name} placeholder="Если пусто — имя создастся само" onChange={(event) => setName(event.target.value)} /></label>
          <label className="field">Режим
            <select value={mode} onChange={(event) => setMode(event.target.value as GameMode)}>
              <option value="creative">Творческий</option>
              <option value="survival">Выживание</option>
            </select>
          </label>
          <label className="field">Размер
            <select value={size} onChange={(event) => setSize(event.target.value as WorldSize)}>
              <option value="small">Маленький</option>
              <option value="medium">Средний</option>
              <option value="large">Большой</option>
            </select>
          </label>
          <label className="field">Ландшафт
            <select value={terrain} onChange={(event) => setTerrain(event.target.value as TerrainKind)}>
              <option value="plains">Равнины</option>
              <option value="forest">Лес</option>
              <option value="mountains">Горы</option>
              <option value="desert">Пустыня</option>
              <option value="islands">Острова</option>
              <option value="mixed">Смешанный мир</option>
            </select>
          </label>
          <label className="field">Seed
            <input value={seed} placeholder="Случайный, если пусто" onChange={(event) => setSeed(event.target.value)} />
          </label>
          <Button variant="ghost" onClick={() => setSeed(String(Math.floor(Math.random() * 1_000_000_000)))}>Случайный seed</Button>
          <p className="notice">{error}</p>
          <div className="row">
            <Button onClick={handleCreate} disabled={busy}>Создать мир</Button>
            <Button variant="ghost" onClick={() => setScreen('menu')}>Назад</Button>
          </div>
        </div>
      </div>
      {busy && <LoadingScreen label="Ищем безопасную точку появления" progress={0.35} />}
    </div>
  );
};
