import { Fragment } from 'react';

/** Dot-matrix process diagram (static at launch; motion comes with the PixelFlow drop). */
export function PixelFlow({ steps, label }: { steps: { title: string; note: string }[]; label: string }) {
  return (
    <ol className="pixel-flow" aria-label={label}>
      {steps.map((s, i) => (
        <Fragment key={s.title}>
          <li><span className="label">{i + 1}</span><b>{s.title}</b><span className="note">{s.note}</span></li>
          {i < steps.length - 1 && <li className="hop" aria-hidden="true">{Array.from({ length: 5 }, (_, k) => <i key={k} className={k === 4 ? 'on' : k === 3 ? 'mid' : ''} />)}</li>}
        </Fragment>
      ))}
    </ol>
  );
}
