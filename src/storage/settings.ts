export type Quality = 'low' | 'medium' | 'high';
export type Distance = 'low' | 'medium' | 'high';

export interface Settings {
  graphics: {
    quality: Quality;
    renderDistance: Distance;
    shadows: boolean;
    antialias: boolean;
    effects: Quality;
  };
  controls: {
    mouseSensitivity: number;
    invertY: boolean;
    moveSpeed: number;
    flySpeed: number;
    touchSensitivity: number;
  };
  audio: {
    master: number;
    effects: number;
    muted: boolean;
  };
  ui: {
    theme: 'dark' | 'light';
    hudScale: number;
    showHotbar: boolean;
    showCrosshair: boolean;
    showHints: boolean;
    showBlockName: boolean;
    showFps: boolean;
    showCoords: boolean;
    showGrid: boolean;
  };
  tutorialSeen: boolean;
  lastWorldId: string | null;
}

const weakDevice = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  const cores = navigator.hardwareConcurrency || 8;
  const touch = navigator.maxTouchPoints > 0;
  const small = typeof screen !== 'undefined' && Math.min(screen.width, screen.height) < 900;
  return cores <= 4 || (touch && small);
};

export const defaultSettings = (): Settings => {
  const low = weakDevice();
  return {
    graphics: {
      quality: low ? 'low' : 'medium',
      renderDistance: low ? 'low' : 'medium',
      shadows: !low,
      antialias: !low,
      effects: low ? 'low' : 'medium',
    },
    controls: {
      mouseSensitivity: 1,
      invertY: false,
      moveSpeed: 1,
      flySpeed: 12,
      touchSensitivity: 1,
    },
    audio: { master: 0.7, effects: 0.8, muted: false },
    ui: {
      theme: 'dark',
      hudScale: 1,
      showHotbar: true,
      showCrosshair: true,
      showHints: true,
      showBlockName: true,
      showFps: false,
      showCoords: false,
      showGrid: false,
    },
    tutorialSeen: false,
    lastWorldId: null,
  };
};

const KEY = 'mosspeak-settings-v1';

const merge = (value: unknown): Settings => {
  const base = defaultSettings();
  if (!value || typeof value !== 'object') return base;
  const data = value as Partial<Settings>;
  return {
    graphics: { ...base.graphics, ...data.graphics },
    controls: { ...base.controls, ...data.controls },
    audio: { ...base.audio, ...data.audio },
    ui: { ...base.ui, ...data.ui },
    tutorialSeen: data.tutorialSeen === true,
    lastWorldId: typeof data.lastWorldId === 'string' ? data.lastWorldId : null,
  };
};

export const loadSettings = (): Settings => {
  if (typeof localStorage === 'undefined') return defaultSettings();
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? merge(JSON.parse(raw)) : defaultSettings();
  } catch {
    return defaultSettings();
  }
};

export const saveSettings = (settings: Settings): void => {
  localStorage.setItem(KEY, JSON.stringify(settings));
};

export const qualityPreset = (quality: Quality): Settings['graphics'] => {
  if (quality === 'low') return { quality, renderDistance: 'low', shadows: false, antialias: false, effects: 'low' };
  if (quality === 'high') return { quality, renderDistance: 'high', shadows: true, antialias: true, effects: 'high' };
  return { quality, renderDistance: 'medium', shadows: true, antialias: true, effects: 'medium' };
};
