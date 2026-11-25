import { flagOn } from '../features';
import { useData } from '../lib/data';
import { Link } from '../lib/router';
import { BEFORE_LAUNCH, TOKEN_CONFIG } from '../lib/tokenConfig';
import { AddressChip, Button, Card, ErrorState, Section, Skeleton } from '../components/ui';
import './token.css';

export function Token() {
  const { config, configError: failed, reloadConfig } = useData();
  const { ponsUrl, pumpUrl, explorerUrl } = TOKEN_CONFIG;
  const pons = config?.tokens.pons ?? null;
  const explorer = explorerUrl ?? (config ? (pons ? `${config.explorer}/token/${pons}` : config.explorer) : null);
  const rows: [string, string | null][] = [['Robinhood Chain · Pons', pons], ['Solana · Pump.fun', config?.tokens.solana ?? null]];
  return (
    <Section id="token" title="$QNTL runs your own 1,000,000 futures." sub="Its job: burn it to run your own scenario as a public run.">
      <div className="token-stack">
        {!pons && <Card className="token-launch"><p>{BEFORE_LAUNCH}</p></Card>}
        {!flagOn('BURN_TO_RUN') && <Card className="token-launch"><p>Burn-to-run is not open yet. A burn made before <Link href="/status">Status</Link> shows it as live does not get a run.</p></Card>}
        <div className="grid token-pair">
          <Card className="token-card">
            <div className="token-head"><h3>What it does</h3></div>
            <p className="muted">Burning $QNTL requests a run on your own scenario. The burn and the result are public. What is open today is on <Link href="/status">Status</Link>.</p>
          </Card>
          <Card className="token-card">
            <div className="token-head"><h3>Official addresses</h3></div>
            {failed ? <ErrorState text="Couldn’t load the addresses. Try again." onRetry={reloadConfig} /> : (
              <dl className="token-addrs">
                {rows.map(([name, address]) => <div key={name}><dt className="label">{name}</dt><dd>{config ? <AddressChip address={address} /> : <Skeleton h={44} w={160} />}</dd></div>)}
              </dl>
            )}
            <p className="muted">Always check the address here before you trade.</p>
          </Card>
        </div>
        {(ponsUrl || pumpUrl || explorer || !failed) && <div className="row token-links">
          {ponsUrl && <Button variant="secondary" href={ponsUrl}>View on Pons</Button>}
          {pumpUrl && <Button variant="secondary" href={pumpUrl}>View on Pump.fun</Button>}
          {explorer && <Button variant="secondary" href={explorer}>Explorer</Button>}
        </div>}
        <div className="stack token-notes">
          <p className="note">The coin does not change the odds, and holding it is not a share of anything.</p>
          <p className="note">Not affiliated with Nvidia, Robinhood, Pons or Pump.fun. Not financial advice.</p>
        </div>
      </div>
    </Section>
  );
}
