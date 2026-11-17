import { useEffect, useRef, useState } from 'react';
import { LoadingScreen } from '../components/ui';
import { GameEngine } from '../game/engine/GameEngine';
import { getWorld } from '../storage/worldDb';
import { useSettings } from '../store/settingsStore';
import { useUi } from '../store/uiStore';
import { CreativeMenu } from './CreativeMenu';
import { HowToPlay } from './HowToPlay';
import { Hud } from './Hud';
import { InventoryScreen } from './InventoryScreen';
import { MobileControls } from './MobileControls';
import { PauseMenu } from './PauseMenu';
import { SettingsScreen } from './SettingsScreen';

export const GameScreen = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const id = useUi((state) => state.activeWorldId);
  const worldUi = useUi((state) => state.worldUi);
  const paused = useUi((state) => state.paused);
  const inventory = useUi((state) => state.inventoryOpen);
  const creative = useUi((state) => state.creativeOpen);
  const settingsOpen = useUi((state) => state.settingsOpen);
  const helpOpen = useUi((state) => state.helpOpen);
  const zoom = useUi((state) => state.hud.zoom);
  const [portrait, setPortrait] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !id) return;
    let engine: GameEngine | null = null;
    let dead = false;
    getWorld(id).then((save) => {
      if (dead) return;
      if (!save) {
        useUi.getState().pushToast('Не удалось загрузить мир');
        useUi.getState().setScreen('menu');
        return;
      }
      useSettings.getState().patch((settings) => ({ ...settings, lastWorldId: save.id }));
      try {
        engine = new GameEngine(canvas, save);
        engine.start();
      } catch (error) {
        useUi.getState().pushToast(error instanceof Error ? error.message : 'Мир не запустился');
        useUi.getState().setScreen('menu');
      }
    }).catch((error: unknown) => {
      useUi.getState().pushToast(error instanceof Error ? error.message : 'Сохранение повреждено');
      useUi.getState().setScreen('worlds');
    });
    return () => { dead = true; engine?.dispose(); };
  }, [id]);

  useEffect(() => {
    const update = () => setPortrait(window.innerHeight > window.innerWidth);
    update();
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    window.visualViewport?.addEventListener('resize', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
      window.visualViewport?.removeEventListener('resize', update);
    };
  }, []);

  return (
    <div className={portrait && worldUi.touch ? 'game-root is-portrait' : 'game-root'}>
      <canvas ref={canvasRef} />
      {!worldUi.ready && !worldUi.fatal && <LoadingScreen label={worldUi.loadingLabel} progress={worldUi.loading} />}
      {worldUi.fatal && <div className="loading"><div className="panel"><h2>Графика недоступна</h2><p>{worldUi.fatal}</p></div></div>}
      {worldUi.ready && <Hud />}
      {worldUi.ready && worldUi.touch && !paused && !inventory && !creative && <MobileControls />}
      {portrait && worldUi.touch && worldUi.ready && <div className="portrait">Горизонтально удобнее, но играть можно и так.</div>}
      {worldUi.ready && zoom < 1 && !worldUi.pointerLocked && !worldUi.touch && !paused && !inventory && !creative && !helpOpen && !settingsOpen && (
        <div className="lock-hint">Кликните по миру, чтобы крутить камеру. Колесо отдаляет вид, и тогда клик ставит блок в эту точку.</div>
      )}
      {paused && <PauseMenu />}
      {inventory && <InventoryScreen />}
      {creative && <CreativeMenu />}
      {settingsOpen && <SettingsScreen />}
      {helpOpen && <HowToPlay />}
    </div>
  );
};
