import { Check } from 'lucide-react';
import { featureByFlag, type Feature } from '../features';
import { useData } from '../lib/data';
import { etShortDate, etTime, int } from '../lib/format';
import { PRO_FEATURES, TOKEN_CONFIG } from '../lib/tokenConfig';
import { AddressChip, Button, Card, ErrorState, Pill, Section, Skeleton } from '../components/ui';
import './token.css';

/** A feature's registry status as a pill. No date until the registry has one. */
export function FeaturePill({ feature: f }: { feature: Feature | undefined }) {
  if (!f) return null;
  if (f.status === 'live') return <span className="paused"><Pill tone="invert" live>Live</Pill></span>;
  if (f.status === 'planned') return <Pill tone="muted">Planned</Pill>;
  return <Pill>{f.releaseAt ? `Soon · ${etShortDate(f.releaseAt)}, ${etTime(f.releaseAt)}` : 'Soon'}</Pill>;
}

const Bullets = ({ items }: { items: string[] }) => (
  <ul className="token-bullets">{items.map((t) => <li key={t}><Check size={16} strokeWidth={1.5} aria-hidden="true" />{t}</li>)}</ul>
);

export function Token() {
  const { config, configError: failed, reloadConfig } = useData();
  const { tiers, ponsUrl, pumpUrl, explorerUrl, burn } = TOKEN_CONFIG;
  const pro = featureByFlag('PRO_TIERS'), burnFeature = featureByFlag('BURN_TO_RUN');
  const pons = config?.tokens.pons ?? null;
  const explorer = explorerUrl ?? (config ? (pons ? `${config.explorer}/token/${pons}` : config.explorer) : null);
  const rows: [string, string | null][] = [['Robinhood Chain · Pons', pons], ['Solana · Pump.fun', config?.tokens.solana ?? null]];
  return (
    <Section id="token" title="$QNTL unlocks Pro and runs custom scenarios." sub="Hold it for Pro features. Burn it to run your own 1,000,000 futures.">
      <div className="token-stack">
        {tiers ? (
          <div className="stack">
            <div className="token-head"><h3>Pro hold tiers</h3><FeaturePill feature={pro} /></div>
            <div className="grid token-tiers">
              {tiers.map((t) => (
                <Card key={t.name} className="token-card"><h3>{t.name}</h3><p className="mono">Hold {int(t.amount)} $QNTL</p><Bullets items={t.features ?? PRO_FEATURES} /></Card>
              ))}
            </div>
          </div>
        ) : (
          <Card className="token-card">
            <div className="token-head"><h3>Pro hold tiers</h3><FeaturePill feature={pro} /></div>
            <p className="muted">Amounts posted at launch</p>
            <Bullets items={PRO_FEATURES} />
          </Card>
        )}
        <div className="grid token-pair">
          <Card className="token-card">
            <div className="token-head"><h3>Burn-to-run</h3><FeaturePill feature={burnFeature} /></div>
            <p className="muted">Burn $QNTL to request a custom run of 1,000,000 futures. The burn is public and the result is posted to the gallery.</p>
            {burn?.docsUrl && <div><Button variant="secondary" href={burn.docsUrl}>How it works</Button></div>}
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
