import { Button } from '../components/ui';
import { game } from '../game/engine/api';
import { useUi } from '../store/uiStore';

export const PauseMenu = () => {
  const setSettings = useUi((state) => state.setSettingsOpen);
  const setHelp = useUi((state) => state.setHelpOpen);
  const mode = useUi((state) => state.hud.mode);
  return (
    <div className="inv">
      <div className="panel">
        <h2>Пауза</h2>
        <div className="stack">
          <Button onClick={() => game()?.resume()}>Продолжить игру</Button>
          <Button variant="sand" onClick={() => game()?.setMode(mode === 'creative' ? 'survival' : 'creative')}>
            {mode === 'creative' ? 'Выключить творческий режим' : 'Включить творческий режим'}
          </Button>
          {mode === 'creative' && <Button onClick={() => { game()?.resume(); useUi.getState().setCreativeOpen(true); }}>Время, ночь и полёт</Button>}
          <Button variant="ghost" onClick={() => void game()?.save()}>Сохранить мир</Button>
          <Button variant="ghost" onClick={() => setSettings(true)}>Настройки</Button>
          <Button variant="ghost" onClick={() => setHelp(true)}>Как играть</Button>
          <Button variant="ghost" onClick={() => game()?.photo()}>Снимок</Button>
          <Button variant="ghost" onClick={() => game()?.respawnAtSpawn()}>К точке появления</Button>
          <Button variant="danger" onClick={() => void game()?.leave()}>В главное меню</Button>
        </div>
      </div>
    </div>
  );
};
