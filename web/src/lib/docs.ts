import { lexer, type Token, type Tokens } from 'marked';
import { LINKS } from './links';

/** The documents, in reading order. `load` is missing for the two that have their own page. */
export interface Doc { slug: string; title: string; oneLine: string; href: string; file: string; load?: () => Promise<{ default: string }> }
export const DOCS: Doc[] = [
  { slug: 'readme', title: 'Readme', oneLine: 'Start here.', href: '/docs/readme', file: 'README.md', load: () => import('../../../README.md?raw') },
  { slug: 'methodology', title: 'Methodology', oneLine: 'How the five models and 1,000,000 futures work.', href: '/docs/methodology', file: 'docs/METHODOLOGY.md', load: () => import('../../../docs/METHODOLOGY.md?raw') },
  { slug: 'proof', title: 'Proof', oneLine: 'How hourly fingerprints let anyone check a run.', href: '/docs/proof', file: 'docs/PROOF.md', load: () => import('../../../docs/PROOF.md?raw') },
  { slug: 'limits', title: 'Limits', oneLine: 'What Quintel can’t tell you.', href: '/docs/limits', file: 'docs/LIMITS.md', load: () => import('../../../docs/LIMITS.md?raw') },
  { slug: 'security', title: 'Security', oneLine: 'Keys, contracts and how we handle them.', href: '/docs/security', file: 'docs/SECURITY.md', load: () => import('../../../docs/SECURITY.md?raw') },
  { slug: 'deployments', title: 'Deployments', oneLine: 'Every contract and service, with addresses.', href: '/docs/deployments', file: 'docs/DEPLOYMENTS.md', load: () => import('../../../docs/DEPLOYMENTS.md?raw') },
  { slug: 'architecture', title: 'Architecture', oneLine: 'How the pieces fit together.', href: '/docs/architecture', file: 'docs/ARCHITECTURE.md', load: () => import('../../../docs/ARCHITECTURE.md?raw') },
  { slug: 'decisions', title: 'Decisions', oneLine: 'The judgment calls, one line each.', href: '/docs/decisions', file: 'docs/DECISIONS.md', load: () => import('../../../docs/DECISIONS.md?raw') },
  { slug: 'changelog', title: 'Changelog', oneLine: 'Everything we’ve shipped.', href: '/changelog', file: 'CHANGELOG.md' },
  { slug: 'incidents', title: 'Incidents', oneLine: 'Anything that broke, and what we did about it.', href: '/incidents', file: 'docs/incidents' },
];

/** Markdown to blocks. The page supplies its own title, so the first h1 and raw HTML are left out. */
export function parseDoc(md: string): Token[] {
  const all = lexer(md).filter((t) => t.type !== 'html' && t.type !== 'space');
  const h1 = all.findIndex((t) => t.type === 'heading' && (t as Tokens.Heading).depth === 1);
  return h1 < 0 ? all : all.filter((_, i) => i !== h1);
}

/** the words of a token, without markup */
export const plain = (tokens: Token[] | undefined): string => (tokens ?? []).map((t) => ('tokens' in t && t.tokens ? plain(t.tokens) : 'text' in t ? String(t.text) : '')).join('');
export const anchor = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '');
export const headings = (tokens: Token[]) => tokens.filter((t): t is Tokens.Heading => t.type === 'heading' && (t as Tokens.Heading).depth === 2).map((t) => ({ id: anchor(plain(t.tokens)), text: plain(t.tokens) }));

/** Links between documents stay on the site; other files in the repo open on GitHub. */
export function docHref(href: string, file: string): string {
  if (/^([a-z]+:|\/|#)/i.test(href)) return href;
  const u = new URL(href, 'https://repo/' + file);
  const path = decodeURIComponent(u.pathname.slice(1)).replace(/\/$/, '');
  const doc = DOCS.find((d) => d.file === path);
  if (doc) return doc.href + u.hash;
  const incident = path.match(/^docs\/incidents\/(.+)\.md$/);
  if (incident) return '/incidents#' + incident[1];
  return `${LINKS.github}/${/\.\w+$/.test(path) ? 'blob' : 'tree'}/main/${path}${u.hash}`;
}
export const editUrl = (file: string) => `${LINKS.github}/edit/main/${file}`;

export interface Incident { slug: string; file: string; date: string; status: string; title: string; summary: string; body: Token[] }
export function parseIncident(path: string, md: string): Incident {
  const slug = path.split('/').pop()!.replace(/\.md$/, '');
  const m = md.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  const head = Object.fromEntries((m?.[1] ?? '').split('\n').map((l) => [l.slice(0, l.indexOf(':')).trim(), l.slice(l.indexOf(':') + 1).trim()]));
  return { slug, file: `docs/incidents/${slug}.md`, date: head.date || slug.slice(0, 10), status: head.status || 'Investigating', title: head.title || slug, summary: head.summary || '', body: parseDoc(m?.[2] ?? md) };
}

/** One release line. Lines written by scripts/ship.mjs also carry a title and a time. */
export interface Entry { tokens: Token[]; ship: { title: string; time: string; line: string } | null }
export interface Release { title: string; sections: { title: string | null; entries: Entry[] }[] }
export function parseChangelog(md: string): { intro: Token[]; releases: Release[] } {
  const intro: Token[] = [], releases: Release[] = [];
  for (const t of parseDoc(md)) {
    const r = releases[releases.length - 1];
    if (t.type === 'heading') {
      const title = plain(t.tokens).replace(/^\[(.+)\]$/, '$1');
      if ((t as Tokens.Heading).depth === 2) releases.push({ title, sections: [] });
      else r?.sections.push({ title, entries: [] });
    } else if (!r) intro.push(t);
    else {
      if (!r.sections.length) r.sections.push({ title: null, entries: [] });
      const add = (tokens: Token[], text: string) => {
        const m = text.match(/^\*\*(.+?)\*\*\s*·\s*(\d{1,2}:\d{2}[ap]m ET)\.\s*(.*)$/s);
        r.sections[r.sections.length - 1].entries.push({ tokens, ship: m ? { title: m[1], time: m[2], line: m[3].trim() } : null });
      };
      if (t.type === 'list') for (const item of (t as Tokens.List).items) add(item.tokens, item.text);
      else add([t], '');
    }
  }
  return { intro, releases: releases.filter((r) => r.sections.some((s) => s.entries.length)) };
}
