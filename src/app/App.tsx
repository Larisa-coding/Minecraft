import { useEffect } from 'react';
import { ConfirmHost, Notifications } from '../components/ui';
import { useSettings } from '../store/settingsStore';
import { useUi } from '../store/uiStore';
import { GameScreen } from '../screens/GameScreen';
import { HowToPlay } from '../screens/HowToPlay';
import { MainMenu } from '../screens/MainMenu';
import { SettingsScreen } from '../screens/SettingsScreen';
import { WorldCreate } from '../screens/WorldCreate';
import { WorldList } from '../screens/WorldList';

export const App = () => {
  const screen = useUi((state) => state.screen);
  const theme = useSettings((state) => state.ui.theme);
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  return (
    <div className="app">
      {screen === 'menu' && <MainMenu />}
      {screen === 'worlds' && <WorldList />}
      {screen === 'create' && <WorldCreate />}
      {screen === 'settings' && <SettingsScreen />}
      {screen === 'help' && <HowToPlay />}
      {screen === 'game' && <GameScreen />}
      <Notifications />
      <ConfirmHost />
    </div>
  );
};
