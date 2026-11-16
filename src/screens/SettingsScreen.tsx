import { useState } from 'react';
import { Button, Slider } from '../components/ui';
import { audio } from '../game/audio/AudioManager';
import { qualityPreset, type Distance, type Quality } from '../storage/settings';
import { useSettings } from '../store/settingsStore';
import { useUi } from '../store/uiStore';

export const SettingsScreen = () => {
  const settings = useSettings();
  const patch = useSettings((state) => state.patch);
  const reset = useSettings((state) => state.reset);
  const screen = useUi((state) => state.screen);
  const setScreen = useUi((state) => state.setScreen);
  const setSettingsOpen = useUi((state) => state.setSettingsOpen);
  const ask = useUi((state) => state.ask);
  const [tab, setTab] = useState<'graphics' | 'controls' | 'audio' | 'ui'>('graphics');
  const overlay = screen === 'game';

  const close = () => {
    audio.ui();
    if (overlay) setSettingsOpen(false);
    else setScreen('menu');
  };

  return (
    <div className={overlay ? 'inv' : 'screen'}>
      <div className="panel wide">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2>Настройки</h2>
          <Button variant="ghost" onClick={close}>Назад</Button>
        </div>
        <div className="tabs" style={{ margin: '12px 0' }}>
          {([['graphics', 'Графика'], ['controls', 'Управление'], ['audio', 'Звук'], ['ui', 'Интерфейс']] as const).map(([id, label]) => (
            <button key={id} className={tab === id ? 'tab active' : 'tab'} onClick={() => setTab(id)}>{label}</button>
          ))}
        </div>
        {tab === 'graphics' && (
          <div className="stack">
            <div className="row">
              {(['low', 'medium', 'high'] as Quality[]).map((quality) => (
                <Button key={quality} variant={settings.graphics.quality === quality ? 'primary' : 'ghost'} onClick={() => patch((current) => ({ ...current, graphics: qualityPreset(quality) }))}>
                  {quality === 'low' ? 'Низкое' : quality === 'high' ? 'Высокое' : 'Среднее'}
                </Button>
              ))}
            </div>
            <label className="field">Дальность
              <select value={settings.graphics.renderDistance} onChange={(event) => patch((current) => ({ ...current, graphics: { ...current.graphics, renderDistance: event.target.value as Distance } }))}>
                <option value="low">Низкая</option>
                <option value="medium">Средняя</option>
                <option value="high">Высокая</option>
              </select>
            </label>
            <label className="row"><input type="checkbox" checked={settings.graphics.shadows} onChange={(event) => patch((current) => ({ ...current, graphics: { ...current.graphics, shadows: event.target.checked } }))} /> Тени</label>
            <label className="row"><input type="checkbox" checked={settings.graphics.antialias} onChange={(event) => patch((current) => ({ ...current, graphics: { ...current.graphics, antialias: event.target.checked } }))} /> Сглаживание (при входе в мир)</label>
            <label className="field">Эффекты
              <select value={settings.graphics.effects} onChange={(event) => patch((current) => ({ ...current, graphics: { ...current.graphics, effects: event.target.value as Quality } }))}>
                <option value="low">Минимум</option>
                <option value="medium">Обычные</option>
                <option value="high">Больше неба и дождя</option>
              </select>
            </label>
          </div>
        )}
        {tab === 'controls' && (
          <div className="stack">
            <Slider label="Чувствительность мыши" min={0.4} max={2.2} step={0.05} value={settings.controls.mouseSensitivity} onChange={(value) => patch((current) => ({ ...current, controls: { ...current.controls, mouseSensitivity: value } }))} />
            <Slider label="Сенсор камеры" min={0.4} max={2.4} step={0.05} value={settings.controls.touchSensitivity} onChange={(value) => patch((current) => ({ ...current, controls: { ...current.controls, touchSensitivity: value } }))} />
            <Slider label="Скорость ходьбы" min={0.6} max={1.6} step={0.05} value={settings.controls.moveSpeed} onChange={(value) => patch((current) => ({ ...current, controls: { ...current.controls, moveSpeed: value } }))} />
            <Slider label="Скорость полёта" min={6} max={28} step={1} value={settings.controls.flySpeed} onChange={(value) => patch((current) => ({ ...current, controls: { ...current.controls, flySpeed: value } }))} />
            <label className="row"><input type="checkbox" checked={settings.controls.invertY} onChange={(event) => patch((current) => ({ ...current, controls: { ...current.controls, invertY: event.target.checked } }))} /> Инверсия вертикальной оси</label>
            <p className="meta">Бег: Ctrl или двойное W. Присед: удержать Shift. Полёт: F. Ходьба работает без захвата мыши, камера — после клика по миру.</p>
          </div>
        )}
        {tab === 'audio' && (
          <div className="stack">
            <Slider label="Общая громкость" min={0} max={1} step={0.01} value={settings.audio.master} onChange={(value) => patch((current) => ({ ...current, audio: { ...current.audio, master: value } }))} />
            <Slider label="Эффекты" min={0} max={1} step={0.01} value={settings.audio.effects} onChange={(value) => patch((current) => ({ ...current, audio: { ...current.audio, effects: value } }))} />
            <label className="row"><input type="checkbox" checked={settings.audio.muted} onChange={(event) => patch((current) => ({ ...current, audio: { ...current.audio, muted: event.target.checked } }))} /> Выключить звук</label>
            <Button variant="ghost" onClick={() => audio.ui()}>Проверить звук</Button>
          </div>
        )}
        {tab === 'ui' && (
          <div className="stack">
            <div className="row">
              <Button variant={settings.ui.theme === 'dark' ? 'primary' : 'ghost'} onClick={() => patch((current) => ({ ...current, ui: { ...current.ui, theme: 'dark' } }))}>Тёмная тема</Button>
              <Button variant={settings.ui.theme === 'light' ? 'primary' : 'ghost'} onClick={() => patch((current) => ({ ...current, ui: { ...current.ui, theme: 'light' } }))}>Светлая тема</Button>
            </div>
            <Slider label="Масштаб HUD" min={0.8} max={1.3} step={0.05} value={settings.ui.hudScale} onChange={(value) => patch((current) => ({ ...current, ui: { ...current.ui, hudScale: value } }))} />
            <label className="row"><input type="checkbox" checked={settings.ui.showHotbar} onChange={(event) => patch((current) => ({ ...current, ui: { ...current.ui, showHotbar: event.target.checked } }))} /> Панель быстрого доступа</label>
            <label className="row"><input type="checkbox" checked={settings.ui.showCrosshair} onChange={(event) => patch((current) => ({ ...current, ui: { ...current.ui, showCrosshair: event.target.checked } }))} /> Прицел</label>
            <label className="row"><input type="checkbox" checked={settings.ui.showHints} onChange={(event) => patch((current) => ({ ...current, ui: { ...current.ui, showHints: event.target.checked } }))} /> Подсказки</label>
            <label className="row"><input type="checkbox" checked={settings.ui.showBlockName} onChange={(event) => patch((current) => ({ ...current, ui: { ...current.ui, showBlockName: event.target.checked } }))} /> Название блока</label>
            <label className="row"><input type="checkbox" checked={settings.ui.showFps} onChange={(event) => patch((current) => ({ ...current, ui: { ...current.ui, showFps: event.target.checked } }))} /> Счётчик FPS</label>
            <label className="row"><input type="checkbox" checked={settings.ui.showCoords} onChange={(event) => patch((current) => ({ ...current, ui: { ...current.ui, showCoords: event.target.checked } }))} /> Координаты</label>
            <label className="row"><input type="checkbox" checked={settings.ui.showGrid} onChange={(event) => patch((current) => ({ ...current, ui: { ...current.ui, showGrid: event.target.checked } }))} /> Сетка у ног</label>
          </div>
        )}
        <div className="row" style={{ marginTop: 16 }}>
          <Button variant="danger" onClick={() => ask('Сбросить настройки?', 'Тема, графика, звук и управление вернутся к значениям по умолчанию.', 'Сбросить', reset)}>Сбросить</Button>
        </div>
      </div>
    </div>
  );
};
