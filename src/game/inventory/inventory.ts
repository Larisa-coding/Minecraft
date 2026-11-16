export interface Slot {
  id: number;
  count: number;
}

export const HOTBAR_SIZE = 9;
export const INV_SIZE = 36;
export const MAX_STACK = 64;

export const emptySlot = (): Slot => ({ id: 0, count: 0 });

export const emptyInventory = (): Slot[] => Array.from({ length: INV_SIZE }, emptySlot);

export const isEmpty = (slot: Slot): boolean => slot.id === 0 || slot.count <= 0;

export const cloneSlots = (slots: Slot[]): Slot[] => slots.map((slot) => ({ id: slot.id, count: slot.count }));

export const sanitizeSlots = (slots: Slot[]): Slot[] => {
  const next = emptyInventory();
  for (let i = 0; i < INV_SIZE; i += 1) {
    const slot = slots[i];
    if (!slot || slot.id <= 0 || slot.count <= 0) continue;
    next[i] = { id: slot.id | 0, count: Math.max(1, Math.min(MAX_STACK, slot.count | 0)) };
  }
  return next;
};

export const addItem = (slots: Slot[], id: number, count: number): { slots: Slot[]; added: number } => {
  const next = cloneSlots(slots);
  let left = count;
  if (id <= 0 || count <= 0) return { slots: next, added: 0 };
  for (const slot of next) {
    if (left <= 0) break;
    if (slot.id === id && slot.count < MAX_STACK) {
      const move = Math.min(MAX_STACK - slot.count, left);
      slot.count += move;
      left -= move;
    }
  }
  for (const slot of next) {
    if (left <= 0) break;
    if (isEmpty(slot)) {
      const move = Math.min(MAX_STACK, left);
      slot.id = id;
      slot.count = move;
      left -= move;
    }
  }
  return { slots: next, added: count - left };
};

export const removeItem = (slots: Slot[], id: number, count: number): { slots: Slot[]; removed: number } => {
  const next = cloneSlots(slots);
  let left = count;
  for (const slot of next) {
    if (left <= 0) break;
    if (slot.id !== id || slot.count <= 0) continue;
    const take = Math.min(slot.count, left);
    slot.count -= take;
    left -= take;
    if (slot.count <= 0) {
      slot.id = 0;
      slot.count = 0;
    }
  }
  return { slots: next, removed: count - left };
};

export const countItem = (slots: Slot[], id: number): number =>
  slots.reduce((sum, slot) => sum + (slot.id === id ? slot.count : 0), 0);

export const consumeFromSlot = (slots: Slot[], index: number, amount = 1): Slot[] => {
  const next = cloneSlots(slots);
  const slot = next[index];
  if (!slot || isEmpty(slot)) return next;
  slot.count -= amount;
  if (slot.count <= 0) {
    slot.id = 0;
    slot.count = 0;
  }
  return next;
};

export interface HeldResult {
  slots: Slot[];
  held: Slot;
}

export const takeSlot = (slots: Slot[], index: number, half: boolean): HeldResult => {
  const next = cloneSlots(slots);
  const slot = next[index] ?? emptySlot();
  if (isEmpty(slot)) return { slots: next, held: emptySlot() };
  if (half) {
    const take = Math.ceil(slot.count / 2);
    const held = { id: slot.id, count: take };
    slot.count -= take;
    if (slot.count <= 0) {
      slot.id = 0;
      slot.count = 0;
    }
    return { slots: next, held };
  }
  const held = { id: slot.id, count: slot.count };
  next[index] = emptySlot();
  return { slots: next, held };
};

export const putHeld = (slots: Slot[], index: number, held: Slot, one: boolean): HeldResult => {
  const next = cloneSlots(slots);
  const slot = next[index] ?? emptySlot();
  if (isEmpty(held)) return { slots: next, held: emptySlot() };
  if (isEmpty(slot)) {
    const move = one ? 1 : held.count;
    next[index] = { id: held.id, count: move };
    const left = held.count - move;
    return { slots: next, held: left > 0 ? { id: held.id, count: left } : emptySlot() };
  }
  if (slot.id === held.id) {
    const space = MAX_STACK - slot.count;
    const move = Math.min(space, one ? 1 : held.count);
    slot.count += move;
    const left = held.count - move;
    return { slots: next, held: left > 0 ? { id: held.id, count: left } : emptySlot() };
  }
  if (one) return { slots: next, held };
  next[index] = { id: held.id, count: held.count };
  return { slots: next, held: { id: slot.id, count: slot.count } };
};

export const quickMove = (slots: Slot[], index: number): Slot[] => {
  const next = cloneSlots(slots);
  const slot = next[index];
  if (!slot || isEmpty(slot)) return next;
  const toHotbar = index >= HOTBAR_SIZE;
  const start = toHotbar ? 0 : HOTBAR_SIZE;
  const end = toHotbar ? HOTBAR_SIZE : INV_SIZE;
  for (let i = start; i < end; i += 1) {
    const target = next[i];
    if (!target || target.id !== slot.id || target.count >= MAX_STACK) continue;
    const move = Math.min(MAX_STACK - target.count, slot.count);
    target.count += move;
    slot.count -= move;
    if (slot.count <= 0) {
      next[index] = emptySlot();
      return next;
    }
  }
  for (let i = start; i < end; i += 1) {
    const target = next[i];
    if (!target || !isEmpty(target)) continue;
    next[i] = { id: slot.id, count: slot.count };
    next[index] = emptySlot();
    return next;
  }
  return next;
};

export const creativeHotbar = (ids: number[]): Slot[] => {
  const slots = emptyInventory();
  ids.slice(0, HOTBAR_SIZE).forEach((id, index) => {
    slots[index] = { id, count: 1 };
  });
  return slots;
};
