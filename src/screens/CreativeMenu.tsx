import { Button } from '../components/ui';
import { game } from '../game/engine/api';
import { useUi } from '../store/uiStore';

export const CreativeMenu = () => {
  const world = useUi((state) => state.worldUi);
  return (
    <div className="inv">
      <div className="panel">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2>Творчество</h2>
          <Button variant="ghost" small onClick={() => useUi.getState().setCreativeOpen(false)}>Закрыть</Button>
        </div>
        <div className="stack">
          <label className="field">Время суток
            <input className="slider" type="range" min={0} max={1} step={0.01} value={world.time} onChange={(event) => game()?.setTime(Number(event.target.value))} />
          </label>
          <div className="row">
            <Button onClick={() => game()?.setTime(0.32)}>День</Button>
            <Button onClick={() => game()?.setTime(0.78)}>Ночь</Button>
            <Button variant="ghost" onClick={() => game()?.setTimeRunning(!world.timeRunning)}>{world.timeRunning ? 'Остановить время' : 'Запустить время'}</Button>
          </div>
          <div className="row">
            <Button variant={world.weather === 'clear' ? 'primary' : 'ghost'} onClick={() => game()?.setWeather('clear')}>Ясно</Button>
            <Button variant={world.weather === 'rain' ? 'primary' : 'ghost'} onClick={() => game()?.setWeather('rain')}>Дождь</Button>
          </div>
          <Button onClick={() => game()?.toggleFly()}>Переключить полёт</Button>
          <Button variant={world.lineMode ? 'sand' : 'ghost'} onClick={() => game()?.toggleLine()}>{world.lineMode ? 'Ряд включён' : 'Ставить рядом по оси'}</Button>
          <Button variant="ghost" onClick={() => game()?.toggleCamera()}>Сменить камеру</Button>
        </div>
      </div>
    </div>
  );
};
