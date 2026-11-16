import { useRef } from 'react';
import { game } from '../game/engine/api';
import { useUi } from '../store/uiStore';

const rootPoint = (event: { clientX: number; clientY: number; currentTarget: EventTarget }) => {
  const node = event.currentTarget instanceof HTMLElement ? event.currentTarget.closest('.game-root') : null;
  const rect = node?.getBoundingClientRect();
  return {
    x: event.clientX - (rect?.left ?? 0),
    y: event.clientY - (rect?.top ?? 0),
  };
};

export const MobileControls = () => {
  const mode = useUi((state) => state.hud.mode);
  const flying = useUi((state) => state.hud.flying);
  const sprinting = useUi((state) => state.hud.sprinting);
  const stick = useRef<HTMLDivElement>(null);
  const knob = useRef<HTMLElement>(null);
  const origin = useRef({ x: 0, y: 0, id: -1 });
  const look = useRef({ x: 0, y: 0, id: -1, moved: 0 });
  const pinch = useRef<{ dist: number; pointers: Map<number, { x: number; y: number }> }>({ dist: 0, pointers: new Map() });

  const moveKnob = (x: number, y: number) => {
    if (knob.current) knob.current.style.transform = `translate(${x}px, ${y}px)`;
  };

  const pinchDistance = () => {
    const points = [...pinch.current.pointers.values()];
    if (points.length < 2) return 0;
    const [a, b] = points;
    if (!a || !b) return 0;
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  return (
    <div className="touch-ui">
      <div
        className="touch-look"
        onPointerDown={(event) => {
          pinch.current.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
          if (pinch.current.pointers.size === 1) {
            look.current = { x: event.clientX, y: event.clientY, id: event.pointerId, moved: 0 };
          }
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (!pinch.current.pointers.has(event.pointerId)) return;
          pinch.current.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
          if (pinch.current.pointers.size >= 2) {
            const dist = pinchDistance();
            if (pinch.current.dist > 0) game()?.nudgeZoom((pinch.current.dist - dist) * 0.08);
            pinch.current.dist = dist;
            look.current.moved = 99;
            return;
          }
          if (look.current.id !== event.pointerId) return;
          const dx = event.clientX - look.current.x;
          const dy = event.clientY - look.current.y;
          look.current.moved += Math.hypot(dx, dy);
          if (Math.hypot(dx, dy) < 0.6) return;
          game()?.addLook(dx, dy);
          look.current.x = event.clientX;
          look.current.y = event.clientY;
        }}
        onPointerUp={(event) => {
          pinch.current.pointers.delete(event.pointerId);
          pinch.current.dist = 0;
          if (look.current.id === event.pointerId && look.current.moved < 12) game()?.placeAt(event.clientX, event.clientY);
          if (look.current.id === event.pointerId) look.current.id = -1;
        }}
        onPointerCancel={(event) => {
          pinch.current.pointers.delete(event.pointerId);
          pinch.current.dist = 0;
          if (look.current.id === event.pointerId) look.current.id = -1;
        }}
      />
      <div
        className="stick-zone"
        onPointerDown={(event) => {
          origin.current = { x: event.clientX, y: event.clientY, id: event.pointerId };
          event.currentTarget.setPointerCapture(event.pointerId);
          const point = rootPoint(event);
          if (stick.current) {
            stick.current.style.left = `${point.x}px`;
            stick.current.style.top = `${point.y}px`;
            stick.current.style.opacity = '1';
          }
        }}
        onPointerMove={(event) => {
          if (origin.current.id !== event.pointerId) return;
          const dx = event.clientX - origin.current.x;
          const dy = event.clientY - origin.current.y;
          const len = Math.hypot(dx, dy);
          if (len < 14) {
            moveKnob(0, 0);
            game()?.setMove(0, 0);
            return;
          }
          const scale = Math.min(1, (len - 14) / 54);
          moveKnob((dx / len) * scale * 36, (dy / len) * scale * 36);
          game()?.setMove((dx / len) * scale, (-dy / len) * scale);
        }}
        onPointerUp={() => {
          origin.current.id = -1;
          moveKnob(0, 0);
          if (stick.current) stick.current.style.opacity = '0';
          game()?.setMove(0, 0);
        }}
        onPointerCancel={() => {
          origin.current.id = -1;
          moveKnob(0, 0);
          if (stick.current) stick.current.style.opacity = '0';
          game()?.setMove(0, 0);
        }}
      />
      <div className="stick" ref={stick}><i ref={knob} /></div>
      <div className="zoom-pad">
        <button type="button" aria-label="Приблизить" onClick={(event) => { event.stopPropagation(); game()?.nudgeZoom(-4); }}>+</button>
        <button type="button" aria-label="Отдалить" onClick={(event) => { event.stopPropagation(); game()?.nudgeZoom(4); }}>−</button>
      </div>
      <button type="button" className="pause-fab" onClick={(event) => { event.stopPropagation(); game()?.pause(); }}>Пауза</button>
      <div className="actions">
        <button type="button" onPointerDown={(event) => { event.stopPropagation(); game()?.setJump(true); }} onPointerUp={() => game()?.setJump(false)} onPointerCancel={() => game()?.setJump(false)}>{flying ? 'Вверх' : 'Прыжок'}</button>
        <button type="button" onPointerDown={(event) => { event.stopPropagation(); game()?.setBreaking(true); }} onPointerUp={() => game()?.setBreaking(false)} onPointerLeave={() => game()?.setBreaking(false)} onPointerCancel={() => game()?.setBreaking(false)}>Ломать</button>
        <button type="button" onPointerDown={(event) => { event.stopPropagation(); game()?.setPlacing(true); }} onPointerUp={() => game()?.setPlacing(false)} onPointerCancel={() => game()?.setPlacing(false)}>Ставить</button>
        <button type="button" className={sprinting ? 'on' : ''} onClick={(event) => { event.stopPropagation(); game()?.toggleSprint(); }}>Бег</button>
        <button type="button" onPointerDown={(event) => { event.stopPropagation(); game()?.setSneak(true); }} onPointerUp={() => game()?.setSneak(false)} onPointerLeave={() => game()?.setSneak(false)} onPointerCancel={() => game()?.setSneak(false)}>{flying ? 'Вниз' : 'Присед'}</button>
        <button type="button" onClick={(event) => { event.stopPropagation(); useUi.getState().setInventoryOpen(true); }}>Сумка</button>
        {mode === 'creative' && <button type="button" className={flying ? 'on' : ''} onClick={(event) => { event.stopPropagation(); game()?.toggleFly(); }}>Полёт</button>}
      </div>
    </div>
  );
};
