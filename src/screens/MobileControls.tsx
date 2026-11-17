import { useEffect, useRef, useState } from 'react';
import { getBlockDef } from '../game/blocks/registry';
import { game } from '../game/engine/api';
import { iconUrl } from '../game/rendering/materials';
import { useUi } from '../store/uiStore';

const rootPoint = (event: { clientX: number; clientY: number; currentTarget: EventTarget }) => {
  const node = event.currentTarget instanceof HTMLElement ? event.currentTarget.closest('.game-root') : null;
  const rect = node?.getBoundingClientRect();
  return {
    x: event.clientX - (rect?.left ?? 0),
    y: event.clientY - (rect?.top ?? 0),
  };
};

const TAP_SLOP = 18;

export const MobileControls = () => {
  const flying = useUi((state) => state.hud.flying);
  const slot = useUi((state) => state.hud.slot);
  const slots = useUi((state) => state.slots);
  const block = getBlockDef(slots[slot]?.id ?? 0);
  const [sneaking, setSneaking] = useState(false);
  const stick = useRef<HTMLDivElement>(null);
  const knob = useRef<HTMLElement>(null);
  const origin = useRef({ x: 0, y: 0, id: -1 });
  const look = useRef({ x: 0, y: 0, id: -1, moved: 0 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef(0);

  const remember = (event: { pointerId: number; clientX: number; clientY: number }) => {
    const count = pointers.current.size;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (count < 2 && pointers.current.size === 2) pinch.current = fingerGap();
  };

  const forget = (id: number) => {
    pointers.current.delete(id);
    if (pointers.current.size < 2) pinch.current = 0;
  };

  const fingerGap = () => {
    const pts = [...pointers.current.values()];
    if (pts.length < 2) return 0;
    return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
  };

  const applyPinch = () => {
    if (pointers.current.size < 2 || pinch.current <= 0) return false;
    const gap = fingerGap();
    const delta = pinch.current - gap;
    if (Math.abs(delta) < 16) return true;
    game()?.nudgeZoom(delta > 0 ? 1.4 : -1.4);
    pinch.current = gap;
    return true;
  };

  useEffect(() => {
    if (!flying) return;
    setSneaking(false);
    game()?.setSneak(false);
  }, [flying]);

  const moveKnob = (x: number, y: number) => {
    if (knob.current) knob.current.style.transform = `translate(${x}px, ${y}px)`;
  };

  const parkStick = () => {
    const node = stick.current;
    if (!node) return;
    node.style.left = '';
    node.style.top = '';
    node.style.bottom = '';
    node.style.margin = '';
    node.classList.remove('edge');
  };

  return (
    <div className="touch-ui">
      <div
        className="touch-look"
        onPointerDown={(event) => {
          remember(event);
          if (pointers.current.size > 1 || look.current.id !== -1) return;
          look.current = { x: event.clientX, y: event.clientY, id: event.pointerId, moved: 0 };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (pointers.current.has(event.pointerId)) remember(event);
          if (applyPinch()) return;
          if (look.current.id !== event.pointerId) return;
          const dx = event.clientX - look.current.x;
          const dy = event.clientY - look.current.y;
          look.current.moved += Math.hypot(dx, dy);
          look.current.x = event.clientX;
          look.current.y = event.clientY;
          if (look.current.moved < TAP_SLOP) return;
          game()?.addLook(dx, dy);
        }}
        onPointerUp={(event) => {
          forget(event.pointerId);
          const tapped = look.current.id === event.pointerId && look.current.moved < TAP_SLOP && pointers.current.size === 0;
          look.current.id = -1;
          if (tapped) game()?.placeAt(event.clientX, event.clientY);
        }}
        onPointerCancel={(event) => { forget(event.pointerId); look.current.id = -1; }}
      />
      <div
        className="stick-zone"
        onPointerDown={(event) => {
          remember(event);
          if (pointers.current.size > 1) return;
          origin.current = { x: event.clientX, y: event.clientY, id: event.pointerId };
          event.currentTarget.setPointerCapture(event.pointerId);
          const point = rootPoint(event);
          const half = (stick.current?.offsetWidth ?? 136) / 2;
          if (stick.current) {
            stick.current.style.left = `${point.x}px`;
            stick.current.style.top = `${point.y}px`;
            stick.current.style.bottom = 'auto';
            stick.current.style.margin = `-${half}px 0 0 -${half}px`;
          }
          moveKnob(0, 0);
        }}
        onPointerMove={(event) => {
          if (pointers.current.has(event.pointerId)) remember(event);
          if (applyPinch()) return;
          if (origin.current.id !== event.pointerId) return;
          const dx = event.clientX - origin.current.x;
          const dy = event.clientY - origin.current.y;
          const len = Math.hypot(dx, dy);
          const radius = 58;
          if (len < 16) {
            moveKnob(0, 0);
            stick.current?.classList.remove('edge');
            game()?.setMove(0, 0);
            game()?.setSprint(false);
            return;
          }
          const scale = Math.min(1, (len - 16) / radius);
          const nx = dx / len;
          const ny = dy / len;
          moveKnob(nx * scale * 42, ny * scale * 42);
          const forward = -ny * scale;
          game()?.setMove(nx * scale, forward);
          const sprint = scale >= 0.9 && forward > 0.45;
          stick.current?.classList.toggle('edge', sprint);
          game()?.setSprint(sprint);
        }}
        onPointerUp={(event) => {
          forget(event.pointerId);
          origin.current.id = -1;
          moveKnob(0, 0);
          parkStick();
          game()?.setMove(0, 0);
          game()?.setSprint(false);
        }}
        onPointerCancel={(event) => {
          forget(event.pointerId);
          origin.current.id = -1;
          moveKnob(0, 0);
          parkStick();
          game()?.setMove(0, 0);
          game()?.setSprint(false);
        }}
      />
      <div className="stick" ref={stick}><i ref={knob} /></div>
      <div className="zoom-pad">
        <button type="button" aria-label="Приблизить" onPointerDown={(event) => { event.stopPropagation(); event.preventDefault(); game()?.nudgeZoom(-4); }}>Ближе</button>
        <button type="button" aria-label="Отдалить" onPointerDown={(event) => { event.stopPropagation(); event.preventDefault(); game()?.nudgeZoom(4); }}>Дальше</button>
      </div>
      <div className="touch-menu">
        <button type="button" onClick={(event) => { event.stopPropagation(); useUi.getState().setInventoryOpen(true); }}>Сумка</button>
        <button type="button" onClick={(event) => { event.stopPropagation(); game()?.pause(); }}>Пауза</button>
      </div>
      <div className="mc-pad">
        <button
          type="button"
          className={sneaking ? 'mc-sneak on' : 'mc-sneak'}
          aria-label={flying ? 'Вниз' : 'Присед'}
          onPointerDown={(event) => {
            event.stopPropagation();
            if (flying) game()?.setSneak(true);
          }}
          onPointerUp={() => { if (flying) game()?.setSneak(false); }}
          onPointerCancel={() => { if (flying) game()?.setSneak(false); }}
          onClick={(event) => {
            event.stopPropagation();
            if (flying) return;
            const next = !sneaking;
            setSneaking(next);
            game()?.setSneak(next);
          }}
        >{flying ? '▼' : '▾'}</button>
        <button
          type="button"
          className="mc-break"
          aria-label="Ломать"
          onPointerDown={(event) => { event.stopPropagation(); event.preventDefault(); game()?.setBreaking(true); }}
          onPointerUp={() => game()?.setBreaking(false)}
          onPointerCancel={() => game()?.setBreaking(false)}
        >✕</button>
        <button
          type="button"
          className="mc-place"
          aria-label={block?.name ?? 'Поставить блок'}
          onPointerDown={(event) => { event.stopPropagation(); event.preventDefault(); game()?.setPlacing(true); }}
          onPointerUp={() => game()?.setPlacing(false)}
          onPointerCancel={() => game()?.setPlacing(false)}
        >
          {block && <img src={iconUrl(block.icon)} alt="" />}
        </button>
        <button
          type="button"
          className="mc-jump"
          aria-label={flying ? 'Вверх' : 'Прыжок'}
          onPointerDown={(event) => { event.stopPropagation(); game()?.setJump(true); }}
          onPointerUp={() => game()?.setJump(false)}
          onPointerCancel={() => game()?.setJump(false)}
        >▲</button>
      </div>
    </div>
  );
};
