import type { TileKey } from '../rendering/tileKeys';

export const AIR = 0;

export type Category = 'nature' | 'wood' | 'stone' | 'ores' | 'build' | 'decor' | 'food' | 'weapon';
export type BlockShape = 'cube' | 'slab' | 'cross' | 'none';
export type RenderLayer = 'opaque' | 'cutout' | 'glass' | 'water' | 'glow' | 'none';
export type SoundKind = 'dirt' | 'stone' | 'wood' | 'sand' | 'grass' | 'glass' | 'snow' | 'wet' | 'plant' | 'ui';

export interface Faces {
  top: TileKey;
  bottom: TileKey;
  north: TileKey;
  south: TileKey;
  east: TileKey;
  west: TileKey;
}

export interface BlockDef {
  id: number;
  key: string;
  name: string;
  category: Category;
  solid: boolean;
  collidable: boolean;
  transparent: boolean;
  liquid: boolean;
  replaceable: boolean;
  placeable: boolean;
  shape: BlockShape;
  layer: RenderLayer;
  hardness: number;
  light: number;
  damage: number;
  sound: SoundKind;
  icon: TileKey;
  faces: Faces;
}

const cube = (tile: TileKey): Faces => ({
  top: tile,
  bottom: tile,
  north: tile,
  south: tile,
  east: tile,
  west: tile,
});

const pillar = (side: TileKey, cap: TileKey): Faces => ({
  top: cap,
  bottom: cap,
  north: side,
  south: side,
  east: side,
  west: side,
});

const sided = (top: TileKey, side: TileKey, bottom: TileKey): Faces => ({
  top,
  bottom,
  north: side,
  south: side,
  east: side,
  west: side,
});

interface Draft {
  id: number;
  key: string;
  name: string;
  category: Category;
  faces: Faces;
  solid?: boolean;
  collidable?: boolean;
  transparent?: boolean;
  liquid?: boolean;
  replaceable?: boolean;
  placeable?: boolean;
  shape?: BlockShape;
  layer?: RenderLayer;
  hardness?: number;
  light?: number;
  damage?: number;
  sound?: SoundKind;
  icon?: TileKey;
}

const define = (draft: Draft): BlockDef => ({
  solid: draft.solid ?? true,
  collidable: draft.collidable ?? true,
  transparent: draft.transparent ?? false,
  liquid: draft.liquid ?? false,
  replaceable: draft.replaceable ?? false,
  placeable: draft.placeable ?? true,
  shape: draft.shape ?? 'cube',
  layer: draft.layer ?? 'opaque',
  hardness: draft.hardness ?? 0.6,
  light: draft.light ?? 0,
  damage: draft.damage ?? 0,
  sound: draft.sound ?? 'stone',
  icon: draft.icon ?? draft.faces.top,
  id: draft.id,
  key: draft.key,
  name: draft.name,
  category: draft.category,
  faces: draft.faces,
});

const plant = (draft: Draft): BlockDef =>
  define({
    ...draft,
    solid: false,
    collidable: false,
    transparent: true,
    replaceable: true,
    shape: 'cross',
    layer: 'cutout',
    hardness: 0.05,
    sound: 'plant',
    icon: draft.icon ?? draft.faces.top,
  });

