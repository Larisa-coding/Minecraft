import { useState } from 'react';
import { Button } from '../components/ui';
import { useSettings } from '../store/settingsStore';
import { useUi } from '../store/uiStore';

const desktop = [
  ['Движение', 'W A S D или стрелки — ходьба, сразу, без клика. Пробел — прыжок. Бег включается Ctrl или двойным W и держится, пока идёте вперёд. Shift — присед. В творческом режиме F или двойной пробел включает полёт: пробел вверх, Shift вниз, Ctrl быстрее.'],
  ['Камера', 'Кликните по миру, чтобы мышь крутила обзор. Колесо, − и + отдаляют камеру до 42 блоков: так постройку видно целиком. В этом виде короткий клик ставит блок прямо в точку на экране, перетаскивание осматривает сцену. F5 возвращает вид от первого лица.'],
  ['Блоки', 'ЛКМ ломает блок под прицелом. ПКМ ставит выбранный блок на грань, в которую вы смотрите. Колесо и клавиши 1–9 меняют слот.'],
  ['Инвентарь', 'E открывает инвентарь. В творческом режиме блоки бесконечны. В выживании их нужно добыть. F съедает ягоды.'],
  ['Сохранение', 'Мир пишется в IndexedDB после изменений, в паузе и при выходе. Esc — пауза. C — инструменты творческого режима.'],
];

const touch = [
  ['Движение', 'Левая половина — джойстик, как в карманном Minecraft. Тяните шарик: от центра идёте, до упора — бежите. Справа внизу круглая кнопка с треугольником — прыжок. Дважды нажмите её в творческом режиме, чтобы полететь: удержание поднимает, кнопка приседа опускает.'],
  ['Обзор и блоки', 'Короткое касание правой части ставит блок в точку нажатия. Сдвиг пальца только крутит камеру. Красная кнопка ломает блок под прицелом. Кнопка с картинкой блока тоже ставит, уже по центру экрана. Присед остаётся включённым, пока не нажмёте снова.'],
  ['Меню', 'Пауза и сумка сверху справа. Под ними «Дальше» отдаляет камеру, «Ближе» возвращает к глазам. Это работает и когда телефон держат вертикально. Щипок двумя пальцами тоже меняет расстояние.'],
  ['Сохранение', 'Прогресс сохраняется на устройстве автоматически. Экспорт мира есть в списке миров.'],
];

export const HowToPlay = () => {
  const screen = useUi((state) => state.screen);
  const touchMode = useUi((state) => state.worldUi.touch) || (typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches);
  const steps = touchMode ? touch : desktop;
  const [index, setIndex] = useState(0);
  const close = () => {
    useSettings.getState().patch((settings) => ({ ...settings, tutorialSeen: true }));
    if (screen === 'game') useUi.getState().setHelpOpen(false);
    else useUi.getState().setScreen('menu');
  };
  const step = steps[index] ?? steps[0];
  return (
    <div className={screen === 'game' ? 'inv' : 'screen'}>
      <div className="panel">
        <p className="meta">Шаг {index + 1} из {steps.length}</p>
        <h2>{step?.[0]}</h2>
        <p>{step?.[1]}</p>
        <div className="row">
          <Button variant="ghost" disabled={index === 0} onClick={() => setIndex((value) => value - 1)}>Назад</Button>
          {index < steps.length - 1
            ? <Button onClick={() => setIndex((value) => value + 1)}>Дальше</Button>
            : <Button onClick={close}>Понятно</Button>}
          <Button variant="ghost" onClick={close}>Закрыть</Button>
        </div>
      </div>
    </div>
  );
};
