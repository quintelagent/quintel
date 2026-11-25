import { useEffect, useState, type FormEvent } from 'react';
import type { Fingerprint } from '../lib/api';
import { useData } from '../lib/data';
import { etDate, etDateTime, etShortDate, etTime, hash, int, usd } from '../lib/format';
import { useMeta } from '../lib/meta';
import { isIncidentRun } from '../lib/metrics';
import { Link, navigate, useRoute } from '../lib/router';
import { CHAIN, HOURLY, LOAD, RECOMPUTE, parseTarget, useVerify, verdictOf, type CheckState, type HourFingerprint, type Lookup, type Verdict, type Verification } from '../lib/verify';
import { AddressChip, Button, Card, CodeBlock, DataTable, EmptyState, ErrorState, Input, Pill, Skeleton, Stat, type Column, type PillTone } from '../components/ui';
import { PixelMeter } from '../components/pixel';
import './verify.css';

const SUB = 'Paste a run ID or fingerprint. Your browser recomputes it and checks it against the chain.';
const SOURCES: Record<string, string> = { stock: 'Exchange quote', chain: 'Token on chain', last_close: 'Last close' };
const STEPS = [
  { title: 'Stored inputs', note: 'The exact prices and settings this run started from.' },
  { title: 'Input hash', note: 'The inputs hash to the value stored with the run.' },
  { title: 'Seed', note: 'The random seed comes from the inputs and the run time, nothing else.' },
  { title: '1,000,000 futures', note: 'Made again in your browser, then hashed and compared.' },
  { title: 'Hourly fingerprint', note: 'The hour’s fingerprint contains this run and recomputes.' },
  { title: 'Robinhood Chain', note: 'The data in the transaction is that fingerprint, read from a public node.' },
];
const STATES: Record<CheckState, [string, PillTone]> = { idle: ['Next', 'muted'], running: ['Checking', 'muted'], ok: ['Match', 'default'], fail: ['No match', 'risk'], wait: ['Waiting', 'muted'], stuck: ['Not checked', 'muted'] };
const VERDICTS: Record<Verdict, { pill: string; tone: PillTone; text: string }> = {
  checking: { pill: 'Checking', tone: 'default', text: '' },
  verified: { pill: 'Verified', tone: 'invert', text: 'All 6 checks passed. The fingerprint was read from Robinhood Chain.' },
  waiting: { pill: 'Fingerprint waiting to post', tone: 'default', text: 'Every check that can run now passed. The chain check comes after the fingerprint posts.' },
  unread: { pill: 'Chain not read', tone: 'default', text: 'Couldn’t read the chain just now. The other checks passed.' },
  unfinished: { pill: 'Not finished', tone: 'default', text: 'Some checks couldn’t run just now. Nothing checked so far failed.' },
  mismatch: { pill: 'Doesn’t match', tone: 'risk', text: 'At least one check did not match. The steps show which.' },
};
const link = (id: number | string) => `/verify?run=${id}`;
/** One sentence for screen readers, said when a lookup starts and when it ends. */
function spoken(l: Lookup): string {
  if (l.kind === 'finding') return 'Checking';
  if (l.kind === 'missing') return 'No run matches that ID.';
  if (l.kind === 'hour') return `Fingerprint found for the hour starting ${etTime(l.fingerprint.hour)}.`;
  if (l.kind !== 'run') return '';
  if (!l.v.done) return `Checking run ${l.v.id}`;
  const { pill, text } = VERDICTS[verdictOf(l.v)];
  return `Run ${l.v.id}. ${pill}. ${text}`;
}

