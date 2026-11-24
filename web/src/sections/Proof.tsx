import { useState, type FormEvent } from 'react';
import { AddressChip, Button, Card, CodeBlock, EmptyState, ErrorState, Input, Pill, Section, Skeleton, Stat } from '../components/ui';
import { PixelBars, PixelFlow } from '../components/pixel';
import { Link, navigate } from '../lib/router';
import { useApi, type Proof as ProofData, type Scorecard } from '../lib/api';
import { useData } from '../lib/data';
import { etDate, etTime, int, pct } from '../lib/format';
import { flagOn } from '../features';
import './proof.css';

const STEPS = [
  { title: 'Research agent', note: 'Scores the headlines that feed each run.' },
  { title: '5 models', note: 'Same inputs, five sets of assumptions.' },
  { title: '1,000,000 futures', note: '200,000 from each model, 21 trading days ahead.' },
  { title: 'Scenario odds', note: 'Stored with the inputs and the seed.' },
  { title: 'Fingerprint on chain', note: 'One hash per hour, sent to Robinhood Chain.' },
];
const prints = (n: number) => `${int(n)} ${n === 1 ? 'fingerprint' : 'fingerprints'}`;

function LatestFingerprint({ p }: { p: ProofData | null }) {
  const f = p?.fingerprints.find((x) => x.status === 'sent' && x.sent_at) ?? null;
  return (
    <Card className="proof-latest">
      <div className="proof-head">
        <h3>Latest fingerprint on chain</h3>
        {!p ? <Skeleton h={28} w={208} /> : p.pending > 0 ? <Pill tone="muted">{prints(p.pending)} waiting</Pill> : p.lockedFromDayOne ? <Pill>Locked from day one</Pill> : f ? <Pill>None waiting</Pill> : null}
      </div>
      {p && !f ? (
        <EmptyState text={p.sent > 0 ? `${prints(p.sent)} on chain. The newest are recorded and waiting to be sent.` : p.pending ? `No fingerprint is on chain yet. ${prints(p.pending)} recorded and waiting.` : 'The first fingerprint is made after the first full hour of runs.'} />
      ) : (
        <>
          <div className="proof-stats">
            <Stat label="Hour starting" note={f ? etDate(f.hour) : <>&nbsp;</>}>{f ? etTime(f.hour) : <Skeleton h={24} w={112} />}</Stat>
            <Stat label="Sent" note={f ? etDate(f.sent_at) : <>&nbsp;</>}>{f ? etTime(f.sent_at) : <Skeleton h={24} w={112} />}</Stat>
          </div>
          {f ? <CodeBlock code={f.hash} /> : <Skeleton h={60} />}
          {!p || !f ? <Skeleton h={48} w={180} /> : f.tx && <Button variant="secondary" href={`${p.explorer}/tx/${f.tx}`}>View on explorer</Button>}
        </>
      )}
      <p className="note">Each fingerprint is a transaction of zero value from the fingerprint wallet to itself on Robinhood Chain. Waiting ones are recorded and tried every 10 minutes, oldest first.</p>
    </Card>
  );
}

/** `wallet` undefined means still loading. */
function VerifyCard({ wallet, latestId }: { wallet: string | null | undefined; latestId: number | null }) {
  const [v, set] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const id = v ? Number(v) : latestId;
    if (!id) { setErr('Enter a run number.'); return; }
    navigate(`/verify?run=${id}`);
  };
  return (
    <Card className="proof-verify">
      <h3>Check any run yourself</h3>
      <p className="muted">Your browser loads the stored inputs and seed, makes all 1,000,000 futures again and compares the hash.</p>
      <form onSubmit={submit} className="stack" noValidate>
        <Input
          label="Run number" numeric inputMode="numeric" maxLength={9} value={v} error={err}
          onChange={(e) => { set(e.target.value.replace(/\D/g, '')); setErr(null); }}
          placeholder={latestId ? `${latestId} is the latest` : undefined}
        />
        <Button type="submit">Verify a run</Button>
      </form>
      <div className="proof-wallet">
        <div className="label">Fingerprint wallet</div>
        {wallet === undefined ? <Skeleton h={44} w={192} /> : <AddressChip address={wallet} empty="Not available" />}
      </div>
    </Card>
  );
}

/** Next-close results only. The stored bands are the 90% ones. */
function ScorecardTeaser() {
  const { data, error, reload } = useApi<Scorecard>('/api/scorecard', 300000);
  const h = data?.horizons.find((x) => x.horizon === 1);
  const rows = (data?.recent ?? []).filter((r) => r.horizon === 1).slice(0, 30).reverse();
  const hits = h ? Math.round(h.n * h.rate90) : 0;
  return (
    <Card className="proof-score">
      <h3>Daily scorecard</h3>
      {error && !data ? <ErrorState text="Couldn’t load the scorecard. Try again." onRetry={reload} />
        : !data ? <Skeleton h={144} />
        : !h || !h.n ? <EmptyState text="Collecting data. The first score posts after the next market close." />
        : (
          <>
            <p>Inside the 90% band {int(hits)} of {int(h.n)} {h.n === 1 ? 'day' : 'days'} ({pct(hits / h.n)}).</p>
            {rows.length > 0 && <div className="stack"><div className="label">Last {rows.length} scored {rows.length === 1 ? 'day' : 'days'}, oldest first</div><PixelBars height={16} values={Array.from({ length: 30 }, (_, i) => (i < rows.length ? 1 : 0))} risk={(i) => i < rows.length && !rows[i].in90} label={`Last ${rows.length} scored days: ${rows.filter((r) => r.in90).length} inside the 90% band, ${rows.filter((r) => !r.in90).length} outside`} /></div>}
          </>
        )}
      <Link className="proof-link" href="/scorecard">See the scorecard</Link>
    </Card>
  );
}

export function Proof() {
  const { proof: p, proofError, reloadProof, latest, config } = useData();
  const wallet = p?.wallet ?? config?.fingerprintWallet ?? (p || proofError ? null : undefined);
  const done = !!p && p.pending === 0 && p.sent > 0;
  return (
    <Section
      id="proof"
      title={done ? 'Every hour, a fingerprint of every run goes on Robinhood Chain.' : 'Every hour of runs gets a fingerprint.'}
      sub="The hashes of an hour’s runs, briefings and paper desk become one fingerprint. Change one number and it no longer matches."
    >
      <div className="proof">
        <PixelFlow steps={STEPS} label="How a run becomes a fingerprint" />
        <div className="proof-grid">
          {!p && proofError ? <Card><ErrorState text="Couldn’t load the fingerprints. Try again." onRetry={reloadProof} /></Card> : <LatestFingerprint p={p} />}
          <VerifyCard wallet={wallet} latestId={latest?.run?.id ?? null} />
        </div>
        {flagOn('DAILY_SCORECARD_PUBLIC') && <ScorecardTeaser />}
      </div>
    </Section>
  );
}
