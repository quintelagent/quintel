import { useEffect, useRef, useState } from 'react';
import { Card, Section, SegmentedTabs, type TabItem } from '../components/ui';
import { useInView } from '../lib/hooks';
import { TOOL_TABS, useRoute, type ToolTab } from '../lib/router';
import { DEFAULT_SYMBOL } from '../lib/symbols';
import { useToolPreset } from '../lib/toolPreset';
import { DragTab } from './tool/DragTab';
import { PositionTab } from './tool/PositionTab';
import { WeekendTab } from './tool/WeekendTab';
import { WhatIfTab } from './tool/WhatIfTab';
import './tool.css';

const TABS: TabItem<ToolTab>[] = [
  { id: 'drag', label: 'Drag a price' }, { id: 'whatif', label: 'What-if' },
  { id: 'weekend', label: 'Weekend gap' }, { id: 'position', label: 'My position' },
];
const tabFrom = (hash: string) => (TOOL_TABS as readonly string[]).includes(hash) ? (hash as ToolTab) : null;
let appliedPreset = 0;

export function Tool({ symbol = DEFAULT_SYMBOL }: { symbol?: string }) {
  const route = useRoute();
  const preset = useToolPreset();
  const [tab, setTab] = useState<ToolTab>(() => tabFrom(route.hash) ?? 'drag');
  const [seen, setSeen] = useState<ToolTab[]>([]);
  const [whatIf, setWhatIf] = useState<{ id: string; n: number } | null>(null);
  const [closure, setClosure] = useState<string | null>(null);
  const card = useRef<HTMLDivElement>(null);
  const near = useInView(card, '400px');

  // every navigation makes a new route object, so a repeat of the same deep link still selects its tab
  useEffect(() => { const t = tabFrom(route.hash); if (t) { setTab(t); setClosure(null); } }, [route]);
  useEffect(() => {
    if (!preset || preset.n <= appliedPreset) return;
    appliedPreset = preset.n;
    setTab(preset.tab);
    if (preset.whatIfId) setWhatIf({ id: preset.whatIfId, n: preset.n });
    setClosure(preset.closure ?? null);
  }, [preset]);
  useEffect(() => {
    setSeen((s) => (s.includes(tab) ? s : [...s, tab]));
    // on phone the tab row scrolls sideways: bring the selected tab into it
    const b = document.getElementById(`tool-tab-${tab}`), row = b?.parentElement;
    if (b && row) row.scrollLeft = b.offsetLeft - row.offsetLeft - (row.clientWidth - b.offsetWidth) / 2;
  }, [tab]);

  const pick = (t: ToolTab) => {
    setTab(t);
    setClosure(null);
    history.replaceState(history.state, '', `${location.pathname}${location.search}#${t}`);
  };
  const panel = (t: ToolTab) => {
    if (t !== tab && !seen.includes(t)) return null;
    const active = near && t === tab;
    if (t === 'drag') return <DragTab symbol={symbol} />;
    if (t === 'whatif') return <WhatIfTab symbol={symbol} active={active} preset={whatIf} />;
    if (t === 'weekend') return <WeekendTab symbol={symbol} closure={closure} />;
    return <PositionTab symbol={symbol} active={active} />;
  };

  return (
    <Section id="tool" title="Pick a price. See the odds." sub="Four ways to ask the latest run. The answers are worked out on your device.">
      <div ref={card}>
        <Card className="tool">
          <SegmentedTabs items={TABS} value={tab} onChange={pick} label="Tools" idBase="tool" />
          {TABS.map(({ id }) => <div key={id} role="tabpanel" id={`tool-panel-${id}`} aria-labelledby={`tool-tab-${id}`} hidden={id !== tab}>{panel(id)}</div>)}
        </Card>
      </div>
    </Section>
  );
}
