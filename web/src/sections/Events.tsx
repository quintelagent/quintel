import { useData } from '../lib/data';
import { visibleEvents, type EventState, type SiteEvent } from '../lib/events';
import { etDate, etDay, etTime } from '../lib/format';
import { useNow } from '../lib/hooks';
import { Link } from '../lib/router';
import { openTool } from '../lib/toolPreset';
import { Button, Card, Countdown, EmptyState, ErrorState, Pill, Section, Skeleton, Stat } from '../components/ui';
import './events.css';

export function Events() {
  const { config, configError, reloadConfig } = useData();
  const now = useNow(15000);
  const rows = visibleEvents(config, now);

  return (
    <Section id="events" title="The dates ahead." sub="Countdowns to the next market closures and hearings.">
      {config && !rows.length ? <Card><EmptyState text="No dates on the calendar right now." /></Card> : (
        <ul className="ev-list">
          {rows.map(({ event, state }) => <Row key={event.id} e={event} state={state} />)}
          {!config && (
            <li className="ev-row">
              {configError ? <ErrorState text="Couldn’t load the next hearing date. Try again." onRetry={reloadConfig} /> : <Placeholder />}
            </li>
          )}
        </ul>
      )}
    </Section>
  );
}

function Row({ e, state }: { e: SiteEvent; state: EventState }) {
  const done = state === 'done';
  return (
    <li className={done ? 'ev-row muted' : 'ev-row'}>
      <div className="ev-what">
        <h3>{e.label}</h3>
        <div className="mono ev-date">{etDate(e.date)}</div>
        {e.type === 'hearing' && (
          <div className="note ev-src">Time not reported{e.url && <Link href={e.url} aria-label={`Source: ${e.label}`}>Source</Link>}</div>
        )}
      </div>
      <div className="ev-when">
        {state === 'upcoming' ? <Stat label={`Until ${e.type === 'hearing' ? etDate(e.date) : `${etDay(e.start)} ${etTime(e.start)}`}`}><Countdown to={e.start} /></Stat>
          : state === 'today' ? <Pill tone="invert">Today</Pill>
          : done ? <Pill tone="muted">Done</Pill>
          : <Pill>Market closed</Pill>}
      </div>
      {!done && (
        <div className="ev-do">
          <Button variant="secondary" aria-label={`What if? ${e.label}`} onClick={() => openTool(e.preset.tab, { closure: e.preset.closure, whatIfId: e.preset.whatIfId })}>What if?</Button>
        </div>
      )}
    </li>
  );
}

function Placeholder() {
  return (
    <>
      <div className="ev-what"><h3 className="ev-ph"><Skeleton h={24} w={152} /><Skeleton h={24} w={172} /></h3><div className="mono ev-date"><Skeleton h="1.5em" w="8em" /></div><div className="note ev-src"><Skeleton h={20} w={184} /></div></div>
      <div className="ev-when"><Skeleton h={48} w={144} /></div>
      <div className="ev-do"><Skeleton h={48} w={120} /></div>
    </>
  );
}
