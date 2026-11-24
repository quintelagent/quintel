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
// Safari can run this script before the stylesheet arrives, and the pixel graphics read their colors from it
let mounted = false;
const mount = () => { if (!mounted) { mounted = true; createRoot(document.getElementById('root')!).render(<App />); } };
const styled = () => getComputedStyle(document.documentElement).getPropertyValue('--ink') !== '';
if (styled() || document.readyState === 'complete') mount();
else {
  document.querySelectorAll('link[rel="stylesheet"]').forEach((l) => { l.addEventListener('load', () => { if (styled()) mount(); }); l.addEventListener('error', mount); });
  window.addEventListener('load', mount);
}
