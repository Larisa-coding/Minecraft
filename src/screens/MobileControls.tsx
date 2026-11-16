import { useRef } from 'react';
import { game } from '../game/engine/api';
import { useUi } from '../store/uiStore';

export const MobileControls = () => {
  const mode = useUi((state) => state.hud.mode);
  const origin = useRef({ x: 0, y: 0, id: -1 });
  const look = useRef({ x: 0, y: 0, id: -1 });

  return (
    <>
      <div
        className="touch-look"
        onPointerDown={(event) => { look.current = { x: event.clientX, y: event.clientY, id: event.pointerId }; event.currentTarget.setPointerCapture(event.pointerId); }}
        onPointerMove={(event) => {
          if (look.current.id !== event.pointerId) return;
          game()?.addLook(event.clientX - look.current.x, event.clientY - look.current.y);
          look.current.x = event.clientX;
          look.current.y = event.clientY;
        }}
        onPointerUp={() => { look.current.id = -1; }}
      />
      <div
        className="stick"
        onPointerDown={(event) => {
          origin.current = { x: event.clientX, y: event.clientY, id: event.pointerId };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (origin.current.id !== event.pointerId) return;
          const dx = event.clientX - origin.current.x;
          const dy = event.clientY - origin.current.y;
          const len = Math.hypot(dx, dy) || 1;
          const scale = Math.min(1, len / 48);
          const knob = event.currentTarget.querySelector('i');
          if (knob instanceof HTMLElement) {
            knob.style.transform = `translate(${(dx / len) * scale * 28}px, ${(dy / len) * scale * 28}px)`;
          }
          game()?.setMove((dx / len) * scale, (-dy / len) * scale);
        }}
        onPointerUp={(event) => {
          origin.current.id = -1;
          const knob = event.currentTarget.querySelector('i');
          if (knob instanceof HTMLElement) knob.style.transform = 'none';
          game()?.setMove(0, 0);
        }}
      ><i /></div>
      <div className="actions">
        <button onPointerDown={(event) => { event.stopPropagation(); game()?.setJump(true); }} onPointerUp={() => game()?.setJump(false)}>Прыжок</button>
        <button onPointerDown={(event) => { event.stopPropagation(); game()?.setBreaking(true); }} onPointerUp={() => game()?.setBreaking(false)} onPointerLeave={() => game()?.setBreaking(false)}>Ломать</button>
        <button onPointerDown={(event) => { event.stopPropagation(); game()?.setPlacing(true); }} onPointerUp={() => game()?.setPlacing(false)}>Ставить</button>
        <button onClick={(event) => { event.stopPropagation(); useUi.getState().setInventoryOpen(true); }}>Сумка</button>
        {mode === 'creative' && <button onClick={(event) => { event.stopPropagation(); game()?.toggleFly(); }}>Полёт</button>}
        <button onClick={(event) => { event.stopPropagation(); game()?.pause(); }}>Пауза</button>
      </div>
    </>
  );
};
