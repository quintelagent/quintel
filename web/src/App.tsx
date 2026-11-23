import { lazy, Suspense, useEffect } from 'react';
import { DataProvider } from './lib/data';
import { useRoute } from './lib/router';
import { initMotion } from './lib/motion';
import { Nav } from './sections/Nav';
import { Hero } from './sections/Hero';
import { LiveStrip } from './sections/LiveStrip';
import { DragPrice } from './sections/DragPrice';
import { WhatIf } from './sections/WhatIf';
import { WeekendGap } from './sections/WeekendGap';
import { Briefing } from './sections/Briefing';
import { Models } from './sections/Models';
import { Desk } from './sections/Desk';
import { Proof } from './sections/Proof';
import { HowItWorks } from './sections/HowItWorks';
import { Token } from './sections/Token';
import { FAQ } from './sections/FAQ';
import { Footer } from './sections/Footer';

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
      <WhatIf />
      <Briefing />
      <Models />
      <Desk />
      <Proof />
      <HowItWorks />
      <Token />
      <FAQ />
    </>
  );
}

export function App() {
  const { path } = useRoute();
  useEffect(() => { initMotion(); }, []);
  useEffect(() => {
    if (location.hash && path === '/') setTimeout(() => document.getElementById(location.hash.slice(1))?.scrollIntoView(), 300);
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