export function Verify() {
  useMeta('Verify a run · Quintel', SUB);
  const asked = useRoute().query.get('run')?.trim() ?? '';
  const { latest } = useData();
  const [value, setValue] = useState(asked);
  const [err, setErr] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const target = parseTarget(asked);
  const result = useVerify(asked, attempt);
  const again = () => setAttempt((n) => n + 1);
  useEffect(() => { setValue(asked); setErr(null); }, [asked]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const text = value.trim() || String(latest?.run?.id ?? '');
    if (!text) { setErr('The latest run isn’t loaded yet. Enter a run number instead.'); return; }
    const t = parseTarget(text);
    if (!t) { setErr('Enter a run number or a 0x hash.'); return; }
    const id = 'run' in t ? String(t.run) : t.hash;
    if (id === asked) again();
    else navigate(link(id));
  };

  return (
    <div className="page wrap">
      <div className="page-head"><h1>Verify a run.</h1><p>{SUB}</p></div>
      <form className="verify-form" onSubmit={submit} noValidate>
        <Input label="Run number or 0x hash" numeric inputMode="text" value={value} onChange={(e) => { setValue(e.target.value); setErr(null); }} error={err} hint="Leave it empty to check the latest run." maxLength={80} autoCapitalize="off" autoCorrect="off" spellCheck={false} enterKeyHint="go" />
        <Button type="submit">Verify</Button>
      </form>
      <p className="vh" role="status">{spoken(result)}</p>
      <div className="verify-result">
        {result.kind === 'finding' && (target && 'run' in target ? <Result id={String(target.run)} v={null} again={again} /> : <Finding />)}
        {result.kind === 'run' && <Result id={String(result.v.id)} v={result.v} again={again} />}
        {result.kind === 'hour' && <Hour f={result.fingerprint} />}
        {result.kind === 'error' && <Card className="verify-none"><ErrorState text="Couldn’t load that run. Try again." onRetry={again} /></Card>}
        {result.kind === 'missing' && (
          <Card className="verify-none">
            <EmptyState
              text={<>No run matches that ID. Check it and try again.{result.byHash && <span className="note verify-range">Hash search covers the last 7 days of runs and every hourly fingerprint.</span>}</>}
              action={latest?.run ? <Button variant="secondary" href={link(latest.run.id)}>Verify run {latest.run.id}</Button> : !latest && <Skeleton h={48} w={160} />}
            />
          </Card>
        )}
      </div>
      <Fingerprints />
      <section className="verify-cli" aria-labelledby="verify-cli">
        <h2 id="verify-cli">Prefer a terminal?</h2>
        <p className="muted">The same engine runs from the command line and prints each check.</p>
        <CodeBlock code={`npx tsx engine/verify.ts ${result.kind === 'run' ? result.v.id : '<runId>'}`} />
        <Link className="verify-link" href="/docs/proof">How the proof works</Link>
      </section>
    </div>
  );
}

