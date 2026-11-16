import { useEffect, useRef, useState } from 'react';
import { Button } from '../components/ui';
import { MenuBackdrop } from '../game/engine/MenuBackdrop';
import { audio } from '../game/audio/AudioManager';
import { listWorlds } from '../storage/worldDb';
import { useSettings } from '../store/settingsStore';
import { useUi } from '../store/uiStore';

export const MainMenu = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const setScreen = useUi((state) => state.setScreen);
  const setWorld = useUi((state) => state.setActiveWorldId);
  const lastId = useSettings((state) => state.lastWorldId);
  const [canContinue, setCanContinue] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let view: MenuBackdrop | null = null;
    try { view = new MenuBackdrop(canvas); } catch { view = null; }
    return () => view?.dispose();
  }, []);

  useEffect(() => {
    let dead = false;
    listWorlds().then((worlds) => {
      if (dead) return;
      setCanContinue(worlds.some((world) => world.id === lastId && !world.damaged));
    }).catch(() => setCanContinue(false));
    return () => { dead = true; };
  }, [lastId]);

  const go = (screen: 'worlds' | 'create' | 'settings' | 'help') => {
    audio.unlock();
    audio.ui();
    setScreen(screen);
  };

  return (
    <div className="backdrop">
      <canvas ref={canvasRef} aria-hidden="true" />
      <div className="scrim" />
      <div className="screen">
        <div className="panel">
          <div className="brand">
            <div className="mark" aria-hidden="true"><i /><i /><i /><i /></div>
            <div>
              <h1>Mosspeak</h1>
              <p className="sub">Кубический мир, который остаётся на этом устройстве.</p>
            </div>
          </div>
          <div className="stack">
            <Button onClick={() => go(canContinue ? 'worlds' : 'create')}>Играть</Button>
            <Button variant="sand" disabled={!canContinue} onClick={() => {
              if (!lastId) return;
              audio.ui();
              setWorld(lastId);
              setScreen('game');
            }}>Продолжить</Button>
            <Button variant="ghost" onClick={() => go('worlds')}>Мои миры</Button>
            <Button variant="ghost" onClick={() => go('create')}>Создать новый мир</Button>
            <Button variant="ghost" onClick={() => go('settings')}>Настройки</Button>
            <Button variant="ghost" onClick={() => go('help')}>Как играть</Button>
          </div>
        </div>
      </div>
    </div>
  );
};
