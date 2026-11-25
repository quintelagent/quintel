import { CA, PONS_URL, PUMP_MINT, PUMP_URL } from '../../lib/launch';
import { Link } from '../../lib/router';
import { CopyButton, SocialLinks } from '../ui';

/** Site-wide official address. Nothing renders until launch.json has one. */
export function CaBar() {
  if (!CA) return null;
  return (
    <div className="ca-bar" role="region" aria-label="Official $QNTL address">
      <div className="wrap ca-bar-in">
        <p><span className="label">$QNTL CA</span> <code className="mono" data-ca={CA}>{CA}</code> <span className="note">Only this one is real.</span></p>
        <div className="row ca-bar-act"><CopyButton text={CA} label="Copy CA" toast="Address copied" /><Link className="ca-link" href={PONS_URL!}>View on Pons</Link><SocialLinks /></div>
        {PUMP_MINT && <p className="ca-pump"><span className="label">Pump.fun</span> <code className="mono">{PUMP_MINT}</code> <Link className="ca-link" href={PUMP_URL!}>View on Pump.fun</Link></p>}
      </div>
    </div>
  );
}
