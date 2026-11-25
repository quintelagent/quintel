import { flagOn } from '../features';
import { useData } from '../lib/data';
import { addr } from '../lib/format';
import { Link } from '../lib/router';
import { BURN_TX, BURNED, CA, LAUNCH_WALLET, PUMP_MINT } from '../lib/launch';
import { BEFORE_LAUNCH, TOKEN_CONFIG } from '../lib/tokenConfig';
import { AddressChip, Button, Card, Section, SocialLinks } from '../components/ui';
import './token.css';

export function Token() {
  const { config } = useData();
  const { ponsUrl, pumpUrl, explorerUrl } = TOKEN_CONFIG;
  const pons = CA; // launch.json, so it can never differ from the bar
  const explorer = explorerUrl ?? (config ? (pons ? `${config.explorer}/token/${pons}` : config.explorer) : null);
  const rows: [string, string | null][] = [['Robinhood Chain · Pons', pons], ['Solana · Pump.fun', PUMP_MINT]];
  return (
    <Section id="token" title="$QNTL runs your own 1,000,000 futures." sub="Its job: burn it to run your own scenario as a public run.">
      <div className="token-stack">
        {!pons && <Card className="token-launch"><p>{BEFORE_LAUNCH}</p></Card>}
        {!flagOn('BURN_TO_RUN') && <Card className="token-launch"><p>Burn-to-run is not open yet. A burn made before <Link href="/status">Status</Link> shows it as live does not get a run.</p></Card>}
        <div className="grid token-pair">
          <Card className="token-card">
            <div className="token-head"><h3>What it does</h3></div>
            <p className="muted">Burning $QNTL requests a run on your own scenario. The burn and the result are public. What is open today is on <Link href="/status">Status</Link>.</p>
            {flagOn('BURN_TO_RUN') && <div className="row"><Button variant="secondary" href="/burn">Burn to run</Button></div>}
          </Card>
          <Card className="token-card">
            <div className="token-head"><h3>Official addresses</h3></div>
            <dl className="token-addrs">
                {rows.map(([name, address]) => <div key={name}><dt className="label">{name}</dt><dd data-ca={address ?? undefined}><AddressChip address={address} /></dd></div>)}
            </dl>
            {LAUNCH_WALLET && <p>Launch wallet: <Link className="mono" href={`https://robinhoodchain.blockscout.com/address/${LAUNCH_WALLET}`} aria-label={`Launch wallet ${addr(LAUNCH_WALLET)}`}>{addr(LAUNCH_WALLET)}</Link></p>}
            {BURN_TX && <p>Dev buy{BURNED ? `, ${BURNED} $QNTL` : ''}: <Link href={`https://robinhoodchain.blockscout.com/tx/${BURN_TX}`}>burned in this transaction</Link></p>}
            <p className="muted">Always check the address here before you trade.</p>
            <SocialLinks />
          </Card>
        </div>
        {(ponsUrl || pumpUrl || explorer) && <div className="row token-links">
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
