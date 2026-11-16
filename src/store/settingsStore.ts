import { create } from 'zustand';
import { defaultSettings, loadSettings, saveSettings, type Settings } from '../storage/settings';

interface SettingsState extends Settings {
  replace: (settings: Settings) => void;
  patch: (recipe: (settings: Settings) => Settings) => void;
  reset: () => void;
}

const persist = (settings: Settings): Settings => {
  saveSettings(settings);
  return settings;
};

export const useSettings = create<SettingsState>((set) => ({
  ...loadSettings(),
  replace: (settings) => set(persist(settings)),
  patch: (recipe) => set((state) => {
    const next = recipe({
      graphics: state.graphics,
      controls: state.controls,
      audio: state.audio,
      ui: state.ui,
      tutorialSeen: state.tutorialSeen,
      lastWorldId: state.lastWorldId,
    });
    return persist(next);
  }),
  reset: () => set(persist({ ...defaultSettings(), tutorialSeen: true })),
}));