export const BLOCKS: BlockDef[] = [
  define({ id: 1, key: 'grass', name: 'Трава', category: 'nature', faces: sided('grass_top', 'grass_side', 'dirt'), hardness: 0.35, sound: 'grass' }),
  define({ id: 2, key: 'dirt', name: 'Земля', category: 'nature', faces: cube('dirt'), hardness: 0.35, sound: 'dirt' }),
  define({ id: 3, key: 'stone', name: 'Камень', category: 'nature', faces: cube('stone'), hardness: 0.95, sound: 'stone' }),
  define({ id: 4, key: 'sand', name: 'Песок', category: 'nature', faces: cube('sand'), hardness: 0.3, sound: 'sand' }),
  define({ id: 5, key: 'gravel', name: 'Гравий', category: 'nature', faces: cube('gravel'), hardness: 0.35, sound: 'sand' }),
  define({ id: 6, key: 'snow', name: 'Снег', category: 'nature', faces: cube('snow'), hardness: 0.25, sound: 'snow' }),
  define({ id: 7, key: 'ice', name: 'Лёд', category: 'nature', faces: cube('ice'), transparent: true, layer: 'glass', hardness: 0.4, sound: 'glass' }),
  define({ id: 8, key: 'clay', name: 'Глина', category: 'nature', faces: cube('clay'), hardness: 0.45, sound: 'dirt' }),
  define({
    id: 9,
    key: 'water',
    name: 'Вода',
    category: 'nature',
    faces: cube('water'),
    solid: false,
    collidable: false,
    transparent: true,
    liquid: true,
    replaceable: true,
    layer: 'water',
    hardness: 0.15,
    sound: 'wet',
  }),
  define({ id: 10, key: 'oak_leaves', name: 'Дубовые листья', category: 'nature', faces: cube('leaves_oak'), transparent: true, collidable: false, layer: 'cutout', hardness: 0.22, sound: 'grass' }),
  define({ id: 11, key: 'birch_leaves', name: 'Берёзовые листья', category: 'nature', faces: cube('leaves_birch'), transparent: true, collidable: false, layer: 'cutout', hardness: 0.22, sound: 'grass' }),
  define({ id: 12, key: 'pine_leaves', name: 'Хвоя', category: 'nature', faces: cube('leaves_pine'), transparent: true, collidable: false, layer: 'cutout', hardness: 0.22, sound: 'grass' }),
  define({ id: 13, key: 'oak_log', name: 'Дубовое бревно', category: 'wood', faces: pillar('log_oak', 'log_oak_top'), hardness: 0.55, sound: 'wood' }),
  define({ id: 14, key: 'birch_log', name: 'Берёзовое бревно', category: 'wood', faces: pillar('log_birch', 'log_birch_top'), hardness: 0.55, sound: 'wood' }),
  define({ id: 15, key: 'pine_log', name: 'Сосновое бревно', category: 'wood', faces: pillar('log_pine', 'log_pine_top'), hardness: 0.55, sound: 'wood' }),
  define({ id: 16, key: 'oak_planks', name: 'Дубовые доски', category: 'wood', faces: sided('planks_oak_top', 'planks_oak', 'planks_oak_top'), hardness: 0.5, sound: 'wood' }),
  define({ id: 17, key: 'birch_planks', name: 'Берёзовые доски', category: 'wood', faces: sided('planks_birch_top', 'planks_birch', 'planks_birch_top'), hardness: 0.5, sound: 'wood' }),
  define({ id: 18, key: 'pine_planks', name: 'Сосновые доски', category: 'wood', faces: sided('planks_pine_top', 'planks_pine', 'planks_pine_top'), hardness: 0.5, sound: 'wood' }),
  define({ id: 19, key: 'wood_stairs', name: 'Деревянные ступени', category: 'wood', faces: sided('stairs_top', 'stairs_side', 'stairs_top'), hardness: 0.5, sound: 'wood' }),
  define({ id: 20, key: 'wood_slab', name: 'Деревянная плита', category: 'wood', faces: sided('planks_oak_top', 'planks_oak', 'planks_oak_top'), shape: 'slab', hardness: 0.45, sound: 'wood' }),
  define({ id: 21, key: 'bricks', name: 'Кирпич', category: 'stone', faces: sided('brick_top', 'brick', 'brick_top'), hardness: 1, sound: 'stone' }),
  define({ id: 22, key: 'stone_bricks', name: 'Каменные кирпичи', category: 'stone', faces: sided('stone_bricks_top', 'stone_bricks', 'stone_bricks_top'), hardness: 1, sound: 'stone' }),
  define({ id: 23, key: 'smooth_stone', name: 'Гладкий камень', category: 'stone', faces: cube('smooth'), hardness: 0.95, sound: 'stone' }),
  define({ id: 24, key: 'cobble', name: 'Булыжник', category: 'stone', faces: cube('cobble'), hardness: 1, sound: 'stone' }),
  define({ id: 25, key: 'sandstone', name: 'Песчаник', category: 'stone', faces: sided('sandstone_top', 'sandstone', 'sandstone_top'), hardness: 0.85, sound: 'stone' }),
  define({ id: 26, key: 'dark_stone', name: 'Тёмный камень', category: 'stone', faces: cube('dark_stone'), hardness: 1.15, sound: 'stone' }),
  define({ id: 27, key: 'stone_slab', name: 'Каменная плита', category: 'stone', faces: cube('smooth'), shape: 'slab', hardness: 0.9, sound: 'stone' }),
  define({ id: 28, key: 'iron_ore', name: 'Железная руда', category: 'ores', faces: cube('ore_iron'), hardness: 1.15, sound: 'stone' }),
  define({ id: 29, key: 'gold_ore', name: 'Золотая руда', category: 'ores', faces: cube('ore_gold'), hardness: 1.2, sound: 'stone' }),
  define({ id: 30, key: 'coal_ore', name: 'Угольная руда', category: 'ores', faces: cube('ore_coal'), hardness: 1.05, sound: 'stone' }),
  define({ id: 31, key: 'diamond_ore', name: 'Алмазная руда', category: 'ores', faces: cube('ore_diamond'), hardness: 1.35, sound: 'stone' }),
  define({ id: 32, key: 'copper_ore', name: 'Медная руда', category: 'ores', faces: cube('ore_copper'), hardness: 1.1, sound: 'stone' }),
  define({ id: 33, key: 'concrete_white', name: 'Белый бетон', category: 'build', faces: cube('conc_white'), hardness: 0.9, sound: 'stone' }),
  define({ id: 34, key: 'concrete_black', name: 'Чёрный бетон', category: 'build', faces: cube('conc_black'), hardness: 0.9, sound: 'stone' }),
  define({ id: 35, key: 'concrete_red', name: 'Красный бетон', category: 'build', faces: cube('conc_red'), hardness: 0.9, sound: 'stone' }),
  define({ id: 36, key: 'concrete_blue', name: 'Синий бетон', category: 'build', faces: cube('conc_blue'), hardness: 0.9, sound: 'stone' }),
  define({ id: 37, key: 'glass', name: 'Стекло', category: 'build', faces: cube('glass'), transparent: true, layer: 'glass', hardness: 0.25, sound: 'glass' }),
  define({ id: 38, key: 'glass_color', name: 'Цветное стекло', category: 'build', faces: cube('glass_color'), transparent: true, layer: 'glass', hardness: 0.25, sound: 'glass' }),
  define({ id: 39, key: 'masonry', name: 'Кирпичная кладка', category: 'build', faces: sided('masonry_top', 'masonry', 'masonry_top'), hardness: 1, sound: 'stone' }),
  define({ id: 40, key: 'glow', name: 'Светящийся блок', category: 'build', faces: cube('glow'), layer: 'glow', hardness: 0.4, light: 14, sound: 'glass' }),
  define({ id: 41, key: 'torch_block', name: 'Факельный блок', category: 'build', faces: cube('torch'), layer: 'glow', hardness: 0.2, light: 12, sound: 'wood' }),
  define({ id: 42, key: 'decorative', name: 'Декоративный блок', category: 'decor', faces: cube('decorative'), hardness: 0.5, sound: 'stone' }),
  define({ id: 43, key: 'workbench', name: 'Верстак', category: 'wood', faces: sided('work_top', 'work_side', 'planks_oak'), hardness: 0.55, sound: 'wood' }),
  plant({ id: 44, key: 'tall_grass', name: 'Высокая трава', category: 'decor', faces: cube('tall_grass') }),
  plant({ id: 45, key: 'flower', name: 'Цветок', category: 'decor', faces: cube('flower') }),
  plant({ id: 46, key: 'dead_bush', name: 'Сухой куст', category: 'decor', faces: cube('dead_bush'), sound: 'grass' }),
  define({
    id: 200,
    key: 'sticks',
    name: 'Палки',
    category: 'wood',
    faces: cube('stick'),
    solid: false,
    collidable: false,
    placeable: false,
    shape: 'none',
    layer: 'none',
    hardness: 0,
    sound: 'wood',
    icon: 'stick',
  }),
  define({
    id: 201,
    key: 'berries',
    name: 'Ягоды',
    category: 'food',
    faces: cube('berries'),
    solid: false,
    collidable: false,
    placeable: false,
    shape: 'none',
    layer: 'none',
    hardness: 0,
    sound: 'plant',
    icon: 'berries',
  }),
  define({ id: 202, key: 'wood_sword', name: 'Деревянный клинок', category: 'weapon', faces: cube('sword_wood'), solid: false, collidable: false, placeable: false, shape: 'none', layer: 'none', hardness: 0, damage: 4, sound: 'wood', icon: 'sword_wood' }),
  define({ id: 203, key: 'stone_sword', name: 'Каменный клинок', category: 'weapon', faces: cube('sword_stone'), solid: false, collidable: false, placeable: false, shape: 'none', layer: 'none', hardness: 0, damage: 5, sound: 'stone', icon: 'sword_stone' }),
  define({ id: 204, key: 'iron_sword', name: 'Железный клинок', category: 'weapon', faces: cube('sword_iron'), solid: false, collidable: false, placeable: false, shape: 'none', layer: 'none', hardness: 0, damage: 7, sound: 'stone', icon: 'sword_iron' }),
];