function Result({ id, v, again }: { id: string; v: Verification | null; again: () => void }) {
  const { proof, config } = useData();
  const explorer = proof?.explorer ?? config?.explorer;
  const verdict = v ? verdictOf(v) : 'checking';
  const { pill, tone, text } = VERDICTS[verdict];
  const run = v?.run ?? null, fp = v?.fingerprint ?? null;
  const pct = Math.round((v?.progress ?? 0) * 100);
  const title = `Run ${id}`;
  const chain = v?.checks[CHAIN].state;
  const noBlock = chain !== 'wait' ? 'Not read' : fp?.tx ? 'Not in a block yet' : 'Not posted yet';
  return (
    <Card as="section" className="verify-card" aria-label={title}>
      <div className="verify-head">
        <div className="verify-title verify-title-run"><h2>{title}</h2><Pill tone={tone}>{pill}</Pill></div>
        <div className="verify-verdict">
          {text ? <p>{text}</p> : (
            <div className="verify-progress"><PixelMeter value={v?.progress ?? 0} label={`Recomputing in your browser, ${pct}% done`} /><span className="note mono">{v?.checks[RECOMPUTE].state === 'running' ? `Making 1,000,000 futures, ${pct}%` : v && pct === 100 ? 'Reading the fingerprint' : 'Loading the inputs'}</span></div>
          )}
          {v?.done && (verdict === 'unread' || verdict === 'unfinished') && <Button variant="secondary" onClick={again}>Try again</Button>}
        </div>
        {v && isIncidentRun(v.id) && <p className="note">This run started from a stale price.{(verdict === 'checking' || ['verified', 'waiting', 'unread'].includes(verdict)) && <span className={verdict === 'checking' ? 'verify-hold' : undefined}> Its hashes still verify.</span>} <Link className="verify-link" href="/incidents">See incidents</Link></p>}
      </div>
      <div className="verify-inputs">
        <Stat label="Run time" note={run ? etDate(run.inputs.asOf) : <>&nbsp;</>}>{run ? etTime(run.inputs.asOf) : <Skeleton h={24} w={112} />}</Stat>
        <Stat label="Starting price" note={run ? SOURCES[run.inputs.priceSource] ?? 'Source not stated' : <>&nbsp;</>}>{run ? usd(run.inputs.spot) : <Skeleton h={24} w={112} />}</Stat>
        <Stat label="Daily closes used">{run ? int(run.inputs.closes.length) : <Skeleton h={24} w={64} />}</Stat>
        <Stat label="News intensity" note="From 0 to 1">{run ? run.inputs.newsIntensity.toFixed(2) : <Skeleton h={24} w={64} />}</Stat>
        <Stat label="Futures">{run ? int(run.output.totalPaths) : <Skeleton h={24} w={112} />}</Stat>
        <Stat label="Input version">{run ? run.inputs.version : <Skeleton h={24} w={32} />}</Stat>
      </div>
      <ol className="verify-steps">
        {STEPS.map((s, i) => {
          const c = v?.checks[i] ?? { state: i === LOAD ? 'running' as const : 'idle' as const, detail: undefined };
          const [word, t] = STATES[c.state];
          return (
            <li key={s.title}>
              <span className="label" aria-hidden="true">{i + 1}</span>
              <div><h3>{s.title}</h3><p className="note">{s.note}</p><p className={`verify-detail note${c.state === 'wait' || c.state === 'stuck' ? '' : ' mono'}`}>{c.detail ?? (c.state === 'stuck' ? 'This check couldn’t run just now.' : <>&nbsp;</>)}</p></div>
              <Pill tone={t}>{i === LOAD && c.state === 'ok' ? 'Loaded' : i === CHAIN && c.state === 'stuck' ? 'Not read' : word}</Pill>
            </li>
          );
        })}
      </ol>
      <div className="verify-fp">
        {fp ? (
          <>
            <div className="label">Fingerprint for the hour starting {etTime(fp.hour)}, {etDate(fp.hour)}</div>
            <CodeBlock code={fp.hash} />
            <div className="verify-chain">
              <Stat label="Block number">{v?.block != null ? int(v.block) : v?.done ? noBlock : <Skeleton h={24} w={128} />}</Stat>
              {fp.tx && explorer && <Button variant="secondary" href={`${explorer}/tx/${fp.tx}`}>View on explorer</Button>}
            </div>
          </>
        ) : v?.done ? <p className="note">{v.checks[HOURLY].state === 'stuck' ? 'Couldn’t load the fingerprint just now.' : 'This run has no fingerprint to show yet.'}</p> : <><Skeleton h={18} w="70%" /><Skeleton h={60} /><Skeleton h={48} w={192} /></>}
      </div>
    </Card>
  );
}

/** Same shape as Hour, the usual answer to a hash. */
function Finding() {
  return (
    <Card as="section" className="verify-hour" aria-label="Finding that hash">
      <div className="verify-title verify-title-run"><h2>Finding that hash</h2><Pill>Checking</Pill></div>
      <Skeleton className="verify-ghost-line" h={26} />
      <Skeleton h={60} /><Skeleton h={48} w={192} /><Skeleton h={44} w={144} />
    </Card>
  );
}

