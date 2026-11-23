import { lazy, Suspense, useEffect } from 'react';
import { DataProvider } from './lib/data';
import { useRoute } from './lib/router';
import { initMotion, scrollToId, whenIdle } from './lib/motion';
import { Nav } from './sections/Nav';
import { Hero } from './sections/Hero';
import { LiveStrip } from './sections/LiveStrip';
import { DragPrice } from './sections/DragPrice';
import { WeekendGap } from './sections/WeekendGap';
import { Footer } from './sections/Footer';

const loadBelow = () => import('./sections/Below');
const Below = lazy(loadBelow);
const Verify = lazy(() => import('./pages/Verify').then((m) => ({ default: m.Verify })));
const Briefings = lazy(() => import('./pages/Briefings').then((m) => ({ default: m.Briefings })));
const Docs = lazy(() => import('./pages/Docs').then((m) => ({ default: m.Docs })));

function Home() {
  return (
    <>
      <Hero />
      <LiveStrip />
      <WeekendGap />
      <DragPrice />
      <Suspense fallback={<div style={{ minHeight: '300vh' }} />}>
        <Below />
      </Suspense>
    </>
  );
}

export function App() {
  const { path } = useRoute();
  useEffect(() => { initMotion(); whenIdle(() => { loadBelow(); }, 1200); }, []);
  useEffect(() => {
    if (location.hash && path === '/') { loadBelow(); setTimeout(() => scrollToId(location.hash.slice(1)), 150); }
  }, [path]);
  let page = <Home />;
  if (path.startsWith('/verify')) page = <Verify />;
  else if (path.startsWith('/briefings')) page = <Briefings />;
  else if (path.startsWith('/docs')) page = <Docs />;
  return (
    <DataProvider>
      <Nav />
      <Suspense fallback={<div style={{ minHeight: '100vh' }} />}>{page}</Suspense>
      <Footer />
    </DataProvider>
  );
}
