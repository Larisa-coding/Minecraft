import { blockId } from '../blocks/registry';
import { addItem, countItem, removeItem, type Slot } from './inventory';

export interface Recipe {
  id: string;
  name: string;
  inputs: { id: number; count: number }[];
  output: { id: number; count: number };
}

const id = blockId;

export const RECIPES: Recipe[] = [
  { id: 'oak_planks', name: 'Дубовые доски', inputs: [{ id: id('oak_log'), count: 1 }], output: { id: id('oak_planks'), count: 4 } },
  { id: 'birch_planks', name: 'Берёзовые доски', inputs: [{ id: id('birch_log'), count: 1 }], output: { id: id('birch_planks'), count: 4 } },
  { id: 'pine_planks', name: 'Сосновые доски', inputs: [{ id: id('pine_log'), count: 1 }], output: { id: id('pine_planks'), count: 4 } },
  { id: 'sticks', name: 'Палки', inputs: [{ id: id('oak_planks'), count: 2 }], output: { id: id('sticks'), count: 4 } },
  { id: 'workbench', name: 'Верстак', inputs: [{ id: id('oak_planks'), count: 4 }], output: { id: id('workbench'), count: 1 } },
  { id: 'wood_slab', name: 'Деревянные плиты', inputs: [{ id: id('oak_planks'), count: 2 }], output: { id: id('wood_slab'), count: 4 } },
  { id: 'wood_stairs', name: 'Деревянные ступени', inputs: [{ id: id('oak_planks'), count: 6 }], output: { id: id('wood_stairs'), count: 4 } },
  { id: 'cobble', name: 'Булыжник', inputs: [{ id: id('stone'), count: 1 }], output: { id: id('cobble'), count: 1 } },
  { id: 'stone_bricks', name: 'Каменные кирпичи', inputs: [{ id: id('stone'), count: 4 }], output: { id: id('stone_bricks'), count: 4 } },
  { id: 'smooth', name: 'Гладкий камень', inputs: [{ id: id('cobble'), count: 4 }], output: { id: id('smooth_stone'), count: 4 } },
  { id: 'stone_slab', name: 'Каменные плиты', inputs: [{ id: id('stone'), count: 2 }], output: { id: id('stone_slab'), count: 4 } },
];

export const canCraft = (slots: Slot[], recipe: Recipe): boolean =>
  recipe.inputs.every((input) => countItem(slots, input.id) >= input.count);

export const craft = (slots: Slot[], recipe: Recipe): Slot[] | null => {
  if (!canCraft(slots, recipe)) return null;
  let next = slots;
  for (const input of recipe.inputs) {
    const removed = removeItem(next, input.id, input.count);
    if (removed.removed !== input.count) return null;
    next = removed.slots;
  }
  const added = addItem(next, recipe.output.id, recipe.output.count);
  if (added.added !== recipe.output.count) return null;
  return added.slots;
};