/** A fingerprint covers an hour, so it opens the list of runs in that hour. */
function Hour({ f }: { f: HourFingerprint }) {
  const { proof, config } = useData();
  const explorer = proof?.explorer ?? config?.explorer;
  const ids = f.payload?.runIds ?? [];
  return (
    <Card as="section" className="verify-hour" aria-label="Fingerprint">
      <div className="verify-title verify-title-run"><h2>Hour starting {etTime(f.hour)}</h2><PostedPill f={f} /></div>
      <p className="muted">{etDate(f.hour)}. {f.sent_at ? `Sent ${etDateTime(f.sent_at)}.` : 'Recorded, not on chain yet.'} {ids.length > 0 ? 'Pick a run to check every hash.' : 'No runs are in this hour.'}</p>
      <CodeBlock code={f.hash} />
      {ids.length > 0 && <div className="row">{ids.map((id) => <Button key={id} variant="secondary" href={link(id)}>Run {id}</Button>)}</div>}
      {f.tx && explorer && <Link className="verify-link" href={`${explorer}/tx/${f.tx}`}>View on explorer</Link>}
    </Card>
  );
}

const posted = (f: Fingerprint) => f.status === 'sent' && !!f.tx;
const PostedPill = ({ f }: { f: Fingerprint }) => <Pill tone={posted(f) ? 'default' : 'muted'}>{posted(f) ? 'Posted' : 'Waiting'}</Pill>;

function Fingerprints() {
  const { proof: p, proofError, reloadProof, config } = useData();
  const rows = p?.fingerprints.slice(0, 10) ?? [];
  const cols: Column<Fingerprint>[] = [
    { key: 'hour', head: 'Hour starting', mono: true, cell: (f) => `${etShortDate(f.hour)}, ${etTime(f.hour)}` },
    { key: 'hash', head: 'Fingerprint', mono: true, cell: (f) => <Link className="verify-link" href={link(f.hash)} aria-label={`Show the runs in fingerprint ${hash(f.hash)}`}>{hash(f.hash)}</Link> },
    { key: 'status', head: 'Status', cell: (f) => <span className="verify-status"><PostedPill f={f} />{posted(f) && f.sent_at && <span className="note mono">{etShortDate(f.sent_at)}, {etTime(f.sent_at)}</span>}</span> },
    { key: 'tx', head: 'Transaction', mono: true, end: true, cell: (f) => (posted(f) ? <Link className="verify-link" href={`${p!.explorer}/tx/${f.tx}`} aria-label={`View transaction ${hash(f.tx)} on explorer`}>{hash(f.tx)}</Link> : <span className="verify-unposted muted">Not posted yet</span>) },
  ];
  return (
    <section className="verify-list" aria-labelledby="verify-latest">
      <h2 id="verify-latest">Latest fingerprints</h2>
      <div className="verify-count">
        {p ? rows.length > 0 && <p className="muted">{int(p.sent)} on chain, {int(p.pending)} waiting. Each one covers an hour of runs.</p> : !proofError && <Skeleton h={26} w={320} />}
        <div className="verify-wallet"><span className="label">Fingerprint wallet</span>{p || config ? <AddressChip address={p?.wallet ?? config?.fingerprintWallet} empty="Not posted yet" /> : <Skeleton h={44} w={192} />}</div>
      </div>
      <Card>
        {!p && proofError ? <ErrorState text="Couldn’t load the fingerprints. Try again." onRetry={reloadProof} />
          : !p ? <div className="verify-ghosts" aria-hidden="true">{Array.from({ length: 10 }, (_, i) => <div key={i}><Skeleton h={24} /></div>)}</div>
          : rows.length === 0 ? <EmptyState text="The first fingerprint is made after the first full hour of runs." />
          : <DataTable caption="Latest fingerprints" columns={cols} rows={rows} rowKey={(f) => f.hour} />}
      </Card>
    </section>
  );
}
