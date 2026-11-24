import { lazy, Suspense, useEffect, useRef } from 'react';
import { DataProvider } from './lib/data';
import { anchorFor, scrollToId, useRoute } from './lib/router';
import { featureByRoute, flagOn } from './features';
import { ToastProvider } from './components/ui';
import { Header } from './components/chrome/Header';
import { Banner } from './components/chrome/Banner';
import { StickyBar } from './components/chrome/StickyBar';
import { Footer } from './components/chrome/Footer';
import { LiveToasts } from './components/chrome/LiveToasts';
import { Home } from './pages/Home';
import { NotFound } from './pages/NotFound';
import { Soon } from './pages/Soon';

const Verify = lazy(() => import('./pages/Verify').then((m) => ({ default: m.Verify })));
const Briefings = lazy(() => import('./pages/Briefings').then((m) => ({ default: m.Briefings })));
const Docs = lazy(() => import('./pages/Docs').then((m) => ({ default: m.Docs })));
const Incidents = lazy(() => import('./pages/Incidents').then((m) => ({ default: m.Incidents })));
const Changelog = lazy(() => import('./pages/Changelog').then((m) => ({ default: m.Changelog })));
const Status = lazy(() => import('./pages/Status').then((m) => ({ default: m.Status })));

function Page({ path }: { path: string }) {
  let m: RegExpMatchArray | null;
  if (path === '/') return <Home />;
  if (path === '/verify') return <Verify />;
  if (path === '/briefings') return <Briefings id={null} />;
  if ((m = path.match(/^\/briefings\/(\d+)$/))) return <Briefings id={Number(m[1])} />;
  if (path === '/docs') return <Docs slug={null} />;
  if ((m = path.match(/^\/docs\/([\w-]+)$/))) return <Docs slug={m[1]} />;
  if (path === '/incidents') return <Incidents />;
  if (path === '/status') return <Status />;
  if (path === '/changelog') return <Changelog />; // renders with SHIP_LOG off too (feature 14)
  const f = featureByRoute(path);
  if (f?.flag && !flagOn(f.flag)) return <Soon feature={f} />;
  return <NotFound />;
}

export function App() {
  const { path, hash } = useRoute();
  const first = useRef(true);
  useEffect(() => {
    if (first.current && hash) scrollToId(anchorFor(hash));
    first.current = false;
  }, [hash]);
  return (
    <DataProvider>
      <ToastProvider>
        <a className="skip" href="#main">Skip to content</a>
        <Header path={path} />
        <Banner />
        <main id="main" tabIndex={-1}><Suspense fallback={<div style={{ minHeight: '100dvh' }} />}><Page path={path} /></Suspense></main>
        <Footer />
        <StickyBar path={path} />
        <LiveToasts />
      </ToastProvider>
    </DataProvider>
  );
}
