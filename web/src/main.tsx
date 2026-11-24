import { createRoot } from 'react-dom/client';
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/chrome.css';
import { App } from './App';

// a tab opened before a deploy may ask for a chunk that no longer exists: reload once
window.addEventListener('vite:preloadError', (e) => {
  try { if (sessionStorage.getItem('q-reload')) return; sessionStorage.setItem('q-reload', '1'); } catch { return; }
  e.preventDefault();
  location.reload();
});
createRoot(document.getElementById('root')!).render(<App />);
