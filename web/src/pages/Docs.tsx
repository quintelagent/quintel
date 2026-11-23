import { useEffect, useState } from 'react';
import { onLink, useRoute } from '../lib/router';

const DOCS: Record<string, { title: string; load: () => Promise<{ default: string }> }> = {
  methodology: { title: 'Methodology', load: () => import('../../../docs/METHODOLOGY.md?raw') },
  proof: { title: 'Proof', load: () => import('../../../docs/PROOF.md?raw') },
  limits: { title: 'Limits', load: () => import('../../../docs/LIMITS.md?raw') },
  architecture: { title: 'Architecture', load: () => import('../../../docs/ARCHITECTURE.md?raw') },
  decisions: { title: 'Decisions', load: () => import('../../../docs/DECISIONS.md?raw') },
};

export function Docs() {
  const { path } = useRoute();
  const slug = path.split('/')[2] || 'methodology';
  const doc = DOCS[slug] ?? DOCS.methodology;
  const [html, setHtml] = useState('');
  useEffect(() => {
    let alive = true;
    Promise.all([doc.load(), import('marked')]).then(([md, { marked }]) => {
      if (alive) setHtml(marked.parse(md.default, { async: false }) as string);
    });
    return () => { alive = false; };
  }, [doc]);
  return (
    <main style={{ paddingTop: 110, paddingBottom: 100, minHeight: '100vh' }}>
      <div className="wrap docs-grid">
        <aside>
          <div className="label" style={{ marginBottom: 14 }}>Docs</div>
          <div style={{ display: 'grid', gap: 10 }}>
            {Object.entries(DOCS).map(([k, d]) => (
              <a key={k} href={`/docs/${k}`} onClick={onLink} style={{ color: k === slug ? 'var(--ice)' : 'var(--muted)' }}>{d.title}</a>
            ))}
          </div>
        </aside>
        <article className="md" dangerouslySetInnerHTML={{ __html: html }} />
      </div>
      <style>{`
        .docs-grid { display: grid; grid-template-columns: 200px 1fr; gap: 48px; }
        .docs-grid aside { position: sticky; top: 100px; align-self: start; }
        @media (max-width: 800px) { .docs-grid { grid-template-columns: 1fr; } .docs-grid aside { position: static; } }
        .md { max-width: 78ch; min-width: 0; }
        .md h1 { font-size: 44px; margin: 0 0 24px; }
        .md h2 { font-size: 26px; margin: 44px 0 14px; }
        .md h3 { font-size: 19px; margin: 28px 0 10px; }
        .md p, .md li { color: #c9d4de; }
        .md code { font-family: var(--mono); font-size: .9em; background: var(--surface-2); padding: 2px 6px; border-radius: 4px; }
        .md pre { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 16px; overflow-x: auto; }
        .md pre code { background: none; padding: 0; }
        .md table { border-collapse: collapse; width: 100%; display: block; overflow-x: auto; }
        .md th, .md td { border-bottom: 1px solid var(--border); padding: 8px 10px; text-align: left; }
        .md blockquote { border-left: 2px solid var(--ice); margin: 0; padding-left: 16px; color: var(--muted); }
      `}</style>
    </main>
  );
}