const byId = new Map<number, BlockDef>();
const byKey = new Map<string, BlockDef>();
for (const block of BLOCKS) {
  byId.set(block.id, block);
  byKey.set(block.key, block);
}

export const getBlockDef = (id: number): BlockDef | null => byId.get(id) ?? null;

export const getBlockByKey = (key: string): BlockDef => {
  const block = byKey.get(key);
  if (!block) throw new Error(`Неизвестный блок: ${key}`);
  return block;
};

export const blockId = (key: string): number => getBlockByKey(key).id;

export const isOpaqueCube = (id: number): boolean => {
  const block = getBlockDef(id);
  return !!block && block.shape === 'cube' && block.solid && !block.transparent && block.layer === 'opaque';
};

export const isCollidable = (id: number): boolean => getBlockDef(id)?.collidable ?? false;

export const isReplaceable = (id: number): boolean => id === AIR || (getBlockDef(id)?.replaceable ?? false);

export const placeableBlocks = (): BlockDef[] => BLOCKS.filter((block) => block.placeable);

export const creativeItems = (): BlockDef[] => BLOCKS.filter((block) => block.placeable || block.damage > 0);

export const CATEGORIES: { id: Category; name: string }[] = [
  { id: 'nature', name: 'Природа' },
  { id: 'wood', name: 'Дерево' },
  { id: 'stone', name: 'Камень' },
  { id: 'ores', name: 'Руды' },
  { id: 'build', name: 'Строительство' },
  { id: 'decor', name: 'Декор' },
  { id: 'weapon', name: 'Оружие' },
];

export const FACE_NAMES = ['top', 'bottom', 'north', 'south', 'east', 'west'] as const;
export type FaceName = (typeof FACE_NAMES)[number];
