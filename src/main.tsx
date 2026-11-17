import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { ErrorBoundary } from './app/ErrorBoundary';
import './styles/global.css';

const root = document.getElementById('root');
if (!root) throw new Error('Нет корневого элемента');

const pinViewport = () => {
  document.documentElement.style.setProperty('--app-h', `${window.innerHeight}px`);
};
pinViewport();
window.addEventListener('orientationchange', () => window.setTimeout(pinViewport, 400));

document.addEventListener('touchmove', (event) => {
  const target = event.target;
  if (target instanceof Element && target.closest('.panel, .screen, input, textarea, select')) return;
  if (event.cancelable) event.preventDefault();
}, { passive: false });
document.addEventListener('gesturestart', (event) => event.preventDefault());

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
