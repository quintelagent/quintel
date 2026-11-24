import { Fragment, useEffect, useState, type ReactNode } from 'react';
import type { Token, Tokens } from 'marked';
import { anchor, docHref, DOCS, editUrl, headings, parseDoc, plain, type Doc } from '../lib/docs';
import { useMeta } from '../lib/meta';
import { Link, navigate, scrollToId } from '../lib/router';
import { Button, Card, CodeBlock, ErrorState, Skeleton } from '../components/ui';
import { NotFound } from './NotFound';
import './docs.css';

export function Docs({ slug }: { slug: string | null }) {
  if (slug === null) return <Hub />;
  const doc = DOCS.find((d) => d.slug === slug && d.load);
  return doc ? <Article key={slug} doc={doc} /> : <NotFound />;
}

function Hub() {
  useMeta('Docs · Quintel', 'How Quintel works, how to check it, and what it can’t do.');
  return (
    <div className="page wrap">
      <div className="page-head"><h1>Docs.</h1><p>How Quintel works, how to check it, and what it can’t do.</p></div>
      <div className="docs-hub">
        {DOCS.map((d) => (
          <Card key={d.slug} as={Link} {...{ href: d.href }} className="docs-card card-link">
            <h2>{d.title}</h2>
            <p>{d.oneLine}</p>
            <span className="docs-read">Read</span>
          </Card>
        ))}
      </div>
    </div>
  );
}

const cache = new Map<string, Token[]>();

function Article({ doc }: { doc: Doc }) {
  useMeta(`${doc.title} · Quintel`, doc.oneLine);
  const [blocks, setBlocks] = useState(cache.get(doc.slug) ?? null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    if (!cache.has(doc.slug)) doc.load!().then((m) => {
      cache.set(doc.slug, parseDoc(m.default));
      if (alive) setBlocks(cache.get(doc.slug)!);
    }, () => alive && setFailed(true));
    return () => { alive = false; };
  }, [doc]);
  const toc = blocks ? headings(blocks) : [];
  const pick = (v: string) => (v.startsWith('#') ? scrollToId(v.slice(1)) : navigate(v));
  return (
    <div className="page wrap docs">
      <nav className="docs-side" aria-label="Documents">
        <div className="label">Docs</div>
        <ul>{DOCS.map((d) => <li key={d.slug}><Link href={d.href} aria-current={d.slug === doc.slug ? 'page' : undefined}>{d.title}</Link></li>)}</ul>
      </nav>
      <div className="docs-pick field">
        <label className="label" htmlFor="docs-pick">Document or section</label>
        <div className="input">
          <select id="docs-pick" value={doc.href} onChange={(e) => pick(e.target.value)}>
            <optgroup label="Documents">{DOCS.map((d) => <option key={d.slug} value={d.href}>{d.title}</option>)}</optgroup>
            {toc.length > 0 && <optgroup label="On this page">{toc.map((h) => <option key={h.id} value={'#' + h.id}>{h.text}</option>)}</optgroup>}
          </select>
        </div>
      </div>
      <article className="docs-article" aria-busy={!blocks && !failed}>
        <h1>{doc.title}</h1>
        {blocks ? <Markdown tokens={blocks} file={doc.file} />
          : failed ? <Card><ErrorState text="Couldn’t load this document. Try again." onRetry={() => location.reload()} /></Card>
          : <Lines />}
        {(blocks || failed) && <div className="docs-edit"><Button variant="secondary" href={editUrl(doc.file)}>Edit on GitHub</Button></div>}
      </article>
      <nav className="docs-toc" aria-label="On this page">
        {toc.length > 0 && <><div className="label">On this page</div><ul>{toc.map((h) => <li key={h.id}><Link href={'#' + h.id}>{h.text}</Link></li>)}</ul></>}
      </nav>
    </div>
  );
}

const Lines = () => (
  <div className="docs-md">
    {[0, 1, 2].map((k) => <div key={k} className="stack"><Skeleton h={24} w="40%" /><Skeleton h={16} /><Skeleton h={16} /><Skeleton h={16} w="90%" /><Skeleton h={16} w="70%" /></div>)}
  </div>
);

/** Repo markdown as React elements. `shift` lowers the headings when it sits under another heading. */
export function Markdown({ tokens, file, shift = 0 }: { tokens: Token[]; file: string; shift?: number }) {
  return <div className="docs-md">{tokens.map((t, i) => <Block key={i} t={t} file={file} shift={shift} />)}</div>;
}

function Block({ t, file, shift }: { t: Token; file: string; shift: number }): ReactNode {
  switch (t.type) {
    case 'heading': {
      const d = (t as Tokens.Heading).depth;
      const H = `h${Math.min(6, d + shift)}` as 'h2';
      return <H id={shift ? undefined : anchor(plain(t.tokens))} className={d === 2 ? 'docs-h2' : 'docs-h3'}><Inline tokens={t.tokens} file={file} /></H>;
    }
    case 'paragraph': return <p><Inline tokens={t.tokens} file={file} /></p>;
    case 'code': return <CodeBlock code={t.text} />;
    case 'blockquote': return <blockquote>{t.tokens?.map((x, i) => <Block key={i} t={x} file={file} shift={shift} />)}</blockquote>;
    case 'hr': return <hr className="hair" />;
    case 'list': {
      const l = t as Tokens.List;
      const L = l.ordered ? 'ol' : 'ul';
      return <L>{l.items.map((it, i) => <li key={i}>{it.tokens.map((x, j) => <Block key={j} t={x} file={file} shift={shift} />)}</li>)}</L>;
    }
    case 'table': return <Table t={t as Tokens.Table} file={file} />;
    case 'text': return <Inline tokens={t.tokens ?? [t]} file={file} />;
    default: return null;
  }
}

function Table({ t, file }: { t: Tokens.Table; file: string }) {
  const titled = t.header.some((c) => c.text.trim());
  return (
    <div className="docs-table" tabIndex={0} role="region" aria-label="Table">
      <table>
        {titled && <thead><tr>{t.header.map((c, i) => <th key={i} scope="col"><Inline tokens={c.tokens} file={file} /></th>)}</tr></thead>}
        <tbody>{t.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}><Inline tokens={c.tokens} file={file} /></td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

/** Raw HTML and images are not rendered. */
export function Inline({ tokens, file }: { tokens: Token[] | undefined; file: string }): ReactNode {
  return (tokens ?? []).map((t, i) => {
    const kids = () => <Inline tokens={t.type === 'text' ? (t as Tokens.Text).tokens : (t as Tokens.Strong).tokens} file={file} />;
    switch (t.type) {
      case 'text': return <Fragment key={i}>{(t as Tokens.Text).tokens ? kids() : t.text}</Fragment>;
      case 'escape': return <Fragment key={i}>{t.text}</Fragment>;
      case 'strong': return <strong key={i}>{kids()}</strong>;
      case 'em': return <em key={i}>{kids()}</em>;
      case 'del': return <del key={i}>{kids()}</del>;
      case 'codespan': return <code key={i}>{(t.text as string).match(/[^(]*\(|[^(]+$/g)?.map((s, j) => <Fragment key={j}>{j > 0 && <wbr />}{s}</Fragment>)}</code>;
      case 'br': return <br key={i} />;
      case 'link': return <Link key={i} href={docHref(t.href, file)}>{kids()}</Link>;
      default: return null;
    }
  });
}
