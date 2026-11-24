import { useEffect } from 'react';
/** Unique title and description per route. */
export function useMeta(title: string, description: string, opts: { noindex?: boolean } = {}) {
  useEffect(() => {
    document.title = title;
    document.querySelector('meta[name="description"]')?.setAttribute('content', description);
    let r = document.querySelector('meta[name="robots"]');
    if (opts.noindex) { if (!r) { r = document.createElement('meta'); r.setAttribute('name', 'robots'); document.head.append(r); } r.setAttribute('content', 'noindex'); } else r?.remove();
  }, [title, description, opts.noindex]);
}
