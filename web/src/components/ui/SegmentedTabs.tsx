import { useRef, type KeyboardEvent } from 'react';

export interface TabItem<T extends string> { id: T; label: string }
/** Tabs with arrow-key support. `idBase` links tabs to panels: panel id = `${idBase}-panel-${id}`. */
export function SegmentedTabs<T extends string>({ items, value, onChange, label, idBase }: { items: TabItem<T>[]; value: T; onChange: (v: T) => void; label: string; idBase?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const key = (e: KeyboardEvent) => {
    const i = items.findIndex((t) => t.id === value);
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    const j = e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : d ? (i + d + items.length) % items.length : -1;
    if (j < 0) return;
    e.preventDefault();
    onChange(items[j].id);
    (ref.current?.children[j] as HTMLElement)?.focus();
  };
  return (
    <div className="tabs" role="tablist" aria-label={label} ref={ref} onKeyDown={key}>
      {items.map((t) => (
        <button key={t.id} type="button" role="tab" id={idBase ? `${idBase}-tab-${t.id}` : undefined} aria-selected={t.id === value} aria-controls={idBase ? `${idBase}-panel-${t.id}` : undefined} tabIndex={t.id === value ? 0 : -1} onClick={() => onChange(t.id)}>{t.label}</button>
      ))}
    </div>
  );
}
