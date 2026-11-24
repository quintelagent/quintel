import type { Feature } from '../features';
import { useMeta } from '../lib/meta';
import { Button, Pill, Section } from '../components/ui';
import { etShortDate, etTime } from '../lib/format';

/** A flagged route whose feature has not been released. */
export function Soon({ feature }: { feature: Feature }) {
  useMeta(`${feature.name} · Quintel`, feature.oneLine, { noindex: true });
  return (
    <Section as="h1" eyebrow={<Pill>{feature.status === 'planned' ? 'Planned' : feature.releaseAt ? `Soon · ${etShortDate(feature.releaseAt)}, ${etTime(feature.releaseAt)}` : 'Soon'}</Pill>} title={feature.name + '.'} sub={feature.oneLine}>
      <div className="row"><Button href="/status">See status</Button><Button href="/" variant="secondary">Back to home</Button></div>
    </Section>
  );
}
