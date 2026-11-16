import { TILE_KEYS, type TileKey } from './tileKeys';

export type Pix = (x: number, y: number, color: string) => void;

const rng = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const seedOf = (key: string): number => {
  let h = 2166136261;
  for (let i = 0; i < key.length; i += 1) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

const fill = (pix: Pix, color: string) => {
  for (let y = 0; y < 16; y += 1) for (let x = 0; x < 16; x += 1) pix(x, y, color);
};

const speckled = (pix: Pix, rand: () => number, colors: string[]) => {
  for (let y = 0; y < 16; y += 1) {
    for (let x = 0; x < 16; x += 1) {
      const n = rand();
      const index = n > 0.86 ? colors.length - 1 : n > 0.55 ? 1 : n > 0.28 ? 2 : 0;
      pix(x, y, colors[Math.min(index, colors.length - 1)] ?? colors[0]);
    }
  }
};

const planks = (pix: Pix, rand: () => number, base: string, seam: string, knot: string, vertical: boolean) => {
  fill(pix, base);
  for (let i = 0; i < 16; i += 1) {
    const line = vertical ? i : i;
    if (line % 4 === 0) {
      for (let j = 0; j < 16; j += 1) {
        if (vertical) pix(line, j, seam);
        else pix(j, line, seam);
      }
    }
  }
  for (let n = 0; n < 5; n += 1) {
    const x = Math.floor(rand() * 14) + 1;
    const y = Math.floor(rand() * 14) + 1;
    pix(x, y, knot);
  }
};

const rings = (pix: Pix, rand: () => number, colors: string[]) => {
  for (let y = 0; y < 16; y += 1) {
    for (let x = 0; x < 16; x += 1) {
      const d = Math.hypot(x - 7.5, y - 7.5);
      const band = Math.floor(d + rand() * 0.35);
      pix(x, y, colors[band % colors.length] ?? colors[0]);
    }
  }
  pix(7, 7, colors[0]);
  pix(8, 8, colors[1] ?? colors[0]);
};

const bark = (pix: Pix, rand: () => number, colors: string[], marks: string) => {
  for (let y = 0; y < 16; y += 1) {
    for (let x = 0; x < 16; x += 1) {
      const stripe = Math.floor(x / 2);
      pix(x, y, colors[stripe % colors.length] ?? colors[0]);
    }
  }
  for (let n = 0; n < 10; n += 1) {
    const x = Math.floor(rand() * 16);
    const y = Math.floor(rand() * 16);
    pix(x, y, marks);
    if (y + 1 < 16) pix(x, y + 1, marks);
  }
};

const bricks = (pix: Pix, mortar: string, brick: string, shade: string, tall: number) => {
  fill(pix, mortar);
  for (let y = 0; y < 16; y += 1) {
    const row = Math.floor(y / tall);
    const inRow = y % tall !== tall - 1;
    const offset = row % 2 === 0 ? 0 : 5;
    for (let x = 0; x < 16; x += 1) {
      if (!inRow) continue;
      const lx = (x + offset) % 8;
      if (lx === 7) continue;
      pix(x, y, (x + y) % 9 === 0 ? shade : brick);
    }
  }
};

const ore = (pix: Pix, rand: () => number, stone: string[], fleck: string, deep: string) => {
  speckled(pix, rand, stone);
  for (let n = 0; n < 8; n += 1) {
    const x = 2 + Math.floor(rand() * 12);
    const y = 2 + Math.floor(rand() * 12);
    pix(x, y, fleck);
    pix(x + (rand() > 0.5 ? 1 : -1), y, deep);
    if (rand() > 0.4) pix(x, y + 1, fleck);
  }
};

const leaves = (pix: Pix, rand: () => number, colors: string[]) => {
  for (let y = 0; y < 16; y += 1) {
    for (let x = 0; x < 16; x += 1) {
      const n = rand();
      if (n > 0.28) pix(x, y, colors[n > 0.7 ? 1 : n > 0.45 ? 2 : 0] ?? colors[0]);
      else pix(x, y, 'rgba(0,0,0,0)');
    }
  }
};

const concrete = (pix: Pix, rand: () => number, base: string, light: string, dark: string) => {
  fill(pix, base);
  for (let n = 0; n < 28; n += 1) {
    pix(Math.floor(rand() * 16), Math.floor(rand() * 16), rand() > 0.5 ? light : dark);
  }
};

export const PAINTERS: Record<TileKey, (pix: Pix, rand: () => number) => void> = {
  grass_top: (pix, rand) => speckled(pix, rand, ['#3f8f45', '#4ea64f', '#2f6d38', '#67b85a']),
  grass_side: (pix, rand) => {
    speckled(pix, rand, ['#6a4a32', '#7b5638', '#5a3e2a', '#8a6848']);
    for (let y = 0; y < 4; y += 1) for (let x = 0; x < 16; x += 1) pix(x, y, y === 3 && x % 3 === 0 ? '#2f6d38' : '#4ea64f');
    for (let x = 0; x < 16; x += 2) pix(x, 4, '#3f8f45');
  },
  dirt: (pix, rand) => speckled(pix, rand, ['#6b452c', '#7c5436', '#593820', '#8d6844']),
  stone: (pix, rand) => speckled(pix, rand, ['#8d908c', '#7b7e7a', '#a0a39e', '#6c6f6b']),
  sand: (pix, rand) => speckled(pix, rand, ['#e4d2a4', '#f0e0b6', '#d2be8c', '#c9b07a']),
  gravel: (pix, rand) => speckled(pix, rand, ['#8a847c', '#6e6a64', '#a39c92', '#57544f']),
  snow: (pix, rand) => speckled(pix, rand, ['#f4f7fb', '#e4eaf2', '#ffffff', '#d5deea']),
  ice: (pix, rand) => {
    fill(pix, 'rgba(198,228,236,0.78)');
    for (let n = 0; n < 18; n += 1) pix(Math.floor(rand() * 16), Math.floor(rand() * 16), 'rgba(236,248,252,0.95)');
    for (let i = 0; i < 16; i += 4) pix(i, i, 'rgba(150,196,214,0.9)');
  },
  clay: (pix, rand) => speckled(pix, rand, ['#a46858', '#b67968', '#8d5346', '#c48b78']),
  water: (pix, rand) => {
    fill(pix, 'rgba(62,150,196,0.72)');
    for (let x = 0; x < 16; x += 1) if (rand() > 0.35) pix(x, 3 + (x % 4), 'rgba(214,240,250,0.85)');
    for (let n = 0; n < 8; n += 1) pix(Math.floor(rand() * 16), Math.floor(rand() * 16), 'rgba(30,110,160,0.8)');
  },
  leaves_oak: (pix, rand) => leaves(pix, rand, ['#2f7a38', '#3e9444', '#246330']),
  leaves_birch: (pix, rand) => leaves(pix, rand, ['#7fad45', '#97c45a', '#688f34']),
  leaves_pine: (pix, rand) => leaves(pix, rand, ['#1f5a38', '#2d7350', '#163f28']),
  log_oak: (pix, rand) => bark(pix, rand, ['#6b4a30', '#7d5a3a', '#5a3c26'], '#3d2918'),
  log_oak_top: (pix, rand) => rings(pix, rand, ['#c4a06a', '#a88452', '#8d6a3e', '#ddc08a']),
  log_birch: (pix, rand) => bark(pix, rand, ['#efe8da', '#e3d9c6', '#f7f3ea'], '#2a2a28'),
  log_birch_top: (pix, rand) => rings(pix, rand, ['#f3ead6', '#e2d2b0', '#c9b48a', '#fffaf0']),
  log_pine: (pix, rand) => bark(pix, rand, ['#4e3828', '#5c4330', '#3b291c'], '#2a1c12'),
  log_pine_top: (pix, rand) => rings(pix, rand, ['#b99262', '#97744a', '#6e5434', '#d7b88a']),
  planks_oak: (pix, rand) => planks(pix, rand, '#c1965c', '#8d6438', '#6b4a2c', false),
  planks_oak_top: (pix, rand) => planks(pix, rand, '#d2a86a', '#a07844', '#6b4a2c', true),
  planks_birch: (pix, rand) => planks(pix, rand, '#ead8b4', '#c8b48e', '#a89070', false),
  planks_birch_top: (pix, rand) => planks(pix, rand, '#f3e6c8', '#d4c09a', '#b09878', true),
  planks_pine: (pix, rand) => planks(pix, rand, '#b98356', '#8d5e38', '#6a4328', false),
  planks_pine_top: (pix, rand) => planks(pix, rand, '#c89264', '#9a6840', '#6a4328', true),
  stairs_side: (pix, rand) => {
    planks(pix, rand, '#c1965c', '#8d6438', '#6b4a2c', false);
    for (let x = 0; x < 16; x += 1) {
      pix(x, 8, '#6b4a2c');
      if (x > 7) pix(x, 4, '#6b4a2c');
    }
  },
  stairs_top: (pix, rand) => {
    planks(pix, rand, '#d2a86a', '#a07844', '#6b4a2c', true);
    for (let y = 0; y < 16; y += 1) pix(8, y, '#6b4a2c');
  },
  brick: (pix) => bricks(pix, '#c7b6a4', '#b5523c', '#8e3b2c', 5),
  brick_top: (pix) => bricks(pix, '#d7c6b2', '#c4624a', '#9a4636', 8),
  stone_bricks: (pix) => bricks(pix, '#6d716c', '#9aa099', '#7e847e', 5),
  stone_bricks_top: (pix) => bricks(pix, '#7a7f78', '#b0b6ae', '#8e948c', 8),
  smooth: (pix, rand) => speckled(pix, rand, ['#b7b7b2', '#c6c6c0', '#a6a6a0', '#deded8']),
  cobble: (pix, rand) => {
    fill(pix, '#7a756e');
    for (let n = 0; n < 9; n += 1) {
      const x = Math.floor(rand() * 12);
      const y = Math.floor(rand() * 12);
      const w = 3 + Math.floor(rand() * 3);
      const h = 2 + Math.floor(rand() * 2);
      const color = rand() > 0.5 ? '#9a958c' : '#5e5a54';
      for (let yy = 0; yy < h; yy += 1) for (let xx = 0; xx < w; xx += 1) pix(Math.min(15, x + xx), Math.min(15, y + yy), color);
    }
  },
  sandstone: (pix, rand) => {
    speckled(pix, rand, ['#e6d3a4', '#f3e2b8', '#d8c292', '#c9b07e']);
    for (const y of [4, 11]) for (let x = 0; x < 16; x += 1) pix(x, y, '#c9ae78');
  },
  sandstone_top: (pix, rand) => speckled(pix, rand, ['#f0e2bc', '#e6d2a4', '#f7ecd0', '#dcc496']),
  dark_stone: (pix, rand) => speckled(pix, rand, ['#3a3e44', '#2c3036', '#4a5058', '#22262b']),
  ore_iron: (pix, rand) => ore(pix, rand, ['#8d908c', '#7b7e7a', '#a0a39e'], '#e4c7b0', '#c48b72'),
  ore_gold: (pix, rand) => ore(pix, rand, ['#8d908c', '#7b7e7a', '#a0a39e'], '#f0d15a', '#c89a2e'),
  ore_coal: (pix, rand) => ore(pix, rand, ['#8d908c', '#7b7e7a', '#a0a39e'], '#2a2d31', '#101214'),
  ore_diamond: (pix, rand) => ore(pix, rand, ['#8d908c', '#7b7e7a', '#a0a39e'], '#7eefe2', '#3ec4c8'),
  ore_copper: (pix, rand) => ore(pix, rand, ['#8d908c', '#7b7e7a', '#a0a39e'], '#d88858', '#a85a32'),
  conc_white: (pix, rand) => concrete(pix, rand, '#f4f1ea', '#ffffff', '#ddd8ce'),
  conc_black: (pix, rand) => concrete(pix, rand, '#2a2d31', '#3a3e44', '#16181b'),
  conc_red: (pix, rand) => concrete(pix, rand, '#a33b3b', '#c45252', '#7c2828'),
  conc_blue: (pix, rand) => concrete(pix, rand, '#2f5f93', '#3f78b0', '#21466e'),
  glass: (pix) => {
    for (let y = 0; y < 16; y += 1) for (let x = 0; x < 16; x += 1) {
      const edge = x === 0 || y === 0 || x === 15 || y === 15 || x === 1 || y === 1;
      pix(x, y, edge ? 'rgba(232,244,246,0.9)' : 'rgba(190,220,226,0.18)');
    }
  },
  glass_color: (pix) => {
    for (let y = 0; y < 16; y += 1) for (let x = 0; x < 16; x += 1) {
      const edge = x < 2 || y < 2 || x > 13 || y > 13;
      pix(x, y, edge ? 'rgba(186,236,214,0.92)' : 'rgba(64,168,140,0.32)');
    }
  },
  masonry: (pix) => bricks(pix, '#b08978', '#9a4034', '#732e26', 4),
  masonry_top: (pix) => {
    fill(pix, '#c47a68');
    for (let y = 0; y < 16; y += 4) for (let x = 0; x < 16; x += 1) pix(x, y, '#e6c2b4');
  },
  glow: (pix, rand) => {
    for (let y = 0; y < 16; y += 1) for (let x = 0; x < 16; x += 1) {
      const d = Math.hypot(x - 7.5, y - 7.5);
      pix(x, y, d < 3 ? '#fff4c4' : d < 6 ? '#ffd56a' : '#e0a030');
    }
    if (rand() > 2) pix(0, 0, '#fff');
  },
  torch: (pix) => {
    fill(pix, '#6b3a22');
    for (let y = 3; y < 13; y += 1) for (let x = 5; x < 11; x += 1) pix(x, y, y < 7 ? '#ffe08a' : '#ff9a32');
    for (let x = 6; x < 10; x += 1) pix(x, 2, '#fff6c8');
  },
  decorative: (pix) => {
    fill(pix, '#234233');
    for (let y = 0; y < 16; y += 1) for (let x = 0; x < 16; x += 1) {
      if ((x + y) % 5 === 0) pix(x, y, '#d9c7a3');
      if (x === 0 || y === 0 || x === 15 || y === 15) pix(x, y, '#1a2e24');
    }
    for (let i = 4; i < 12; i += 1) {
      pix(i, 8, '#8fd0a0');
      pix(8, i, '#8fd0a0');
    }
  },
  work_top: (pix, rand) => {
    planks(pix, rand, '#c1965c', '#8d6438', '#6b4a2c', true);
    for (let i = 3; i <= 12; i += 3) {
      pix(i, 4, '#5a3c26');
      pix(i, 11, '#5a3c26');
      pix(4, i, '#5a3c26');
      pix(11, i, '#5a3c26');
    }
  },
  work_side: (pix, rand) => {
    planks(pix, rand, '#b88850', '#7a542e', '#5a3c26', false);
    for (let x = 2; x < 14; x += 1) pix(x, 6, '#6b4a2c');
    pix(4, 8, '#3d2918');
    pix(11, 8, '#3d2918');
  },
  tall_grass: (pix) => {
    for (let y = 0; y < 16; y += 1) for (let x = 0; x < 16; x += 1) pix(x, y, 'rgba(0,0,0,0)');
    for (let y = 2; y < 16; y += 1) {
      pix(4, y, y % 2 ? '#3f8f45' : '#2f6d38');
      pix(8, y, '#4ea64f');
      pix(12, y - 2 < 0 ? 0 : y, '#67b85a');
    }
  },
  flower: (pix) => {
    for (let y = 0; y < 16; y += 1) for (let x = 0; x < 16; x += 1) pix(x, y, 'rgba(0,0,0,0)');
    for (let y = 7; y < 16; y += 1) pix(8, y, '#2f6d38');
    for (const [x, y] of [[8, 3], [6, 5], [10, 5], [7, 6], [9, 6], [8, 5]] as const) pix(x, y, x === 8 && y === 5 ? '#ffe08a' : '#e25b78');
  },
  dead_bush: (pix) => {
    for (let y = 0; y < 16; y += 1) for (let x = 0; x < 16; x += 1) pix(x, y, 'rgba(0,0,0,0)');
    for (let i = 0; i < 10; i += 1) {
      pix(3 + i, 6 + (i % 3), '#7a5434');
      pix(12 - i, 8, '#5c3e28');
    }
  },
  stick: (pix) => {
    for (let y = 0; y < 16; y += 1) for (let x = 0; x < 16; x += 1) pix(x, y, 'rgba(0,0,0,0)');
    for (let y = 2; y < 14; y += 1) {
      pix(7, y, '#c1965c');
      pix(8, y, '#8d6438');
    }
  },
  berries: (pix) => {
    for (let y = 0; y < 16; y += 1) for (let x = 0; x < 16; x += 1) pix(x, y, 'rgba(0,0,0,0)');
    for (const [x, y, c] of [[5, 6, '#d23b4a'], [9, 5, '#e25462'], [8, 9, '#b12e3c'], [6, 10, '#3f8f45'], [11, 8, '#2f6d38']] as const) {
      pix(x, y, c);
      pix(x + 1, y, c);
      pix(x, y + 1, c);
    }
  },
};

export const tileIndex = new Map<TileKey, { col: number; row: number }>();
TILE_KEYS.forEach((key, index) => {
  tileIndex.set(key, { col: index % 8, row: Math.floor(index / 8) });
});

export const paintTile = (
  ctx: CanvasRenderingContext2D,
  key: TileKey,
  col: number,
  row: number,
): void => {
  const pix: Pix = (x, y, color) => {
    ctx.fillStyle = color;
    ctx.fillRect(col * 16 + x, row * 16 + y, 1, 1);
  };
  PAINTERS[key](pix, rng(seedOf(key)));
};
