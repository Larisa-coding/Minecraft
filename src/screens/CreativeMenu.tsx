import { Button } from '../components/ui';
import { game } from '../game/engine/api';
import { useUi } from '../store/uiStore';

export const CreativeMenu = () => {
  const world = useUi((state) => state.worldUi);
  const zoom = useUi((state) => state.hud.zoom);
  const flying = useUi((state) => state.hud.flying);
  return (
    <div className="inv">
      <div className="panel">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2>Мир</h2>
          <Button variant="ghost" small onClick={() => useUi.getState().setCreativeOpen(false)}>Закрыть</Button>
        </div>
        <div className="stack">
          <label className="field">Время: слева день, справа ночь
            <input className="slider" type="range" min={0} max={1} step={0.01} value={world.time} aria-label="Время суток" onChange={(event) => game()?.setTime(Number(event.target.value))} />
          </label>
          <p className="meta">Ползунок двигает солнце. Ночью появляются зомби.</p>
          <div className="row">
            <Button onClick={() => game()?.setTime(0.32)}>День</Button>
            <Button onClick={() => game()?.setTime(0.78)}>Ночь</Button>
            <Button variant="ghost" onClick={() => game()?.setTimeRunning(!world.timeRunning)}>{world.timeRunning ? 'Остановить время' : 'Запустить время'}</Button>
          </div>
          <div className="row">
            <Button variant={world.weather === 'clear' ? 'primary' : 'ghost'} onClick={() => game()?.setWeather('clear')}>Ясно</Button>
            <Button variant={world.weather === 'rain' ? 'primary' : 'ghost'} onClick={() => game()?.setWeather('rain')}>Дождь</Button>
          </div>
          <Button onClick={() => game()?.toggleFly()}>{flying ? 'Сесть на землю' : 'Взлететь'}</Button>
          <p className="meta">В полёте прыжок поднимает, присед опускает.</p>
          <Button variant={world.lineMode ? 'sand' : 'ghost'} onClick={() => game()?.toggleLine()}>{world.lineMode ? 'Линия включена' : 'Ставить линией'}</Button>
          <p className="meta">Следующий блок продолжает прямой ряд от того, который только что поставила.</p>
          <Button variant="ghost" onClick={() => game()?.toggleCamera()}>{zoom >= 1 ? 'Камера к глазам' : 'Отодвинуть камеру'}</Button>
          <p className="meta">Камера отходит назад: видно себя и всю постройку. Повтор возвращает вид от первого лица.</p>
        </div>
      </div>
    </div>
  );
};
