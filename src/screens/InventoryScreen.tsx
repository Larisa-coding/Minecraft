import { useState, type PointerEvent } from 'react';
import { Button } from '../components/ui';
import { audio } from '../game/audio/AudioManager';
import { game } from '../game/engine/api';
import { CATEGORIES, creativeItems, getBlockDef, type Category } from '../game/blocks/registry';
import { RECIPES, canCraft, craft } from '../game/inventory/crafting';
import { addItem, cloneSlots, isEmpty, putHeld, quickMove, takeSlot, type Slot } from '../game/inventory/inventory';
import { iconUrl } from '../game/rendering/materials';
import { useUi } from '../store/uiStore';

const empty: Slot = { id: 0, count: 0 };

export const InventoryScreen = () => {
  const slots = useUi((state) => state.slots);
  const mode = useUi((state) => state.hud.mode);
  const selected = useUi((state) => state.hud.slot);
  const [held, setHeld] = useState<Slot>(empty);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<Category | 'all'>('all');
  const query = search.trim().toLowerCase();

  const close = () => {
    if (!isEmpty(held)) {
      const added = addItem(slots, held.id, held.count);
      game()?.setSlots(added.slots);
      setHeld(empty);
    }
    useUi.getState().setInventoryOpen(false);
  };

  const onSlot = (index: number, event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (event.shiftKey) {
      game()?.setSlots(quickMove(slots, index));
      return;
    }
    if (isEmpty(held)) {
      const result = takeSlot(slots, index, event.button === 2);
      game()?.setSlots(result.slots);
      setHeld(result.held);
      return;
    }
    const result = putHeld(slots, index, held, event.button === 2);
    game()?.setSlots(result.slots);
    setHeld(result.held);
  };

  const catalog = creativeItems().filter((block) => (category === 'all' || block.category === category) && block.name.toLowerCase().includes(query));

  return (
    <div className="inv" onContextMenu={(event) => event.preventDefault()}>
      <div className="panel">
        <div className="inv-bar row">
          <h2>{mode === 'creative' ? 'Блоки' : 'Инвентарь'}</h2>
          <div className="row">
            {!isEmpty(held) && <Button variant="danger" small onClick={() => setHeld(empty)}>Выбросить</Button>}
            <Button variant="ghost" small onClick={close}>Закрыть</Button>
          </div>
        </div>
        <input style={{ width: '100%', margin: '10px 0' }} placeholder="Поиск" value={search} onChange={(event) => setSearch(event.target.value)} />
        {mode === 'creative' ? (
          <>
            <div className="tabs">
              <button className={category === 'all' ? 'tab active' : 'tab'} onClick={() => setCategory('all')}>Все</button>
              {CATEGORIES.map((item) => <button key={item.id} className={category === item.id ? 'tab active' : 'tab'} onClick={() => setCategory(item.id)}>{item.name}</button>)}
            </div>
            <div className="catalog" style={{ marginTop: 10 }}>
              {catalog.map((block) => (
                <button key={block.id} className="slot" title={block.name} onClick={() => {
                  const next = cloneSlots(slots);
                  next[selected] = { id: block.id, count: 1 };
                  game()?.setSlots(next);
                  audio.ui();
                  useUi.getState().setInventoryOpen(false);
                }}>
                  <img src={iconUrl(block.icon)} alt="" />
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="slot-grid">
              {slots.slice(9).map((slot, index) => {
                const def = getBlockDef(slot.id);
                const dim = query && def && !def.name.toLowerCase().includes(query);
                return (
                  <button key={index} className="slot" style={{ opacity: dim ? 0.35 : 1 }} title={def?.name} onPointerDown={(event) => onSlot(index + 9, event)}>
                    {def && <img src={iconUrl(def.icon)} alt="" />}
                    {slot.count > 0 && <b>{slot.count}</b>}
                  </button>
                );
              })}
            </div>
            <h2 style={{ fontSize: 18, marginTop: 16 }}>Крафт</h2>
            <div className="stack">
              {RECIPES.filter((recipe) => recipe.name.toLowerCase().includes(query)).map((recipe) => (
                <div className="row" key={recipe.id} style={{ justifyContent: 'space-between' }}>
                  <span>{recipe.name} ×{recipe.output.count}</span>
                  <Button small disabled={!canCraft(slots, recipe)} onClick={() => {
                    const next = craft(slots, recipe);
                    if (next) { game()?.setSlots(next); audio.ui(); }
                  }}>Создать</Button>
                </div>
              ))}
            </div>
          </>
        )}
        <div className="slot-grid" style={{ marginTop: 14 }}>
          {slots.slice(0, 9).map((slot, index) => {
            const def = getBlockDef(slot.id);
            return (
              <button key={index} className={index === selected ? 'slot selected' : 'slot'} onPointerDown={(event) => onSlot(index, event)} onClick={() => { game()?.selectSlot(index); useUi.getState().setInventoryOpen(false); }}>
                {def && <img src={iconUrl(def.icon)} alt="" />}
                {slot.count > 0 && <b>{mode === 'creative' ? '∞' : slot.count}</b>}
              </button>
            );
          })}
        </div>
        {!isEmpty(held) && <p className="sub">В руке: {getBlockDef(held.id)?.name} ×{held.count}</p>}
      </div>
    </div>
  );
};
