import type { Slot } from '../inventory/inventory';

export interface GameApi {
  setMove: (strafe: number, forward: number) => void;
  addLook: (dx: number, dy: number) => void;
  setJump: (value: boolean) => void;
  setSprint: (value: boolean) => void;
  setSneak: (value: boolean) => void;
  setBreaking: (value: boolean) => void;
  setPlacing: (value: boolean) => void;
  placeAt: (x: number, y: number) => void;
  nudgeZoom: (amount: number) => void;
  toggleFly: () => void;
  selectSlot: (index: number) => void;
  setSlots: (slots: Slot[]) => void;
  pause: () => void;
  resume: () => void;
  save: () => Promise<void>;
  leave: () => Promise<void>;
  respawnAtSpawn: () => void;
  setTime: (time: number) => void;
  setTimeRunning: (value: boolean) => void;
  setWeather: (weather: 'clear' | 'rain') => void;
  toggleLine: () => void;
  toggleCamera: () => void;
  photo: () => void;
}

let current: GameApi | null = null;

export const bindGame = (api: GameApi | null): void => {
  current = api;
};

export const game = (): GameApi | null => current;
