import { Pill, Section, Skeleton, Stat } from '../components/ui';
import { useData } from '../lib/data';
import { etShortDate, etTime } from '../lib/format';
import { useNow } from '../lib/hooks';
import { cadenceMin, isDelayed } from '../lib/marketState';
import { Link } from '../lib/router';
import './stats.css';

const LATE = 2 * 3600000; // fingerprints are hourly

function Cadence() {
  return <>{cadenceMin(useNow(30000))} min</>;
}

/** Newest fingerprint that is really on chain, by when it was sent. */
function LastFingerprint() {
  const { proof, proofError, latest } = useData();
  const now = useNow(30000);
  const sent = proof?.fingerprints.filter((f) => f.status === 'sent' && f.sent_at).map((f) => f.sent_at!).sort().pop() ?? null;
  const late = isDelayed(latest?.run?.ts, now) || (!sent && !!proof?.sent) || (!!sent && now.getTime() - new Date(sent).getTime() > LATE);
  const day = sent && etShortDate(sent) !== etShortDate(now) ? `, ${etShortDate(sent)}` : '';
  const note = late ? <Pill>Delayed</Pill> : proof && !sent ? 'None posted yet' : !proof && proofError ? 'Couldn’t load yet' : null;
  return (
    <Link href="/verify" className="stats-link" aria-label={`Last fingerprint${sent ? `${day}, ${etTime(sent)}` : proof && !late ? ', none posted yet' : !proof && proofError && !late ? ', couldn’t load yet' : ''}${late ? ', delayed' : ''}. Verify a run`}>
      <Stat label={<u>last fingerprint{day}</u>} note={note}>{proof || proofError ? etTime(sent) : <Skeleton h="1.2em" w="100%" />}</Stat>
    </Link>
  );
}

export function StatsStrip() {
  return (
    <Section className="stats">
      <div className="stats-row">
        <Stat label="futures per run">1,000,000</Stat>
        <Stat label="between runs"><Cadence /></Stat>
        <LastFingerprint />
      </div>
    </Section>
  );
}
