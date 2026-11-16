import { getBlockDef } from '../game/blocks/registry';
import { iconUrl } from '../game/rendering/materials';
import { game } from '../game/engine/api';
import { useSettings } from '../store/settingsStore';
import { useUi } from '../store/uiStore';

const pips = (value: number, kind: 'heart' | 'food') => Array.from({ length: 10 }, (_, index) => {
  const filled = value - index * 2;
  const className = filled >= 2 ? 'pip on' : filled >= 1 ? 'pip half' : 'pip';
  return <i key={`${kind}${index}`} className={className} />;
});

export const Hud = () => {
  const hud = useUi((state) => state.hud);
  const slots = useUi((state) => state.slots);
  const ui = useSettings((state) => state.ui);
  const scale = { transform: `scale(${ui.hudScale})`, transformOrigin: 'bottom center' } as const;
  return (
    <div className="hud">
      {ui.showCrosshair && <div className="cross" />}
      {ui.showBlockName && hud.blockName && <div className="block-name">{hud.blockName}</div>}
      {hud.breaking > 0 && <div className="break-meter bar"><span style={{ width: `${hud.breaking * 100}%` }} /></div>}
      {hud.mode === 'survival' && (
        <div className="vitals">
          <div className="hearts" aria-label={`Здоровье ${hud.health}`}>{pips(hud.health, 'heart')}</div>
          <div className="food" aria-label={`Голод ${hud.hunger}`}>{pips(hud.hunger, 'food')}</div>
        </div>
      )}
      {ui.showCoords && <div className="coords">{hud.x.toFixed(1)} {hud.y.toFixed(1)} {hud.z.toFixed(1)} {hud.flying ? '· полёт' : ''}</div>}
      {ui.showFps && <div className="fps">{Math.round(hud.fps)} FPS</div>}
      <div className="save-ind">{hud.save === 'saving' ? 'Сохранение...' : hud.save === 'error' ? 'Ошибка сохранения' : 'Сохранено'}</div>
      {ui.showHints && <div className="hint">{hud.mode === 'creative' ? 'E инвентарь · C инструменты · F5 камера' : 'E инвентарь · F съесть ягоды'}</div>}
      {ui.showHotbar && (
        <div className="hotbar" style={scale}>
          {slots.slice(0, 9).map((slot, index) => {
            const def = getBlockDef(slot.id);
            return (
              <button key={index} className={index === hud.slot ? 'slot selected' : 'slot'} aria-label={def?.name ?? `Слот ${index + 1}`} onClick={() => game()?.selectSlot(index)}>
                {def && <img src={iconUrl(def.icon)} alt="" />}
                {slot.count > 0 && <b>{hud.mode === 'creative' ? '∞' : slot.count}</b>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
