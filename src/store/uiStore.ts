import { create } from 'zustand';
import type { GameMode } from '../game/world/constants';
import type { Slot } from '../game/inventory/inventory';

export type ScreenId = 'menu' | 'worlds' | 'create' | 'help' | 'settings' | 'game';
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface HudState {
  health: number;
  hunger: number;
  slot: number;
  flying: boolean;
  sprinting: boolean;
  blockName: string;
  save: SaveStatus;
  fps: number;
  x: number;
  y: number;
  z: number;
  mode: GameMode;
  breaking: number;
  camera: 'first' | 'third';
  zoom: number;
}

export interface WorldUi {
  time: number;
  timeRunning: boolean;
  weather: 'clear' | 'rain';
  lineMode: boolean;
  ready: boolean;
  pointerLocked: boolean;
  loading: number;
  loadingLabel: string;
  fatal: string | null;
  touch: boolean;
}

interface Toast {
  id: number;
  text: string;
  at: number;
}

interface UiState {
  screen: ScreenId;
  activeWorldId: string | null;
  paused: boolean;
  inventoryOpen: boolean;
  creativeOpen: boolean;
  settingsOpen: boolean;
  helpOpen: boolean;
  confirm: { title: string; text: string; confirmLabel: string; onConfirm: () => void } | null;
  toasts: Toast[];
  slots: Slot[];
  hud: HudState;
  worldUi: WorldUi;
  setScreen: (screen: ScreenId) => void;
  setActiveWorldId: (id: string | null) => void;
  setPaused: (paused: boolean) => void;
  setInventoryOpen: (open: boolean) => void;
  setCreativeOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  setHelpOpen: (open: boolean) => void;
  ask: (title: string, text: string, confirmLabel: string, onConfirm: () => void) => void;
  closeConfirm: () => void;
  pushToast: (text: string) => void;
  dismissToast: (id: number) => void;
  setSlots: (slots: Slot[]) => void;
  setHud: (hud: Partial<HudState>) => void;
  setWorldUi: (worldUi: Partial<WorldUi>) => void;
}

let toastSeq = 1;

const hud: HudState = {
  health: 20,
  hunger: 20,
  slot: 0,
  flying: false,
  sprinting: false,
  blockName: '',
  save: 'idle',
  fps: 0,
  x: 0,
  y: 0,
  z: 0,
  mode: 'creative',
  breaking: 0,
  camera: 'first',
  zoom: 0,
};

const worldUi: WorldUi = {
  time: 0.32,
  timeRunning: true,
  weather: 'clear',
  lineMode: false,
  ready: false,
  pointerLocked: false,
  loading: 0,
  loadingLabel: 'Подготовка мира',
  fatal: null,
  touch: false,
};

export const useUi = create<UiState>((set) => ({
  screen: 'menu',
  activeWorldId: null,
  paused: false,
  inventoryOpen: false,
  creativeOpen: false,
  settingsOpen: false,
  helpOpen: false,
  confirm: null,
  toasts: [],
  slots: [],
  hud,
  worldUi,
  setScreen: (screen) => set({ screen }),
  setActiveWorldId: (activeWorldId) => set({ activeWorldId }),
  setPaused: (paused) => set({ paused }),
  setInventoryOpen: (inventoryOpen) => set({ inventoryOpen }),
  setCreativeOpen: (creativeOpen) => set({ creativeOpen }),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  setHelpOpen: (helpOpen) => set({ helpOpen }),
  ask: (title, text, confirmLabel, onConfirm) => set({ confirm: { title, text, confirmLabel, onConfirm } }),
  closeConfirm: () => set({ confirm: null }),
  pushToast: (text) => set((state) => {
    const last = state.toasts[state.toasts.length - 1];
    if (last && last.text === text && Date.now() - last.at < 1100) return state;
    return { toasts: [...state.toasts, { id: toastSeq++, text, at: Date.now() }].slice(-4) };
  }),
  dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
  setSlots: (slots) => set({ slots }),
  setHud: (patch) => set((state) => ({ hud: { ...state.hud, ...patch } })),
  setWorldUi: (patch) => set((state) => ({ worldUi: { ...state.worldUi, ...patch } })),
}));
