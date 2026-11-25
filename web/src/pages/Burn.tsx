import { useEffect, useMemo, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { Answer, PriceBars } from '../sections/tool/DragTab';
import { api, useApi, type Loaded, type SiteConfig } from '../lib/api';
import {
  aboveLine, BURN_HORIZONS, burnMessage, burnTransfer, DEAD_ADDRESS, errorText, isTxHash, parseScenario, priceInSpan, same, sendRequest, shockLine, SHOCK_BOUNDS, statsOf, waitMinutes, WALLET_TEXT, when,
  type BurnBodyJson, type BurnErrorCode, type BurnHorizon, type BurnRequestView, type BurnSummary, type GalleryItem, type Scenario,
} from '../lib/burn';
import { recheck } from '../lib/burnCheck';
import { useData } from '../lib/data';
import { addr, etDateTime, etTime, hash, int, odds, pctChange, usd } from '../lib/format';
import { useNow, useStored } from '../lib/hooks';
import { isDelayed } from '../lib/marketState';
import { useMeta } from '../lib/meta';
import { axisOf, NO_SHOCK, parseAmount } from '../lib/odds';
import { Link, useRoute } from '../lib/router';
import { DEFAULT_SYMBOL } from '../lib/symbols';
import { problemOf, readBalance, readDecimals, isContractWallet, sendBurn, signText, switchChain, useWallet, walletChain, type Wallet } from '../lib/wallet';
import { Accordion, AddressChip, Button, Card, CodeBlock, CopyButton, EmptyState, ErrorState, Input, NumberRoll, Pill, SegmentedTabs, Sheet, Skeleton, Slider, Stat } from '../components/ui';
import { PixelField, PixelMeter, PixelSpark } from '../components/pixel';
import './burn.css';

const SUB = 'Burn $QNTL to run 1,000,000 futures on your own scenario. The burn and the result are public.';
const DISCLAIMER = 'Not affiliated with Nvidia, Robinhood, Pons or Pump.fun. Not financial advice.';
const HORIZONS = ([1, 5, 21] as const).map((h) => ({ id: String(h) as `${BurnHorizon}`, label: BURN_HORIZONS[h] }));
const ORIGIN = 'https://quintelagent.com';
const runLink = (id: number) => `/burn?request=${id}`;

type Send =
  | { kind: 'idle' } | { kind: 'sign' } | { kind: 'checking' }
  | { kind: 'waiting'; confirmations: number; needed: number }
  | { kind: 'error'; code: BurnErrorCode } | { kind: 'wallet'; text: string };

/** Posts a signed request and keeps asking while the chain confirms the burn. */
function useSend(onDone: (id: number) => void) {
  const [state, set] = useState<Send>({ kind: 'idle' });
  const gen = useRef(0), last = useRef<{ body: BurnBodyJson; freshTx: boolean } | null>(null);
  useEffect(() => () => { gen.current++; }, []);
  const send = async (body: BurnBodyJson, freshTx: boolean) => {
    const g = ++gen.current;
    last.current = { body, freshTx };
    set({ kind: 'checking' });
    for (let i = 0; ; i++) {
      const r = await sendRequest(body);
      if (g !== gen.current) return;
      if ('id' in r) { set({ kind: 'idle' }); onDone(r.id); return; }
      // a burn sent from here a moment ago may not be known to the node yet
      const early = 'error' in r && r.error === 'not_found' && freshTx;
      if (i >= 30 || ('error' in r && !early)) { set({ kind: 'error', code: 'error' in r ? r.error : 'unavailable' }); return; }
      set('waiting' in r ? { kind: 'waiting', confirmations: r.confirmations, needed: r.needed } : { kind: 'waiting', confirmations: 0, needed: 2 });
      await new Promise((f) => setTimeout(f, 5000));
      if (g !== gen.current) return;
    }
  };
  return { state, set, send, again: () => { if (last.current) void send(last.current.body, last.current.freshTx); } };
}

export function Burn() {
  useMeta('Burn to run · Quintel', SUB);
  const { data, error, reload } = useApi<BurnSummary>('/api/burn', 20000);
  const asked = Number(useRoute().query.get('request'));
  const id = Number.isInteger(asked) && asked > 0 && asked < 1e9 ? asked : null;
  const [sort, setSort] = useState<'latest' | 'extreme'>('latest');
  const gallery = useApi<GalleryItem[]>(`/api/burn/gallery?sort=${sort}`, 20000);
  const toRun = (n: number) => {
    history.replaceState({}, '', runLink(n));
    window.dispatchEvent(new Event('q-nav'));
    reload();
  };
  const req = useRequest(id);
  // the first paint waits for both, so nothing jumps; a request made later on this page never blanks it
  const ready = useRef(false);
  if ((data || error) && (id === null || req.data || req.error)) ready.current = true;
  const empty = data && !data.open && gallery.data?.length === 0;
  return (
    <div className="page">
      <div className="wrap">
        <header className="page-head"><h1>Burn to run.</h1><p>{SUB}</p></header>
        <Card className="burn-counter" aria-label="Burned so far">
          <div className="label">$QNTL burned for runs</div>
          <div className="burn-total mono">{data ? <NumberRoll text={int(data.burned)} /> : error ? '—' : <Skeleton h="1.1em" w="4em" />}</div>
          <p className="note">{data ? `${int(data.requests)} ${data.requests === 1 ? 'run' : 'runs'} requested` : error ? 'Unavailable right now' : <Skeleton h="1.5em" w="9em" />}</p>
        </Card>
        {ready.current && data ? (data.open ? <Open s={data} id={id} req={req} toRun={toRun} /> : <>{id !== null && <div className="burn-alone"><Request id={id} {...req} /></div>}<Closed /></>)
          : ready.current ? <Card><ErrorState text="Couldn’t load burn-to-run. Try again." onRetry={reload} /></Card>
          : <div className="burn-grid" aria-hidden="true"><div className="burn-steps"><Skeleton h={440} /><Skeleton h={480} /><Skeleton h={480} /></div><div className={id === null ? 'burn-side' : 'burn-side burn-side-first'}><Skeleton h={id === null ? 208 : 640} /></div></div>}
        {ready.current && !empty && <Gallery sort={sort} setSort={setSort} {...gallery} />}
        {ready.current && <p className="note burn-disclaimer">A custom scenario is not an official run and is never part of an hourly fingerprint. Scenario odds, not advice. {DISCLAIMER}</p>}
      </div>
    </div>
  );
}

function Closed() {
  return (
    <Card className="burn-closed">
      <Pill>Not open yet</Pill>
      <h2>Burning isn’t open.</h2>
      <p className="muted">The token address, the amount and the first block that counts are posted here when it opens. Until then no burn can start a run, so please don’t send any tokens for this.</p>
      <div className="row"><Button variant="secondary" href="/#token">Official addresses</Button><Button variant="secondary" href="/status">Status</Button></div>
    </Card>
  );
}

function Open({ s, id, req, toRun }: { s: BurnSummary; id: number | null; req: Loaded<BurnRequestView>; toRun: (id: number) => void }) {
  const { latest, config, configError, reloadConfig, online } = useData();
  const spot = latest?.run?.spot ?? null;
  const [price, setPrice] = useState(''), [touched, setTouched] = useState(false);
  const [h, setH] = useState<`${BurnHorizon}`>('5');
  const [useShock, setUseShock] = useState<'no' | 'yes'>('no'), [shock, setShock] = useState(NO_SHOCK);
  const [storedTx, setTx] = useStored('q-burn-tx', ''), tx = isTxHash(storedTx) ? storedTx : '';
  const [sentAt, setSentAt] = useState(0);
  const [hashText, setHashText] = useState(tx);
  const [anon, setAnon] = useState<'address' | 'anonymous'>('address');
  const wallet = useWallet();
  const send = useSend((n) => { setTx(''); setHashText(''); finished.current = true; toRun(n); });
  const status = useRef<HTMLDivElement>(null);
  const finished = useRef(false);
  useEffect(() => { if (finished.current) { finished.current = false; status.current?.scrollIntoView({ block: 'center' }); } }, [id]);

  const n = parseAmount(price);
  const scenario = n === null ? null : parseScenario({ price: n, horizon: Number(h), shock: useShock === 'yes' ? shock : null });
  const inSpan = !!scenario && (spot === null || priceInSpan(scenario.price, spot));
  const good = inSpan ? scenario : null;
  const priceError = !touched || (n === null && !price) ? null : !scenario ? 'Enter a price in dollars, with 2 decimals at most.' : !inSpan ? `Choose a price between ${usd(Math.ceil(spot! * 10) / 100)} and ${usd(Math.floor(spot! * 10))}.` : null;
  const amount = int(s.amount);
  const busy = send.state.kind === 'sign' || send.state.kind === 'checking' || send.state.kind === 'waiting';

  const post = (body: BurnBodyJson) => {
    void send.send(body, same(body.tx, tx) && Date.now() - sentAt < 180_000);
    status.current?.scrollIntoView({ behavior: 'auto', block: 'nearest' });
  };
  const official = config ? same(s.token, config.tokens.pons) && config.chainId === s.chainId : null;
  return (
    <div className="burn-grid">
      <ol className="burn-steps">
        <Card as="li" className="burn-step">
          <div className="burn-step-head"><span className="label" aria-hidden="true">1</span><h2>Choose your scenario</h2></div>
          <Input label={`${config?.symbol ?? DEFAULT_SYMBOL} price`} numeric prefix="$" value={price} placeholder={spot ? (Math.round(spot * 0.9)).toFixed(2) : ''} maxLength={12} onChange={(e) => setPrice(e.target.value)} onBlur={() => setTouched(true)} error={priceError} hint={spot ? `The ${etTime(latest!.run!.ts)} run started at ${usd(spot)}.` : ' '} />
          <div className="field"><div className="label">Horizon</div><SegmentedTabs items={HORIZONS} value={h} onChange={setH} label="Horizon" /></div>
          <div className="field"><div className="label">Shock, optional</div><SegmentedTabs items={[{ id: 'no', label: 'No shock' }, { id: 'yes', label: 'Add a shock' }]} value={useShock} onChange={setUseShock} label="Shock" /></div>
          {useShock === 'yes' && (
            <div className="burn-sliders">
              <Slider label="Drift over 1 month" {...SHOCK_BOUNDS.drift} value={shock.drift} onChange={(drift) => setShock((x) => ({ ...x, drift }))} format={(v) => pctChange(v, 0)} />
              <Slider label="Jumps" {...SHOCK_BOUNDS.jumpMult} value={shock.jumpMult} onChange={(jumpMult) => setShock((x) => ({ ...x, jumpMult }))} format={(v) => v.toFixed(1) + '×'} />
              <Slider label="Volatility" {...SHOCK_BOUNDS.volMult} value={shock.volMult} onChange={(volMult) => setShock((x) => ({ ...x, volMult }))} format={(v) => v.toFixed(2) + '×'} />
            </div>
          )}
          <p className="burn-line">{good ? <>Odds of ending above {usd(good.price)}, and at {usd(good.price)} or lower, {when(good.horizon)}.</> : <span className="muted">Your scenario shows here in one line.</span>}</p>
        </Card>

        <Card as="li" className="burn-step">
          <div className="burn-step-head"><span className="label" aria-hidden="true">2</span><h2>Burn {amount} $QNTL</h2></div>
          <p className="muted">One normal token transfer on Robinhood Chain (chain ID {s.chainId}) to the burn address. Nothing to approve, ever. Use your own regular wallet: an exchange or contract wallet can’t sign step 3.</p>
          {official === false ? (
            <div className="burn-alert" role="alert"><p>The token address here doesn’t match the official one, so burning is turned off. Please don’t burn.</p></div>
          ) : configError ? <ErrorState text="Couldn’t check the official address. Try again." onRetry={reloadConfig} /> : (
            <>
              <dl className="burn-facts">
                <div><dt className="label">Amount</dt><dd className="burn-amount"><span className="mono">{amount} $QNTL</span></dd></div>
                <div><dt className="label">Token</dt><dd><AddressChip address={s.token} /></dd></div>
                <div><dt className="label">Burn address</dt><dd><AddressChip address={DEAD_ADDRESS} /></dd></div>
                <div><dt className="label">Counts from block</dt><dd className="burn-amount"><span className="mono">{int(s.fromBlock)}</span></dd></div>
              </dl>
              <div className="burn-match">{official ? <><Check size={16} strokeWidth={1.5} aria-hidden="true" /><span className="note">The token is the official address.</span></> : <Skeleton h="1.5em" w="14em" />}</div>
              <p className="burn-warn"><i className="fall" aria-hidden="true" />Burns can’t be undone.</p>
              <p className="note">A burn before that block, or below this amount, gets no run. One burn gives one run. Runs go one at a time, about one every 10 minutes, so yours may wait.</p>
              <BurnStep s={s} wallet={wallet} wait={!online ? 'You are offline.' : official !== true ? 'Checking the official address.' : !good ? 'Choose a scenario first.' : !s.amountRaw ? 'Couldn’t read the token from the chain. Try again in a minute.' : null} tx={tx} onSent={(t) => { setTx(t); setHashText(t); setSentAt(Date.now()); }} clear={() => setTx('')} />
            </>
          )}
        </Card>

        <ConfirmStep s={s} wallet={wallet} scenario={good} hashText={hashText} setHashText={setHashText} anon={anon} setAnon={setAnon} busy={busy} online={online} setState={send.set} post={post} />
      </ol>
      <div className={id !== null && send.state.kind === 'idle' ? 'burn-side burn-side-first' : 'burn-side'} ref={status}>
        {send.state.kind !== 'idle' ? <Sending state={send.state} amount={amount} again={send.again} close={() => send.set({ kind: 'idle' })} /> : id !== null ? <Request id={id} {...req} /> : (
          <Card as="section" className="burn-status" aria-label="Your request"><EmptyState text="Your request and its result show here after step 3." /></Card>
        )}
      </div>
    </div>
  );
}

/** Connect, switch network, then one transfer the visitor confirms in the wallet. */
function BurnStep({ s, wallet, wait, tx, onSent, clear }: { s: BurnSummary; wallet: Wallet; wait: string | null; tx: string; onSent: (tx: string) => void; clear: () => void }) {
  const [review, setReview] = useState(false), [busy, setBusy] = useState(false), [note, setNote] = useState<string | null>(null);
  const run = async (f: () => Promise<unknown>) => { setBusy(true); setNote(null); try { await f(); } catch (e) { setNote(WALLET_TEXT[problemOf(e)]); } finally { setBusy(false); } };
  const burn = () => run(async () => {
    // everything is read again just before the wallet opens
    const [now, cfg] = await Promise.all([api<BurnSummary>('/api/burn'), api<SiteConfig>('/api/config')]).catch(() => [null, null] as const);
    if (!now || !cfg) return setNote('Couldn’t check the address again. Nothing was sent. Try again.');
    const b = burnTransfer(s, now, { token: cfg.tokens.pons, chainId: cfg.chainId });
    if (!b) return setNote('The burn details changed. Nothing was sent. Reload the page.');
    const shown = wallet.account, from = await wallet.connect();
    if (!same(from, shown)) return setNote('Your wallet is on another account. Nothing was sent. Check the address above.');
    if ((await walletChain()) !== b.chainId) return setNote('Your wallet is on another network. Nothing was sent.');
    if ((await readDecimals(b.token)) !== b.decimals) return setNote('The token on this network doesn’t match. Nothing was sent.');
    if ((await readBalance(b.token, from)) < b.raw) return setNote(`This wallet holds less than ${int(s.amount)} $QNTL. Nothing was sent.`);
    if (await isContractWallet(from)) return setNote('This is a contract wallet, so it can’t sign step 3. Nothing was sent.');
    const t = await sendBurn(from, b.token, b.raw, b.chainId);
    setReview(false);
    if (isTxHash(t)) onSent(t.toLowerCase()); else setNote('Your wallet didn’t return a transaction hash. Find it there and paste it in step 3.');
  });
  if (tx) return (
    <div className="burn-sent">
      <p>Burn sent from this device. Continue with step 3.</p>
      <div className="row"><Button variant="secondary" href={`${s.explorer}/tx/${tx}`}>View on explorer</Button><Button variant="ghost" onClick={clear}>Start another</Button></div>
    </div>
  );
  const wrongChain = wallet.account && wallet.chain !== s.chainId;
  return (
    <div className="burn-do">
      {!wallet.present ? <p className="note">No wallet found in this browser. Before you burn, open this page in your wallet app’s own browser, or on a computer with your wallet. Step 3 needs its signature.</p>
        : !wallet.account ? <div className="row"><Button disabled={busy} onClick={() => run(wallet.connect)}>Connect wallet</Button><span className="note">Use the wallet that holds your $QNTL. Step 3 needs its signature.</span></div>
        : wrongChain ? <div className="row"><Button disabled={busy} onClick={() => run(async () => { await switchChain(s.chainId, s.explorer); await wallet.refresh(); })}>Switch network</Button><span className="note">To Robinhood Chain, chain ID {s.chainId}.</span></div>
        : <div className="row"><Button disabled={!!wait || busy} onClick={() => { setNote(null); setReview(true); }}>Review burn</Button><span className="note">{wait ?? `From ${addr(wallet.account)}.`}</span></div>}
      <p className="note burn-note" role="status">{!review && note}</p>
      <Sheet open={review} onClose={() => setReview(false)} title={`Burn ${int(s.amount)} $QNTL`}>
        <p className="burn-warn"><i className="fall" aria-hidden="true" />Burns can’t be undone.</p>
        <dl className="burn-review">
          <div><dt className="label">Amount</dt><dd className="mono">{int(s.amount)} $QNTL</dd></div>
          <div><dt className="label">Token</dt><dd className="mono">{s.token}</dd></div>
          <div><dt className="label">From, your wallet</dt><dd className="mono">{wallet.account ?? 'Not connected'}</dd></div>
          <div><dt className="label">To, the burn address</dt><dd className="mono">{DEAD_ADDRESS}</dd></div>
          <div><dt className="label">Network</dt><dd className="mono">Robinhood Chain, chain ID {s.chainId}</dd></div>
          <div><dt className="label">Kind</dt><dd className="mono">Transfer, no approval</dd></div>
        </dl>
        <p className="note">Check that your wallet shows the same token, amount and address before you confirm. The network fee is extra.</p>
        <div className="row"><Button disabled={busy} onClick={burn}>{busy ? 'Waiting for wallet' : 'Open wallet'}</Button><Button variant="secondary" onClick={() => setReview(false)}>Cancel</Button></div>
        <p className="note burn-note" role="status">{note}</p>
      </Sheet>
    </div>
  );
}

function ConfirmStep({ s, wallet, scenario, hashText, setHashText, anon, setAnon, busy, online, setState, post }: {
  s: BurnSummary; wallet: Wallet; scenario: Scenario | null; hashText: string; setHashText: (t: string) => void; anon: 'address' | 'anonymous'; setAnon: (a: 'address' | 'anonymous') => void;
  busy: boolean; online: boolean; setState: (x: Send) => void; post: (b: BurnBodyJson) => void;
}) {
  const [err, setErr] = useState<string | null>(null), [sig, setSig] = useState(''), [sigErr, setSigErr] = useState<string | null>(null);
  const tx = isTxHash(hashText.trim()) ? hashText.trim().toLowerCase() : null;
  const body = tx && scenario ? { tx, scenario, anonymous: anon === 'anonymous' } : null;
  const message = body && burnMessage({ domain: s.domain, chainId: s.chainId, ...body });
  const ready = () => { setErr(tx ? null : 'Paste the 66-character transaction hash, starting with 0x.'); return tx && body && message ? { body, message } : null; };
  const sign = async () => {
    const r = ready();
    if (!r) return;
    setState({ kind: 'sign' });
    try {
      const account = wallet.account ?? (await wallet.connect());
      post({ ...r.body, signature: await signText(r.message, account) });
    } catch (e) { setState({ kind: 'wallet', text: WALLET_TEXT[problemOf(e)] }); }
  };
  const manual = () => {
    const r = ready();
    if (!r) return;
    const x = sig.trim();
    if (!/^0x[0-9a-fA-F]{130}$/.test(x)) { setSigErr('Paste the whole signature, starting with 0x.'); return; }
    setSigErr(null);
    post({ ...r.body, signature: x });
  };
  return (
    <Card as="li" className="burn-step">
      <div className="burn-step-head"><span className="label" aria-hidden="true">3</span><h2>Confirm</h2></div>
      <p className="muted">Sign your scenario with the wallet that burned. Signing is free and moves no tokens.</p>
      <Input label="Transaction hash" className="burn-hash" value={hashText} placeholder="0x" maxLength={80} autoCapitalize="off" autoCorrect="off" spellCheck={false} onChange={(e) => { setHashText(e.target.value); setErr(null); }} error={err} />
      <div className="field">
        <div className="label">Name in the gallery</div>
        <SegmentedTabs items={[{ id: 'address', label: 'Short address' }, { id: 'anonymous', label: 'Anonymous' }]} value={anon} onChange={setAnon} label="Name in the gallery" />
        <p className="note">The burn itself stays public on the chain either way.</p>
      </div>
      <div className="row"><Button disabled={busy || !online || !scenario || !wallet.present} onClick={sign}>Sign and check burn</Button><span className="note">{!online ? 'You are offline.' : !scenario ? 'Choose a scenario first.' : !wallet.present && 'No wallet found in this browser. Open this page in your wallet app’s own browser, or use the option below.'}</span></div>
      <Accordion items={[{ q: 'Sign in another wallet', a: (
        <div className="burn-manual">
          <p className="note">Sign this exact text as a plain message (EIP-191) with the wallet that burned, then paste the signature.</p>
          {message ? <CodeBlock code={message} /> : <p className="note">Choose a scenario and paste the transaction hash to see the text.</p>}
          <Input label="Signature" value={sig} placeholder="0x" maxLength={140} autoCapitalize="off" autoCorrect="off" spellCheck={false} onChange={(e) => { setSig(e.target.value); setSigErr(null); }} error={sigErr} />
          <div className="row"><Button variant="secondary" disabled={busy || !online || !message} onClick={manual}>Check burn</Button></div>
        </div>
      ) }]} />
    </Card>
  );
}

/** What is happening to a request that has no number yet. */
function Sending({ state, amount, again, close }: { state: Send; amount: string; again: () => void; close: () => void }) {
  const retry = state.kind === 'error' && ['unavailable', 'slow_down', 'not_found'].includes(state.code);
  return (
    <Card as="section" className="burn-status" aria-label="Your request" aria-live="polite">
      {state.kind === 'sign' && <EmptyState text="Waiting for your wallet to sign." />}
      {state.kind === 'checking' && <EmptyState text="Checking the burn on the chain." />}
      {state.kind === 'waiting' && <div className="state"><p>Waiting for confirmation · {state.confirmations} of {state.needed}</p><div className="burn-meter"><PixelMeter value={state.confirmations / state.needed} label={`${state.confirmations} of ${state.needed} confirmations`} /></div></div>}
      {state.kind === 'wallet' && <EmptyState text={state.text} action={<Button variant="secondary" onClick={close}>Close</Button>} />}
      {state.kind === 'error' && <div className="state"><p>{errorText(state.code, amount)}</p><div className="row">{retry && <Button variant="secondary" onClick={again}>Try again</Button>}<Button variant="ghost" onClick={close}>Close</Button></div></div>}
    </Card>
  );
}

/** Asked again every 15 seconds until it is done. */
function useRequest(id: number | null): Loaded<BurnRequestView> {
  const [done, setDone] = useState<number | null>(null);
  const r = useApi<BurnRequestView>(id === null ? null : `/api/burn/request/${id}`, id === null || done === id ? 0 : 15000);
  useEffect(() => { if (r.data?.status === 'done') setDone(id); }, [r.data?.status, id]);
  return r;
}

/** One request by number: queued, running, done or failed. */
function Request({ id, data, error, status, reload }: Loaded<BurnRequestView> & { id: number }) {
  const { latest } = useData();
  const now = useNow(30000);
  const ts = latest?.run?.ts ?? null;
  const late = isDelayed(ts, now);
  return (
    <Card as="section" className="burn-status" aria-label={`Request ${id}`}>
      <div className="burn-status-head"><h2>Request {int(id)}</h2>{data && <span aria-live="polite">{data.status === 'done' ? <Pill tone="invert">Done</Pill> : data.status === 'failed' ? <Pill tone="risk">Not finished</Pill> : <Pill tone="invert">Burn verified</Pill>}</span>}</div>
      {!data ? (error ? (status === 404 ? <EmptyState text="No request has that number." action={<Button variant="secondary" href="/burn">Close</Button>} /> : <ErrorState text="Couldn’t load that request. Try again." onRetry={reload} />) : <div className="burn-load"><Skeleton h="1.5em" w="14em" /><Skeleton h={160} /></div>) : (
        <>
          <p className="note">{data.by ? `Requested by ${data.by}` : 'Requested anonymously'} · {etDateTime(data.createdAt)}<br />{usd(data.scenario.price)} {when(data.scenario.horizon)}{data.scenario.shock && <>. {shockLine(data.scenario.shock)}</>}</p>
          {data.status === 'queued' && <div className="state"><p>Your run is queued. About {waitMinutes(data.ahead, now)} min.</p>{late && <Pill>Delayed · last run {etTime(ts)}</Pill>}<p className="note">Custom runs go one at a time, after the official run. You can close this page.</p></div>}
          {data.status === 'running' && <><PixelField kept={null} n={64} label="Running 1,000,000 futures" /><p className="label">Running 1,000,000 futures</p></>}
          {data.status === 'failed' && <div className="state"><p>The run didn’t finish. The burn still counts: paste its transaction hash in step 3 and sign again.</p></div>}
          {data.status === 'done' && data.run && <Result data={data} run={data.run} />}
        </>
      )}
    </Card>
  );
}

function Result({ data, run }: { data: BurnRequestView; run: NonNullable<BurnRequestView['run']> }) {
  const { config } = useData();
  const { scenario: s } = data, r = run.result;
  const h = useMemo(() => statsOf(r, s.horizon), [r, s.horizon]);
  const axis = useMemo(() => { const a = axisOf(h, 10); return { lo: Math.min(a.lo, Math.floor(s.price / 10) * 10), hi: Math.max(a.hi, Math.ceil(s.price / 10) * 10) }; }, [h, s.price]);
  const symbol = config?.symbol ?? DEFAULT_SYMBOL;
  return (
    <div className="burn-result">
      <Answer live text={odds(r.above)} label={aboveLine(s)} />
      <PriceBars h={h} total={run.pathsPerModel * 5} axis={axis} price={s.price} label={`${symbol} price ${when(s.horizon)} on this custom scenario, from ${usd(axis.lo, 0)} to ${usd(axis.hi, 0)}. ${odds(r.above)} of futures end above ${usd(s.price)}, ${odds(r.atOrBelow)} at that price or lower.`} />
      <div className="tool-rows">
        <Stat label={`At ${usd(s.price)} or lower`} note={when(s.horizon).replace(/^./, (c) => c.toUpperCase())}>{odds(r.atOrBelow)}</Stat>
        <Stat label="Middle price" note={`Started at ${usd(r.spot)}`}>{usd(r.pct.p50)}</Stat>
        {r.horizons.filter((x) => x.days !== s.horizon).map((x) => <Stat key={x.days} label={`Above, ${BURN_HORIZONS[x.days as BurnHorizon].toLowerCase()}`}>{odds(x.above)}</Stat>)}
      </div>
      <p className="note">Custom scenario, not an official run. {int(run.pathsPerModel * 5)} futures from the inputs of run {int(run.baseRunId)}, {etDateTime(run.ts)}. Scenario odds, not advice.</p>
      <Recheck key={data.id} id={data.id} expected={run.outputHash} />
      <div className="row"><CopyButton text={ORIGIN + runLink(data.id)} label="Share" toast="Link copied" />{data.tx && config && <Button variant="secondary" href={`${config.explorer}/tx/${data.tx}`}>View burn</Button>}</div>
    </div>
  );
}

function Recheck({ id, expected }: { id: number; expected: string }) {
  const [s, set] = useState<'idle' | 'busy' | 'ok' | 'fail' | 'stuck'>('idle'), [p, setP] = useState(0);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const go = async () => {
    set('busy'); setP(0);
    const r = await recheck(id, (x) => { if (alive.current) setP(x); }).then((ok) => (ok ? 'ok' as const : 'fail' as const), () => 'stuck' as const);
    if (alive.current) set(r);
  };
  const text = { idle: 'Your browser makes all the futures again from the official run’s inputs and compares the hash.', busy: `Making 1,000,000 futures, ${Math.round(p * 100)}%`, ok: `Match: ${hash(expected)} was made again here.`, fail: 'The result made here doesn’t match the stored one.', stuck: 'The check couldn’t finish just now. Try again.' }[s];
  return (
    <div className="burn-recheck">
      <Button variant="secondary" disabled={s === 'busy'} onClick={go}>Recheck here</Button>
      <p className="note" role="status">{text}</p>
      <Link className="note burn-link" href={`${ORIGIN}/api/burn/run/${id}`}>Inputs, seed and hash</Link>
    </div>
  );
}

function Gallery({ sort, setSort, data, error, reload }: { sort: 'latest' | 'extreme'; setSort: (s: 'latest' | 'extreme') => void; data: GalleryItem[] | null; error: boolean; reload: () => void }) {
  return (
    <section className="burn-gallery" aria-labelledby="burn-gallery">
      <div className="burn-gallery-head">
        <h2 id="burn-gallery">Gallery.</h2>
        <SegmentedTabs items={[{ id: 'latest', label: 'Latest' }, { id: 'extreme', label: 'Most extreme' }]} value={sort} onChange={setSort} label="Order" idBase="burn-gallery" />
        {sort === 'extreme' && <p className="note">Furthest price from where the run started.</p>}
      </div>
      <div role="tabpanel" id={`burn-gallery-panel-${sort}`} aria-labelledby={`burn-gallery-tab-${sort}`}>
        {!data ? (error ? <Card><ErrorState text="Couldn’t load the gallery. Try again." onRetry={reload} /></Card> : <div className="burn-cards" aria-hidden="true">{[0, 1, 2].map((i) => <Skeleton key={i} h={304} />)}</div>)
          : data.length === 0 ? <Card><EmptyState text="No runs yet. The first burn starts the gallery." /></Card> : (
            <ul className="burn-cards">
              {data.map((g) => (
                <Card as="li" key={g.id} className="burn-item">
                  <p className="label">{g.by ? `Requested by ${g.by}` : 'Requested anonymously'}</p>
                  <div className="burn-odds mono">{odds(g.above)}</div>
                  <p className="burn-item-line">{aboveLine(g.scenario)}</p>
                  <p className="note">{odds(g.atOrBelow)} at that price or lower. Started at {usd(g.spot)}. {shockLine(g.scenario.shock)}.</p>
                  <PixelSpark values={g.shape} label="Shape of the futures, low prices to high" />
                  <p className="note">Custom scenario · {etDateTime(g.ts)}</p>
                  <div className="row"><Button variant="secondary" href={runLink(g.id)} aria-label={`Open request ${g.id}`}>Open</Button><CopyButton text={ORIGIN + runLink(g.id)} label="Share" toast="Link copied" /></div>
                </Card>
              ))}
            </ul>
          )}
      </div>
    </section>
  );
}
